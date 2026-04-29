"""SanMar Bulk Data Service v1.0 wrapper.

For nightly catalog deltas. Walking ``getProduct()`` per active style
across the full SanMar Canada catalog (~16,630 styles) is wasteful when
only a handful change per day — Bulk Data ships a delta endpoint that
returns just the products / inventory snapshots that moved since a
caller-supplied checkpoint.

Two operations:

* ``getProductDataDelta`` — products changed in the window.
* ``getInventoryDataDelta`` — SKUs whose stock changed in the window.

Both return a window envelope (``window_start`` / ``window_end``)
plus a list of normalized DTOs the orchestrator can hand straight to
the catalog store.
"""
from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, ClassVar, Optional

from sanmar.dto import (
    BulkDataResponse,
    BulkInventoryResponse,
    InventoryResponse,
    ProductResponse,
)
from sanmar.services.base import SanmarServiceBase
from sanmar.services.inventory import InventoryService
from sanmar.services.product_data import ProductDataService


def _to_str(value: Any, default: str = "") -> str:
    if value is None:
        return default
    return str(value)


def _to_int(value: Any, default: int = 0) -> int:
    if value is None:
        return default
    try:
        return int(str(value))
    except (TypeError, ValueError):
        try:
            return int(float(str(value)))
        except (TypeError, ValueError):
            return default


def _to_list(value: Any) -> list[Any]:
    if value is None:
        return []
    if isinstance(value, list):
        return value
    return [value]


def _get(obj: Any, *keys: str) -> Any:
    for k in keys:
        if obj is None:
            return None
        if isinstance(obj, dict):
            obj = obj.get(k)
            continue
        obj = getattr(obj, k, None)
    return obj


def _to_datetime(value: Any, default: Optional[datetime] = None) -> datetime:
    """Coerce SanMar's ISO timestamp to :class:`datetime`. Returns
    ``default`` (or ``utcnow()``) on parse failure."""
    if isinstance(value, datetime):
        return value
    s = _to_str(value).strip()
    if s:
        for fmt in (
            "%Y-%m-%dT%H:%M:%S",
            "%Y-%m-%dT%H:%M:%SZ",
            "%Y-%m-%d",
        ):
            try:
                return datetime.strptime(s, fmt)
            except ValueError:
                continue
        try:
            return datetime.fromisoformat(s.replace("Z", "+00:00"))
        except ValueError:
            pass
    return default or datetime.now(tz=timezone.utc)


class BulkDataService(SanmarServiceBase):
    """Wrapper around the SanMar Bulk Data Service v1.0 endpoint."""

    wsdl_path: ClassVar[str] = "bulkdata/v1/?wsdl"

    def get_product_data_delta(self, since: datetime) -> BulkDataResponse:
        """Fetch the catalog delta since ``since``.

        Returns a :class:`BulkDataResponse` whose ``window_end`` should
        be persisted as the next checkpoint. ``products`` reuses the
        :class:`ProductResponse` projection so downstream catalog code
        doesn't have to know whether a product came from a full walk
        or a delta call."""
        params: dict[str, Any] = {
            **self.auth_dict(),
            "wsVersion": "1.0",
            "lastModifiedDate": since.isoformat(),
        }
        raw = self._call("getProductDataDelta", **params)
        return self._parse_product_delta(raw, since)

    def get_inventory_delta(self, since: datetime) -> BulkInventoryResponse:
        """Fetch the inventory snapshot for SKUs that moved since
        ``since``. The response shape mirrors the per-SKU
        ``getInventoryLevels`` response, so we delegate parsing to
        :meth:`InventoryService._parse_inventory` per row."""
        params: dict[str, Any] = {
            **self.auth_dict(),
            "wsVersion": "1.0",
            "lastModifiedDate": since.isoformat(),
        }
        raw = self._call("getInventoryDataDelta", **params)
        return self._parse_inventory_delta(raw, since)

    @staticmethod
    def _parse_product_delta(
        raw: Any, since: datetime
    ) -> BulkDataResponse:
        root = (
            _get(raw, "GetProductDataDeltaResponse")
            or _get(raw, "getProductDataDeltaResponse")
            or raw
        )
        window_start = _to_datetime(
            _get(root, "windowStart") or _get(root, "WindowStart"),
            default=since,
        )
        window_end = _to_datetime(
            _get(root, "windowEnd") or _get(root, "WindowEnd"),
            default=datetime.now(tz=timezone.utc),
        )

        arr_container = (
            _get(root, "ProductArray")
            or _get(root, "productArray")
            or root
        )
        nodes = _to_list(
            _get(arr_container, "Product") or _get(arr_container, "product")
        )

        products: list[ProductResponse] = []
        for node in nodes:
            # Wrap each node in the shape `_parse_product` expects.
            wrapped = {"Product": node}
            products.append(
                ProductDataService._parse_product(
                    wrapped, _to_str(_get(node, "productId"))
                )
            )

        total = _to_int(
            _get(root, "totalChanges") or _get(root, "TotalChanges"),
            default=len(products),
        )

        return BulkDataResponse(
            window_start=window_start,
            window_end=window_end,
            total_changes=total,
            products=products,
        )

    @staticmethod
    def _parse_inventory_delta(
        raw: Any, since: datetime
    ) -> BulkInventoryResponse:
        root = (
            _get(raw, "GetInventoryDataDeltaResponse")
            or _get(raw, "getInventoryDataDeltaResponse")
            or raw
        )
        window_start = _to_datetime(
            _get(root, "windowStart") or _get(root, "WindowStart"),
            default=since,
        )
        window_end = _to_datetime(
            _get(root, "windowEnd") or _get(root, "WindowEnd"),
            default=datetime.now(tz=timezone.utc),
        )

        arr_container = (
            _get(root, "InventoryArray")
            or _get(root, "inventoryArray")
            or root
        )
        nodes = _to_list(
            _get(arr_container, "Inventory")
            or _get(arr_container, "inventory")
        )

        snapshots: list[InventoryResponse] = []
        for node in nodes:
            # Each row mirrors the per-SKU `getInventoryLevels` shape
            # — wrap it and reuse the inventory parser.
            wrapped = {"Inventory": node}
            fallback = _to_str(_get(node, "productId"))
            snapshots.append(
                InventoryService._parse_inventory(
                    wrapped, fallback, color=None, size=None
                )
            )

        total = _to_int(
            _get(root, "totalChanges") or _get(root, "TotalChanges"),
            default=len(snapshots),
        )

        return BulkInventoryResponse(
            window_start=window_start,
            window_end=window_end,
            total_changes=total,
            snapshots=snapshots,
        )
