"""SanMar PromoStandards Order Shipment Notification Service v2.0.0.

Returns ASN-style notifications: one row per shipment leg (a PO can
split across multiple cartons / dates). Two query modes per the spec:

* ``queryType=1`` — by PO / customer PO (single-shipment lookup).
* ``queryType=2`` — by date range (catch-up after an outage).

Reference: SanMar PromoStandards Order Shipment Notification PDF.
"""
from __future__ import annotations

from datetime import date, datetime
from decimal import Decimal, InvalidOperation
from typing import Any, ClassVar, Optional

from sanmar.dto import (
    Address,
    LineItem,
    ShipmentNotification,
    TrackingInfo,
)
from sanmar.services.base import SanmarServiceBase


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


def _to_decimal_or_none(value: Any) -> Optional[Decimal]:
    if value is None or str(value).strip() == "":
        return None
    try:
        return Decimal(str(value))
    except (InvalidOperation, ValueError):
        return None


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


def _to_date(value: Any) -> Optional[date]:
    """Coerce SanMar's ISO-ish date strings to :class:`date`. Returns
    ``None`` on any parse failure rather than raising — operators
    would rather see a missing date than a stack trace."""
    if value is None:
        return None
    if isinstance(value, date) and not isinstance(value, datetime):
        return value
    if isinstance(value, datetime):
        return value.date()
    s = str(value).strip()
    if not s:
        return None
    # Try common SanMar shapes.
    for fmt in ("%Y-%m-%d", "%Y-%m-%dT%H:%M:%S", "%Y-%m-%dT%H:%M:%SZ"):
        try:
            return datetime.strptime(s, fmt).date()
        except ValueError:
            continue
    # Last resort: ISO with timezone.
    try:
        return datetime.fromisoformat(s.replace("Z", "+00:00")).date()
    except ValueError:
        return None


