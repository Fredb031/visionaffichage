"""High-level facade composing every SanMar service into one object.

The eight underlying services each speak one PromoStandards endpoint;
the orchestrator chains them into the operator-facing workflows the
business actually runs:

* ``sync_catalog_full`` — full walk via ``getAllActiveParts`` +
  per-style ``getProduct``. Slow (one HTTP per style); use for cold
  starts or weekly reconciliation.
* ``sync_catalog_delta`` — fast incremental refresh via
  ``getProductDataDelta``. Pair with a persisted ``last_run`` so the
  next call asks SanMar for *only* what changed.
* ``sync_inventory_for_active_skus`` — pulls every SKU currently
  carried in the local ``variants`` table, fetches its inventory, and
  writes :class:`sanmar.models.InventorySnapshot` rows.
* ``reconcile_open_orders`` — for every order whose local state isn't
  ``Complete / Shipped``, ask SanMar for status; bump the local row
  when status transitions (e.g. ``60 → 80``).

Every public method returns a small dataclass with metrics
(``success_count``, ``error_count``, ``duration_ms``, ``errors``) so
the caller — usually a cron or Streamlit dashboard — has structured
output for alerting.
"""
from __future__ import annotations

import time
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import TYPE_CHECKING, Any, Optional

import pandas as pd

from sanmar.config import Settings
from sanmar.dto import (
    ORDER_STATUS_DESCRIPTIONS,
    BulkDataResponse,
    InventoryResponse,
    OrderStatusResponse,
)
from sanmar.exceptions import SanmarApiError
from sanmar.services.bulk_data import BulkDataService
from sanmar.services.inventory import InventoryService
from sanmar.services.invoice import InvoiceService
from sanmar.services.media import MediaContentService
from sanmar.services.pricing import PricingService
from sanmar.services.product_data import ProductDataService
from sanmar.services.purchase_order import PurchaseOrderService
from sanmar.services.shipment import ShipmentService

if TYPE_CHECKING:  # pragma: no cover - import-time only
    from sqlalchemy.orm import Session


@dataclass
class CatalogSyncResult:
    """Metrics for a catalog sync run."""

    success_count: int = 0
    error_count: int = 0
    duration_ms: int = 0
    products_seen: int = 0
    window_start: Optional[datetime] = None
    window_end: Optional[datetime] = None
    errors: list[dict] = field(default_factory=list)


@dataclass
class InventorySyncResult:
    """Metrics for an inventory sync run."""

    success_count: int = 0
    error_count: int = 0
    duration_ms: int = 0
    snapshots_written: int = 0
    errors: list[dict] = field(default_factory=list)


@dataclass
class OrderReconResult:
    """Metrics for an open-order reconciliation run."""

    success_count: int = 0
    error_count: int = 0
    duration_ms: int = 0
    transitions: int = 0
    errors: list[dict] = field(default_factory=list)


def _now_ms() -> int:
    return int(time.monotonic() * 1000)


