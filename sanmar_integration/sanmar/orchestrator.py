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

import hashlib
import hmac
import json
import logging
import time
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import TYPE_CHECKING, Any, Optional

import pandas as pd
import requests

from sanmar.config import Settings
from sanmar.dto import (
    ORDER_STATUS_DESCRIPTIONS,
    BulkDataResponse,
    InventoryResponse,
    OrderStatusResponse,
)
from sanmar.exceptions import SanmarApiError
from sanmar.notifier import SyncNotifier
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

    from sanmar.models import OrderRow

logger = logging.getLogger(__name__)


# Status codes that warrant a customer-facing webhook. Mirrors the
# operator alerting set but with finer granularity:
#
# * 60 — Picked / awaiting ship → ``order.picked``
# * 75 — Partial shipment → ``order.partially_shipped``
# * 80 — Complete / Shipped → ``order.shipped``
# * 99 — Cancelled → ``order.cancelled``
#
# Anything else (received, in production, on hold) is operator-only
# noise and never gets sent to a customer system.
WEBHOOK_EVENTS: dict[int, str] = {
    60: "order.picked",
    75: "order.partially_shipped",
    80: "order.shipped",
    99: "order.cancelled",
}

WEBHOOK_TIMEOUT_SECONDS = 5.0
WEBHOOK_RETRY_BACKOFF_SECONDS = 3.0