class ShipmentService(SanmarServiceBase):
    """Wrapper around the Order Shipment Notification Service v2.0.0."""

    wsdl_path: ClassVar[str] = "shipment/v2.0.0/?wsdl"

    def get_shipment_notifications(
        self,
        po_number: Optional[str] = None,
        customer_po: Optional[str] = None,
        since: Optional[datetime] = None,
    ) -> list[ShipmentNotification]:
        """Fetch shipment notifications.

        Pass either ``po_number`` / ``customer_po`` (queryType=1) or a
        ``since`` datetime to walk a date range (queryType=2). When all
        three are ``None`` we default to queryType=2 with an open-ended
        range — SanMar will reject this with code 110, surfacing as a
        :class:`SanmarApiError`."""
        params: dict[str, Any] = {
            **self.auth_dict(),
            "wsVersion": "2.0.0",
        }
        if po_number or customer_po:
            params["queryType"] = 1
            if po_number:
                params["referenceNumber"] = po_number
            if customer_po:
                params["customerPONumber"] = customer_po
        else:
            params["queryType"] = 2
            if since is not None:
                params["lastUpdateDate"] = since.isoformat()

        raw = self._call("getOrderShipmentNotification", **params)
        return self._parse_notifications(raw)

    def get_tracking_info(self, po_number: str) -> list[TrackingInfo]:
        """Convenience wrapper — same call as
        :meth:`get_shipment_notifications` filtered down to
        tracking-only fields. Useful for shipping-confirmation emails
        where you don't want to leak line-item data."""
        notifications = self.get_shipment_notifications(po_number=po_number)
        return [
            TrackingInfo(
                po_number=n.po_number,
                tracking_number=n.tracking_number,
                carrier=n.carrier,
                ship_date=n.ship_date,
                expected_delivery_date=None,
            )
            for n in notifications
        ]

    @staticmethod
    def _parse_notifications(raw: Any) -> list[ShipmentNotification]:
        """Project a zeep response into a list of
        :class:`ShipmentNotification`. Tolerates upper/lower-cased
        element names so plain dict mocks work in tests."""
        root = (
            _get(raw, "GetOrderShipmentNotificationResponse")
            or _get(raw, "getOrderShipmentNotificationResponse")
            or raw
        )
        arr_container = (
            _get(root, "ShipmentNotificationArray")
            or _get(root, "shipmentNotificationArray")
            or root
        )
        nodes = _to_list(
            _get(arr_container, "ShipmentNotification")
            or _get(arr_container, "shipmentNotification")
        )
        # Empty/None response → empty list (no crash).
        if not nodes:
            return []

        out: list[ShipmentNotification] = []
        for n in nodes:
            ship_to = _get(n, "ShipTo") or _get(n, "shipTo")
            address: Optional[Address] = None
            if ship_to is not None:
                # Best-effort projection — drop the row's ship_to if any
                # required field is missing rather than blow up the
                # whole list. Real SanMar responses always include the
                # full block; defensiveness is for stub fixtures.
                try:
                    address = Address(
                        name=_to_str(_get(ship_to, "Name") or _get(ship_to, "name")),
                        company=_to_str(
                            _get(ship_to, "CompanyName")
                            or _get(ship_to, "companyName")
                        )
                        or None,
                        address_line_1=_to_str(
                            _get(ship_to, "Address1")
                            or _get(ship_to, "address1")
                        ),
                        address_line_2=_to_str(
                            _get(ship_to, "Address2")
                            or _get(ship_to, "address2")
                        )
                        or None,
                        city=_to_str(_get(ship_to, "City") or _get(ship_to, "city")),
                        state_province=_to_str(
                            _get(ship_to, "State") or _get(ship_to, "state")
                        ),
                        postal_code=_to_str(
                            _get(ship_to, "Zip") or _get(ship_to, "zip")
                        ),
                        country=_to_str(
                            _get(ship_to, "Country")
                            or _get(ship_to, "country"),
                            default="CA",
                        ),  # type: ignore[arg-type]
                        phone=_to_str(
                            _get(ship_to, "Phone") or _get(ship_to, "phone")
                        ),
                        email=_to_str(
                            _get(ship_to, "Email") or _get(ship_to, "email")
                        ),
                    )
                except Exception:  # noqa: BLE001 - DTO validation
                    address = None

            li_container = (
                _get(n, "LineItemArray")
                or _get(n, "lineItemArray")
            )
            li_nodes = _to_list(
                _get(li_container, "LineItem")
                or _get(li_container, "lineItem")
            )
            line_items: list[LineItem] = []
            for li in li_nodes:
                line_items.append(
                    LineItem(
                        style_number=_to_str(
                            _get(li, "Style")
                            or _get(li, "styleNumber")
                            or _get(li, "style")
                        ),
                        color=_to_str(_get(li, "Color") or _get(li, "color")),
                        size=_to_str(_get(li, "Size") or _get(li, "size")),
                        quantity=_to_int(
                            _get(li, "Quantity") or _get(li, "quantity")
                        ),
                    )
                )

            out.append(
                ShipmentNotification(
                    shipment_id=_to_str(
                        _get(n, "shipmentId")
                        or _get(n, "ShipmentId")
                    ),
                    po_number=_to_str(
                        _get(n, "poNumber")
                        or _get(n, "purchaseOrderNumber")
                    ),
                    customer_po=_to_str(
                        _get(n, "customerPONumber")
                        or _get(n, "customerPoNumber")
                    ),
                    ship_date=_to_date(
                        _get(n, "shipDate") or _get(n, "ShipDate")
                    ),
                    carrier=_to_str(_get(n, "carrier") or _get(n, "Carrier")),
                    tracking_number=_to_str(
                        _get(n, "trackingNumber")
                        or _get(n, "TrackingNumber")
                    ),
                    ship_to_address=address,
                    line_items=line_items,
                    weight_kg=_to_decimal_or_none(
                        _get(n, "weightKg")
                        or _get(n, "weight")
                    ),
                    packages=_to_int(
                        _get(n, "packages") or _get(n, "packageCount"),
                        default=1,
                    ),
                )
            )
        return out