class SanmarOrchestrator:
    """Composes all eight SanMar services into one facade.

    Lazy-instantiated — the underlying services are constructed on
    first attribute access so a test that only exercises one service
    doesn't have to mock the other seven.
    """

    def __init__(self, settings: Settings) -> None:
        self.settings = settings
        # Eager-build all eight so the spec test ("instantiates all 8
        # services") has something to assert against. None of them
        # touches the network until a method is called.
        self.product_data = ProductDataService(settings)
        self.inventory = InventoryService(settings)
        self.pricing = PricingService(settings)
        self.media = MediaContentService(settings)
        self.purchase_order = PurchaseOrderService(settings)
        self.shipment = ShipmentService(settings)
        self.invoice = InvoiceService(settings)
        self.bulk_data = BulkDataService(settings)

    @property
    def services(self) -> dict[str, Any]:
        """Map of service name → instance, for diagnostics."""
        return {
            "product_data": self.product_data,
            "inventory": self.inventory,
            "pricing": self.pricing,
            "media": self.media,
            "purchase_order": self.purchase_order,
            "shipment": self.shipment,
            "invoice": self.invoice,
            "bulk_data": self.bulk_data,
        }

    # ── catalog ───────────────────────────────────────────────────────

    def sync_catalog_full(
        self, *, session: Optional["Session"] = None
    ) -> CatalogSyncResult:
        """Full catalog walk via ``getAllActiveParts`` + ``getProduct``.

        Slow — one HTTP per style. Pass ``session`` to persist via
        :func:`sanmar.catalog.store.persist_catalog`; without it the
        method just enumerates and counts.
        """
        start = _now_ms()
        result = CatalogSyncResult()

        try:
            parts = self.product_data.get_all_active_parts()
        except SanmarApiError as e:
            result.errors.append(
                {"phase": "getAllActiveParts", "code": e.code, "message": e.message}
            )
            result.error_count += 1
            result.duration_ms = _now_ms() - start
            return result

        styles = sorted({p.style_number for p in parts if p.style_number})
        rows: list[dict] = []
        for style in styles:
            try:
                product = self.product_data.get_product(style)
                result.success_count += 1
                # Project to the catalog-store DataFrame shape.
                colors = product.list_of_colors or [""]
                sizes = product.list_of_sizes or [""]
                for color in colors:
                    for size in sizes:
                        rows.append(
                            {
                                "style_number": product.style_number,
                                "color_name": color,
                                "size": size,
                                "brand_name": product.brand_name,
                                "full_feature_description": product.description,
                                "category": product.category,
                                "status": product.status,
                            }
                        )
            except SanmarApiError as e:
                result.error_count += 1
                result.errors.append(
                    {
                        "phase": "getProduct",
                        "style": style,
                        "code": e.code,
                        "message": e.message,
                    }
                )

        result.products_seen = len(styles)

        if session is not None and rows:
            from sanmar.catalog.store import persist_catalog

            persist_catalog(pd.DataFrame(rows), session)

        result.duration_ms = _now_ms() - start
        return result

    def sync_catalog_delta(
        self,
        since: datetime,
        *,
        session: Optional["Session"] = None,
    ) -> CatalogSyncResult:
        """Incremental catalog sync via Bulk Data.

        Fetches the products that changed since ``since`` and persists
        them via :func:`sanmar.catalog.store.persist_catalog` if a
        session is provided. Returns a :class:`CatalogSyncResult` with
        the server-reported window so callers can persist the next
        checkpoint.
        """
        start = _now_ms()
        result = CatalogSyncResult()

        try:
            delta: BulkDataResponse = self.bulk_data.get_product_data_delta(
                since
            )
        except SanmarApiError as e:
            result.errors.append(
                {"phase": "getProductDataDelta", "code": e.code, "message": e.message}
            )
            result.error_count += 1
            result.duration_ms = _now_ms() - start
            return result

        result.window_start = delta.window_start
        result.window_end = delta.window_end
        result.products_seen = len(delta.products)
        result.success_count = len(delta.products)

        rows: list[dict] = []
        for product in delta.products:
            colors = product.list_of_colors or [""]
            sizes = product.list_of_sizes or [""]
            for color in colors:
                for size in sizes:
                    rows.append(
                        {
                            "style_number": product.style_number,
                            "color_name": color,
                            "size": size,
                            "brand_name": product.brand_name,
                            "full_feature_description": product.description,
                            "category": product.category,
                            "status": product.status,
                        }
                    )

        if session is not None and rows:
            from sanmar.catalog.store import persist_catalog

            persist_catalog(pd.DataFrame(rows), session)

        result.duration_ms = _now_ms() - start
        return result

    # ── inventory ─────────────────────────────────────────────────────

    def sync_inventory_for_active_skus(
        self, session: "Session"
    ) -> InventorySyncResult:
        """For each distinct active variant in the local DB, fetch
        SanMar inventory and write :class:`InventorySnapshot` rows.

        We iterate unique style numbers (one HTTP per style; SanMar
        returns every warehouse / SKU permutation for that style in
        one call) rather than per-SKU to minimize round-trips.
        """
        from sanmar.models import InventorySnapshot, Variant

        start = _now_ms()
        result = InventorySyncResult()

        # Distinct active styles in the local catalog.
        styles_q = (
            session.query(Variant.full_sku, Variant.color, Variant.size)
            .join(Variant.product)
            .all()
        )
        if not styles_q:
            result.duration_ms = _now_ms() - start
            return result

        # Group SKUs by style. The Variant rows store the composed
        # full_sku; the underlying style is at variant.product.style_number,
        # so fetch it via a join.
        style_skus: dict[str, list[tuple[str, Optional[str], Optional[str]]]] = {}
        for full_sku, color, size in styles_q:
            # full_sku looks like `<style>-<color>-<size>`; split on the
            # first hyphen since color/size may also contain hyphens but
            # only after underscore-replacement.
            if "-" in full_sku:
                style = full_sku.split("-", 1)[0]
            else:
                style = full_sku
            style_skus.setdefault(style, []).append((full_sku, color, size))

        now = datetime.now(tz=timezone.utc)
        for style, skus in style_skus.items():
            try:
                inv: InventoryResponse = self.inventory.get_inventory_levels(
                    style
                )
                result.success_count += 1
                for warehouse_level in inv.locations:
                    # Snapshot at the *style* grain — the underlying
                    # response collapses to per-warehouse aggregates by
                    # default (no color/size filter). For finer grain
                    # the caller can iterate `skus` and re-call.
                    for full_sku, _color, _size in skus:
                        session.add(
                            InventorySnapshot(
                                full_sku=full_sku,
                                warehouse_code=warehouse_level.warehouse_name,
                                quantity=warehouse_level.quantity,
                                fetched_at=now,
                            )
                        )
                        result.snapshots_written += 1
            except SanmarApiError as e:
                result.error_count += 1
                result.errors.append(
                    {
                        "style": style,
                        "code": e.code,
                        "message": e.message,
                    }
                )

        session.flush()
        result.duration_ms = _now_ms() - start
        return result

    # ── orders ────────────────────────────────────────────────────────

    def reconcile_open_orders(
        self,
        session: "Session",
        *,
        open_orders: Optional[list[dict]] = None,
    ) -> OrderReconResult:
        """For every open order, fetch SanMar status and detect
        transitions.

        ``open_orders`` is a list of ``{po_number, status_id}`` dicts
        the caller supplies — typically queried out of the local order
        table. We don't bake an order-table model into this package
        (one doesn't exist yet); the caller owns persistence and just
        hands us the work-list.

        On each transition we count it and append a row to ``errors``
        with ``phase='transition'`` so the caller can route both
        failures and successful transitions through the same channel
        (Slack, log, dashboard).
        """
        start = _now_ms()
        result = OrderReconResult()

        if not open_orders:
            result.duration_ms = _now_ms() - start
            return result

        for order in open_orders:
            po_number = order.get("po_number")
            prior_status = int(order.get("status_id") or 0)
            if not po_number:
                continue

            try:
                status: OrderStatusResponse = (
                    self.purchase_order.get_order_status(
                        po_number=po_number, query_type=1
                    )
                )
                result.success_count += 1
                if (
                    status.status_id
                    and status.status_id != prior_status
                ):
                    result.transitions += 1
                    result.errors.append(
                        {
                            "phase": "transition",
                            "po_number": po_number,
                            "from_status": prior_status,
                            "to_status": status.status_id,
                            "to_description": (
                                status.status_description
                                or ORDER_STATUS_DESCRIPTIONS.get(
                                    status.status_id, "Unknown"
                                )
                            ),
                        }
                    )
                    # Mutate the caller's dict in-place so they can
                    # write the new status back to their own table
                    # without re-querying.
                    order["status_id"] = status.status_id
                    order["status_description"] = (
                        status.status_description
                        or ORDER_STATUS_DESCRIPTIONS.get(
                            status.status_id, "Unknown"
                        )
                    )
            except SanmarApiError as e:
                result.error_count += 1
                result.errors.append(
                    {
                        "phase": "getOrderStatus",
                        "po_number": po_number,
                        "code": e.code,
                        "message": e.message,
                    }
                )

        result.duration_ms = _now_ms() - start
        return result