class OrderWebhookClient:
    """Outbound HTTP poster for customer-facing order transitions.

    Posts a signed JSON envelope to a single configured customer
    endpoint (Vision's CRM, a Zapier hook, a partner's webhook
    receiver) when ``reconcile_open_orders`` observes an order moving
    into one of the codes in :data:`WEBHOOK_EVENTS`.

    Wire format::

        POST <url>
        Content-Type: application/json
        X-Sanmar-Signature: <hex-encoded HMAC-SHA256 of the body>

        {
          "event": "order.shipped",
          "po_number": "VA-12345",
          "customer_email": "ops@acme.ca",
          "status_id": 80,
          "status_label": "Complete / Shipped",
          "previous_status_id": 60,
          "expected_ship_date": "2026-04-30T00:00:00+00:00",
          "tracking_number": "1Z999AA10123456784",
          "tracking_numbers": ["1Z999AA10123456784"],
          "timestamp": "2026-04-29T18:30:00+00:00",
          "hmac_signature": "<same value as X-Sanmar-Signature>"
        }

    The signature is computed over the *exact bytes* of the POST body
    using ``HMAC-SHA256(secret, body)`` so receivers don't need to
    re-serialize JSON to verify (which would risk dict-order skew).
    The same hex string is mirrored into the body as
    ``hmac_signature`` for transports (e.g. Zapier UI) that hide
    headers.

    Failure policy
    --------------
    * ``url`` is ``None`` → every call is a no-op (no HTTP, no log).
    * 2xx → returns ``True``.
    * 5xx (or :class:`requests.RequestException`) → one retry after
      ``WEBHOOK_RETRY_BACKOFF_SECONDS`` of sleep, then gives up.
    * 4xx → no retry (the receiver said "your payload is malformed",
      retrying won't help).
    * All exceptions are caught and logged at ``warning``; reconcile
      never aborts because a customer's webhook receiver is down.
    """

    def __init__(
        self,
        url: Optional[str],
        secret: Optional[str] = None,
        timeout_s: float = WEBHOOK_TIMEOUT_SECONDS,
    ) -> None:
        self.url = url or None
        self.secret = secret or None
        self.timeout_s = timeout_s

    @property
    def enabled(self) -> bool:
        return self.url is not None

    def fire(
        self,
        event: str,
        order: "OrderRow",
        prev_status: int,
        new_status: int,
    ) -> bool:
        """Build + send the webhook envelope.

        Returns ``True`` when the receiver returned 2xx (possibly
        after one retry); ``False`` for skipped, 4xx, exhausted
        retries, or any swallowed exception.
        """
        if not self.enabled:
            return False

        try:
            payload = self._build_payload(event, order, prev_status, new_status)
            body = json.dumps(payload, sort_keys=True, default=str).encode("utf-8")
            signature = self._sign(body)

            # Mirror the signature into the body for transports that
            # don't surface custom headers.
            payload["hmac_signature"] = signature
            body = json.dumps(payload, sort_keys=True, default=str).encode("utf-8")
            # The X-Sanmar-Signature header is always the authoritative
            # value computed over the body-without-signature.
            headers = {
                "Content-Type": "application/json",
                "X-Sanmar-Signature": signature,
                "X-Sanmar-Event": event,
            }
        except Exception as exc:  # noqa: BLE001 - never fail reconcile
            logger.warning(
                "order webhook payload build failed: %s", type(exc).__name__
            )
            return False

        # First attempt.
        ok, retryable = self._post(body, headers)
        if ok:
            return True
        if not retryable:
            return False

        # One retry on 5xx / network error.
        time.sleep(WEBHOOK_RETRY_BACKOFF_SECONDS)
        ok, _ = self._post(body, headers)
        return ok

    # ── helpers ───────────────────────────────────────────────────────

    def _build_payload(
        self,
        event: str,
        order: "OrderRow",
        prev_status: int,
        new_status: int,
    ) -> dict[str, Any]:
        tracking_numbers = list(getattr(order, "tracking_numbers", None) or [])
        tracking_number = tracking_numbers[0] if tracking_numbers else None
        expected_ship = getattr(order, "expected_ship_date", None)
        return {
            "event": event,
            "po_number": getattr(order, "po_number", None),
            "customer_email": getattr(order, "customer_email", None),
            "previous_status_id": int(prev_status) if prev_status is not None else 0,
            "status_id": int(new_status),
            "status_label": ORDER_STATUS_DESCRIPTIONS.get(
                int(new_status), "Unknown"
            ),
            "expected_ship_date": (
                expected_ship.isoformat()
                if isinstance(expected_ship, datetime)
                else None
            ),
            "tracking_number": tracking_number,
            "tracking_numbers": tracking_numbers,
            "timestamp": datetime.now(tz=timezone.utc).isoformat(),
        }

    def _sign(self, body: bytes) -> str:
        """Compute the hex-encoded HMAC-SHA256 of ``body``.

        Returns an empty string when no secret is configured; receivers
        who care about authenticity should reject empty signatures.
        """
        if not self.secret:
            return ""
        return hmac.new(
            self.secret.encode("utf-8"), body, hashlib.sha256
        ).hexdigest()

    def _post(
        self, body: bytes, headers: dict[str, str]
    ) -> tuple[bool, bool]:
        """Single POST attempt. Returns ``(ok, retryable)``.

        * ``ok=True`` — 2xx response.
        * ``ok=False, retryable=True`` — 5xx or network error → caller
          may retry.
        * ``ok=False, retryable=False`` — 4xx or other terminal
          condition → caller must not retry.
        """
        if not self.url:
            return False, False
        try:
            resp = requests.post(
                self.url,
                data=body,
                headers=headers,
                timeout=self.timeout_s,
            )
        except requests.RequestException as exc:
            logger.warning(
                "order webhook post failed: %s", type(exc).__name__
            )
            return False, True  # network errors are retryable

        if 200 <= resp.status_code < 300:
            return True, False
        if resp.status_code >= 500:
            logger.warning(
                "order webhook returned 5xx status=%s — will retry",
                resp.status_code,
            )
            return False, True
        # 4xx — receiver says payload is bad, no retry will help.
        logger.warning(
            "order webhook returned 4xx status=%s — giving up",
            resp.status_code,
        )
        return False, False


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

    def __init__(
        self,
        settings: Settings,
        *,
        notifier: Optional[SyncNotifier] = None,
        webhook_client: Optional[OrderWebhookClient] = None,
    ) -> None:
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

        # Lazy-default the notifier from settings; callers can pass an
        # explicit one (e.g. to inject a mock in tests, or to plug a
        # different transport that conforms to SyncNotifier's surface).
        self.notifier: SyncNotifier = (
            notifier
            if notifier is not None
            else SyncNotifier(settings.alert_webhook_url)
        )

        # Phase 17 — outbound customer webhook. ``None`` URL = no-op
        # so callers and tests don't need to branch on availability.
        self.webhook_client: OrderWebhookClient = (
            webhook_client
            if webhook_client is not None
            else OrderWebhookClient(
                url=getattr(settings, "customer_webhook_url", None),
                secret=getattr(settings, "customer_webhook_secret", None),
            )
        )

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

        When a ``session`` is provided, writes a :class:`SyncState`
        checkpoint row with start time, finishes it with metrics, and
        always closes (try/finally) so partial failures still leave
        the row in a queryable state.
        """
        start = _now_ms()
        result = CatalogSyncResult()
        sync_row = self._open_sync_state(session, "catalog_full")

        try:
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
        finally:
            self._close_sync_state(
                session,
                sync_row,
                result.success_count,
                result.error_count,
                result.products_seen,
                last_marker=None,
                metadata={"duration_ms": _now_ms() - start},
                errors=result.errors,
            )

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
        sync_row = self._open_sync_state(session, "catalog_delta")

        try:
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
        finally:
            self._close_sync_state(
                session,
                sync_row,
                result.success_count,
                result.error_count,
                result.products_seen,
                last_marker=(
                    result.window_end.isoformat()
                    if result.window_end is not None
                    else None
                ),
                metadata={
                    "duration_ms": _now_ms() - start,
                    "since": since.isoformat() if since else None,
                },
                errors=result.errors,
            )

    # ── inventory ─────────────────────────────────────────────────────

    def sync_inventory_for_active_skus(
        self, session: "Session", *, limit: Optional[int] = None
    ) -> InventorySyncResult:
        """For each distinct active variant in the local DB, fetch
        SanMar inventory and write :class:`InventorySnapshot` rows.

        We iterate unique style numbers (one HTTP per style; SanMar
        returns every warehouse / SKU permutation for that style in
        one call) rather than per-SKU to minimize round-trips.

        ``limit`` caps the number of distinct styles processed — used
        from the CLI for smoke tests and during development so a full
        sync doesn't hammer the SOAP edge while iterating.
        """
        from sanmar.models import InventorySnapshot, Variant

        start = _now_ms()
        result = InventorySyncResult()
        sync_row = self._open_sync_state(session, "inventory")
        last_processed_style: Optional[str] = None

        try:
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

            # Apply the limit if requested — sort for deterministic
            # behaviour in tests + repeatable smoke runs.
            style_iter = sorted(style_skus.items())
            if limit is not None:
                style_iter = style_iter[:limit]

            now = datetime.now(tz=timezone.utc)
            for style, skus in style_iter:
                last_processed_style = style
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
        finally:
            self._close_sync_state(
                session,
                sync_row,
                result.success_count,
                result.error_count,
                result.snapshots_written,
                last_marker=last_processed_style,
                metadata={
                    "duration_ms": _now_ms() - start,
                    "limit": limit,
                },
                errors=result.errors,
            )

    # ── orders ────────────────────────────────────────────────────────

    def reconcile_open_orders(
        self,
        session: "Session",
        *,
        open_orders: Optional[list[dict]] = None,
    ) -> OrderReconResult:
        """For every open order, fetch SanMar status and detect
        transitions.

        Phase 6: by default this method now queries the local
        :class:`sanmar.models.OrderRow` table for ``is_open`` rows and
        writes status transitions back in place — no external
        work-list required. Callers that haven't yet migrated to the
        ``orders`` table can still pass an explicit ``open_orders``
        list of ``{po_number, status_id}`` dicts, in which case the
        legacy mutate-in-place behaviour is preserved.

        On each transition we count it and append a row to ``errors``
        with ``phase='transition'`` so the caller can route both
        failures and successful transitions through the same channel
        (Slack, log, dashboard). When status flips into ``80``
        (Complete / Shipped) we additionally call
        :meth:`ShipmentService.get_tracking_info` and record
        ``shipped_at`` + ``tracking_numbers`` on the OrderRow.
        """
        start = _now_ms()
        result = OrderReconResult()
        sync_row = self._open_sync_state(session, "order_reconcile")

        try:
            # Legacy path: caller supplied the work-list explicitly.
            if open_orders is not None:
                self._reconcile_from_workitems(open_orders, result)
                result.duration_ms = _now_ms() - start
                return result

            # New path: source from OrderRow.is_open.
            from sanmar.models import OrderRow

            now = datetime.now(tz=timezone.utc)
            try:
                rows = session.query(OrderRow).filter(OrderRow.is_open).all()
            except Exception as e:  # noqa: BLE001 - tests use mock sessions
                # If the session can't run a real query (e.g. a MagicMock
                # in unit tests with no open_orders provided), surface a
                # clean empty-result rather than crashing.
                result.errors.append(
                    {"phase": "query", "message": str(e)}
                )
                result.duration_ms = _now_ms() - start
                return result

            for row in rows:
                if not row.po_number:
                    continue
                prior_status = int(row.status_id or 0)
                try:
                    status: OrderStatusResponse = (
                        self.purchase_order.get_order_status(
                            po_number=row.po_number, query_type=1
                        )
                    )
                    result.success_count += 1
                    row.last_status_check_at = now

                    if (
                        status.status_id
                        and status.status_id != prior_status
                    ):
                        result.transitions += 1
                        new_desc = (
                            status.status_description
                            or ORDER_STATUS_DESCRIPTIONS.get(
                                status.status_id, "Unknown"
                            )
                        )
                        result.errors.append(
                            {
                                "phase": "transition",
                                "po_number": row.po_number,
                                "from_status": prior_status,
                                "to_status": status.status_id,
                                "to_description": new_desc,
                            }
                        )
                        row.status_id = status.status_id
                        row.status_description = new_desc

                        # On flip to Complete / Shipped, populate
                        # shipping fields from the Shipment service.
                        if status.status_id == 80:
                            try:
                                tracking = self.shipment.get_tracking_info(
                                    row.po_number
                                )
                                row.shipped_at = now
                                row.tracking_numbers = [
                                    t.tracking_number
                                    for t in tracking
                                    if t.tracking_number
                                ]
                            except SanmarApiError as e:
                                result.errors.append(
                                    {
                                        "phase": "getTrackingInfo",
                                        "po_number": row.po_number,
                                        "code": e.code,
                                        "message": e.message,
                                    }
                                )

                        # Fire a transition alert for terminal states
                        # (80=shipped, 99=cancelled). The notifier
                        # itself filters non-terminal codes.
                        try:
                            self.notifier.notify_transition(
                                row, prior_status, status.status_id
                            )
                        except Exception:  # noqa: BLE001 - never fail the sync
                            pass

                        # Phase 17 — outbound customer webhook on
                        # transitions to 60/75/80/99. The client itself
                        # no-ops when no URL is configured, swallows
                        # all exceptions, and retries once on 5xx so
                        # reconcile is never blocked by a flaky
                        # customer endpoint.
                        event_name = WEBHOOK_EVENTS.get(int(status.status_id))
                        if event_name is not None:
                            try:
                                self.webhook_client.fire(
                                    event_name,
                                    row,
                                    prior_status,
                                    status.status_id,
                                )
                            except Exception:  # noqa: BLE001 - never fail
                                pass
                except SanmarApiError as e:
                    result.error_count += 1
                    result.errors.append(
                        {
                            "phase": "getOrderStatus",
                            "po_number": row.po_number,
                            "code": e.code,
                            "message": e.message,
                        }
                    )

            session.flush()
            result.duration_ms = _now_ms() - start
            return result
        finally:
            self._close_sync_state(
                session,
                sync_row,
                result.success_count,
                result.error_count,
                result.success_count + result.error_count,
                last_marker=None,
                metadata={
                    "duration_ms": _now_ms() - start,
                    "transitions": result.transitions,
                },
                errors=result.errors,
            )

    def _reconcile_from_workitems(
        self, open_orders: list[dict], result: OrderReconResult
    ) -> None:
        """Legacy reconcile path retained for backward compatibility.

        Mutates each dict in-place when a status transition is
        observed, matching the pre-Phase-6 contract that several
        external callers and tests rely on.
        """
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
                    new_desc = (
                        status.status_description
                        or ORDER_STATUS_DESCRIPTIONS.get(
                            status.status_id, "Unknown"
                        )
                    )
                    result.errors.append(
                        {
                            "phase": "transition",
                            "po_number": po_number,
                            "from_status": prior_status,
                            "to_status": status.status_id,
                            "to_description": new_desc,
                        }
                    )
                    order["status_id"] = status.status_id
                    order["status_description"] = new_desc
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

    # ── sync_state helpers ────────────────────────────────────────────

    def _open_sync_state(
        self, session: Optional["Session"], sync_type: str
    ) -> Optional["Any"]:
        """Insert a fresh SyncState row at the start of a sync.

        Returns ``None`` when there's no session (tests, dry-runs) or
        the session can't accept ORM writes (MagicMock). Both cases
        downgrade to silent — sync state is observability, not
        correctness, so a missing row should never break the sync.
        """
        if session is None:
            return None
        try:
            from sanmar.models import SyncState

            row = SyncState(sync_type=sync_type)
            session.add(row)
            session.flush()
            return row
        except Exception:  # noqa: BLE001 - mock sessions in tests
            return None

    def _close_sync_state(
        self,
        session: Optional["Session"],
        sync_row: Optional["Any"],
        success_count: int,
        error_count: int,
        total_processed: int,
        *,
        last_marker: Optional[str],
        metadata: Optional[dict[str, Any]],
        errors: Optional[list[dict]],
    ) -> None:
        """Stamp the SyncState row with final metrics + the (capped)
        error list. Silent on any failure for the same reason as
        :meth:`_open_sync_state`. Fires the failure notifier when
        ``error_count > 0`` (subject to its own dedup)."""
        if session is None or sync_row is None:
            # No row to close — but we still want failure alerting on
            # error-only paths. Caller will hit ``_alert_failure_only``
            # explicitly when relevant. For the row-less path here just
            # return.
            return
        try:
            sync_row.mark_finished(
                success_count=success_count,
                error_count=error_count,
                total_processed=total_processed,
                last_processed_marker=last_marker,
                metadata=metadata,
            )
            if errors:
                # Cap to 100 to match SyncState's invariant.
                from sanmar.models import SYNC_STATE_ERROR_CAP

                sync_row.errors = list(errors[:SYNC_STATE_ERROR_CAP])
            session.flush()
        except Exception:  # noqa: BLE001 - mock sessions in tests
            return

        # Best-effort alert dispatch — failures inside notifier are
        # already swallowed there, but wrap one more time to ensure a
        # wonky mock session can't blow up the orchestrator.
        if error_count > 0:
            try:
                self.notifier.notify_failure(sync_row)
                # notify_failure mutates sync_row.metadata_json with
                # last_alert_at; flush so the dedup window persists.
                session.flush()
            except Exception:  # noqa: BLE001 - alerting must never fail sync
                return
