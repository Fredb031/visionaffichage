"""SanMar PromoStandards Purchase Order Service v1.0.0 wrapper.

Reference: ``supabase/functions/_shared/sanmar/orders.ts`` for the
battle-tested validation and parsing logic.

What this module enforces *before* a SOAP call ever leaves the box:

1. **Forbidden character check.** SanMar rejects any of
   ``< > & " '`` in address lines, names, company names, etc., with
   error code ``210``. We catch it locally and raise
   :class:`ForbiddenCharError` with the exact field + char so the
   operator can fix the input without round-tripping the gateway.

2. **Postal code regex.** Canadian ``A1A 1A1`` (with or without the
   space) and US ``12345`` / ``12345-6789``. Mismatched country/format
   raises :class:`InvalidPostalCodeError`.

3. **Carrier allowlist.** ``UPS`` / ``PUR`` (Purolator) / ``FDX``
   (FedEx) / ``CPC`` (Canada Post). Lower-case input is normalized to
   upper. Anything else raises :class:`InvalidCarrierError`.

Response parsing handles SanMar's wrapper-name asymmetry: the request
element is named ``SubmitPOOrderRequest`` but the response element
comes back as ``SendPOResponse``. We try ``SendPOResponse`` first
(matching what the gateway actually sends) and fall back to
``SubmitPOOrderResponse`` so a future PromoStandards alignment that
fixes the asymmetry doesn't silently break us.
"""
from __future__ import annotations

import re
from typing import Any, ClassVar, Optional

from sanmar.dto import (
    ORDER_STATUS_DESCRIPTIONS,
    OrderStatusResponse,
    PurchaseOrderInput,
    PurchaseOrderResponse,
)
from sanmar.exceptions import (
    ForbiddenCharError,
    InvalidCarrierError,
    InvalidPostalCodeError,
)
from sanmar.services.base import SanmarServiceBase

# ── Validation constants ──────────────────────────────────────────────

# SanMar's "Invalid Character" rejection set. The PDF lists a longer
# allowlist; the TS layer carries the same five XML-sensitive characters
# that consistently trigger code 210. Keep the two stacks in lock-step.
FORBIDDEN_CHARS: tuple[str, ...] = ("<", ">", "&", '"', "'")

CA_POSTAL_RE = re.compile(r"^[A-Za-z]\d[A-Za-z][ ]?\d[A-Za-z]\d$")
US_POSTAL_RE = re.compile(r"^\d{5}([- ]\d{4})?$")

ALLOWED_CARRIERS: frozenset[str] = frozenset({"UPS", "PUR", "FDX", "CPC"})


def _check_forbidden(field_name: str, value: Optional[str]) -> None:
    """Raise :class:`ForbiddenCharError` if ``value`` contains any
    blacklisted character. Empty / None values are skipped — the
    upstream Pydantic model already enforces required fields."""
    if not value:
        return
    for ch in FORBIDDEN_CHARS:
        if ch in value:
            raise ForbiddenCharError(field_name, ch)


def _validate_address(prefix: str, addr: Any) -> None:
    """Run the forbidden-char + postal-code checks on one address.

    ``prefix`` is prepended to field names in error messages so the
    operator can tell ship-to from bill-to at a glance."""
    _check_forbidden(f"{prefix}.name", addr.name)
    _check_forbidden(f"{prefix}.company", addr.company)
    _check_forbidden(f"{prefix}.address_line_1", addr.address_line_1)
    _check_forbidden(f"{prefix}.address_line_2", addr.address_line_2)
    _check_forbidden(f"{prefix}.city", addr.city)
    _check_forbidden(f"{prefix}.state_province", addr.state_province)

    postal = (addr.postal_code or "").strip()
    if addr.country == "CA":
        if not CA_POSTAL_RE.match(postal):
            raise InvalidPostalCodeError(postal, "CA")
    else:  # US
        if not US_POSTAL_RE.match(postal):
            raise InvalidPostalCodeError(postal, "US")


def _normalize_carrier(carrier: str) -> str:
    """Upper-case ``carrier`` and verify it's in :data:`ALLOWED_CARRIERS`.

    Raises :class:`InvalidCarrierError` (code 230) on miss."""
    upper = (carrier or "").strip().upper()
    if upper not in ALLOWED_CARRIERS:
        raise InvalidCarrierError(carrier)
    return upper


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


class PurchaseOrderService(SanmarServiceBase):
    """Wrapper around the Purchase Order Service v1.0.0 endpoint.

    Also exposes :meth:`get_order_status`, which technically lives at a
    sibling endpoint but logically pairs with submission. Keeping both
    on one class avoids forcing callers to instantiate two services."""

    wsdl_path: ClassVar[str] = "purchaseorder/v1/?wsdl"

    # ── submit ────────────────────────────────────────────────────────

    def submit_order(
        self, order: PurchaseOrderInput
    ) -> PurchaseOrderResponse:
        """Submit a purchase order to SanMar.

        Pre-flight validation runs *before* the SOAP call. On success
        returns a :class:`PurchaseOrderResponse` carrying the SanMar
        transaction id (0 = rejected, non-zero = accepted; always
        inspect ``message``)."""
        # ── Pre-flight validation ────────────────────────────────────
        _validate_address("ship_to", order.ship_to)
        _validate_address("bill_to", order.bill_to)
        _check_forbidden("po_number", order.po_number)
        _check_forbidden("customer_po", order.customer_po)
        for i, li in enumerate(order.line_items):
            _check_forbidden(f"line_items[{i}].style_number", li.style_number)
            _check_forbidden(f"line_items[{i}].color", li.color)
            _check_forbidden(f"line_items[{i}].size", li.size)
        carrier = _normalize_carrier(order.carrier)

        # ── Build SOAP params ────────────────────────────────────────
        params: dict[str, Any] = {
            **self.auth_dict(),
            "wsVersion": "1.0.0",
            "PO": {
                "poNumber": order.po_number,
                "customerPONumber": order.customer_po,
                "paymentTerms": order.payment_terms,
                "carrier": carrier,
                "requestedShipDate": (
                    order.requested_ship_date.isoformat()
                    if order.requested_ship_date
                    else None
                ),
                "ShipTo": _address_to_dict(order.ship_to),
                "BillTo": _address_to_dict(order.bill_to),
                "LineItemArray": {
                    "LineItem": [
                        _line_item_to_dict(li) for li in order.line_items
                    ]
                },
            },
        }

        raw = self._call("submitPO", **params)
        return self._parse_submit_response(raw, order.po_number)

    @staticmethod
    def _parse_submit_response(
        raw: Any, fallback_po: str
    ) -> PurchaseOrderResponse:
        """Parse the asymmetric ``SendPOResponse`` wrapper.

        SanMar's gateway returns ``<SendPOResponse>`` (per PDF) even
        though the request element is ``SubmitPOOrderRequest``. Try the
        actual-on-wire name first, then the symmetric fallback name in
        case PromoStandards eventually aligns the two."""
        # Primary lookup: SendPOResponse (the bug-parity wire name).
        # Fallbacks: SubmitPOOrderResponse / SubmitPOResponse for
        # forward-compat, then bare root for fully-unwrapped mocks.
        resp = (
            _get(raw, "SendPOResponse")
            or _get(raw, "sendPOResponse")
            or _get(raw, "SubmitPOOrderResponse")
            or _get(raw, "submitPOOrderResponse")
            or _get(raw, "SubmitPOResponse")
            or _get(raw, "submitPOResponse")
            or raw
        )

        transaction_id = _to_int(_get(resp, "transactionId"))
        # Aggregate ServiceMessageArray into one human message string.
        messages_container = (
            _get(resp, "ServiceMessageArray")
            or _get(resp, "serviceMessageArray")
        )
        message_nodes = _to_list(
            _get(messages_container, "ServiceMessage")
            or _get(messages_container, "serviceMessage")
        )
        message_parts: list[str] = []
        for m in message_nodes:
            desc = _to_str(_get(m, "description"))
            severity = _to_str(_get(m, "severity"))
            if desc:
                message_parts.append(
                    f"[{severity or 'Info'}] {desc}" if severity else desc
                )
        message = "; ".join(message_parts)

        # Success heuristic: non-zero transactionId AND no Error/Fatal
        # severity in the messages.
        has_error = any(
            _to_str(_get(m, "severity")).lower() in ("error", "fatal")
            for m in message_nodes
        )
        success = transaction_id > 0 and not has_error

        po_number = _to_str(_get(resp, "poNumber"), default=fallback_po) or fallback_po

        return PurchaseOrderResponse(
            transaction_id=transaction_id,
            success=success,
            message=message,
            po_number=po_number,
        )

    # ── status ────────────────────────────────────────────────────────

    def get_order_status(
        self,
        po_number: Optional[str] = None,
        customer_po: Optional[str] = None,
        query_type: int = 1,
    ) -> OrderStatusResponse:
        """Look up status on a previously-submitted order.

        ``query_type`` per SanMar's PDF::

            1 = single PO lookup (provide po_number or customer_po)
            2 = date range lookup (uses last_status_change_date ISO)
            3 = NOT supported by SanMar Canada — raises ValueError
            4 = list all open orders
        """
        if query_type == 3:
            raise ValueError(
                "queryType=3 is not supported by SanMar Canada "
                "(per Order Status Service PDF)."
            )

        params: dict[str, Any] = {
            **self.auth_dict(),
            "wsVersion": "1.0.0",
            "queryType": query_type,
        }
        if po_number:
            params["referenceNumber"] = po_number
        elif customer_po:
            params["customerPONumber"] = customer_po

        raw = self._call("getOrderStatus", **params)
        return self._parse_status_response(raw, po_number or customer_po or "")

    @staticmethod
    def _parse_status_response(
        raw: Any, fallback_order: str
    ) -> OrderStatusResponse:
        """Project a status response into :class:`OrderStatusResponse`.

        Stuffs the entire parsed dict into ``raw_response`` for
        operator debugging — the wire shape varies wildly across
        query types and we'd rather expose everything than pretend
        we've seen all possible variants."""
        root = (
            _get(raw, "GetOrderStatusResponse")
            or _get(raw, "getOrderStatusResponse")
            or raw
        )
        # Drill into the first OrderStatus node — for a single-PO
        # lookup that's all there is. Multi-result responses (queryType
        # 2 or 4) surface only the first here; callers that need the
        # full set should walk ``raw_response`` themselves.
        arr_container = (
            _get(root, "OrderStatusArray")
            or _get(root, "orderStatusArray")
        )
        order_nodes = _to_list(
            _get(arr_container, "OrderStatus")
            or _get(arr_container, "orderStatus")
        )
        first = order_nodes[0] if order_nodes else root

        order_number = _to_str(
            _get(first, "purchaseOrderNumber"),
            default=fallback_order,
        ) or fallback_order

        # Detail array — most fields live under the first detail.
        detail_container = (
            _get(first, "OrderStatusDetailArray")
            or _get(first, "orderStatusDetailArray")
        )
        detail_nodes = _to_list(
            _get(detail_container, "OrderStatusDetail")
            or _get(detail_container, "orderStatusDetail")
        )
        detail = detail_nodes[0] if detail_nodes else first

        status_id = _to_int(_get(detail, "statusId"))
        status_description = ORDER_STATUS_DESCRIPTIONS.get(
            status_id, _to_str(_get(detail, "statusName"), default="Unknown")
        )

        expected_ship_date = _to_str(_get(detail, "expectedShipDate"))

        # Tracking numbers are buried — try a couple of common shapes.
        tracking_container = (
            _get(detail, "TrackingNumberArray")
            or _get(detail, "trackingNumberArray")
            or _get(first, "TrackingNumberArray")
            or _get(first, "trackingNumberArray")
        )
        tracking_raw = _to_list(
            _get(tracking_container, "TrackingNumber")
            or _get(tracking_container, "trackingNumber")
        )
        tracking_numbers = [_to_str(t) for t in tracking_raw if _to_str(t)]

        # Stash the parsed root for debugging.
        raw_response = raw if isinstance(raw, dict) else {}

        return OrderStatusResponse(
            order_number=order_number,
            status_id=status_id,
            status_description=status_description,
            expected_ship_date=expected_ship_date,
            tracking_numbers=tracking_numbers,
            raw_response=raw_response,
        )


# ── Helpers (module-level so tests + scripts can preview the envelope) ─


def _address_to_dict(addr: Any) -> dict[str, Any]:
    """Project an :class:`sanmar.dto.Address` into the SOAP-ready dict
    shape SanMar expects under ``ShipTo`` / ``BillTo``."""
    return {
        "Name": addr.name,
        "CompanyName": addr.company or "",
        "Address1": addr.address_line_1,
        "Address2": addr.address_line_2 or "",
        "City": addr.city,
        "State": addr.state_province,
        "Zip": addr.postal_code,
        "Country": addr.country,
        "Phone": addr.phone,
        "Email": addr.email,
    }


def _line_item_to_dict(li: Any) -> dict[str, Any]:
    return {
        "Style": li.style_number,
        "Color": li.color,
        "Size": li.size,
        "Quantity": li.quantity,
        "LinePrice": (
            str(li.line_price) if li.line_price is not None else None
        ),
    }


def preview_envelope(order: PurchaseOrderInput) -> dict[str, Any]:
    """Return the dict that *would* be sent to ``submitPO`` — handy for
    smoke-test scripts that want to print the envelope without
    actually submitting an order."""
    return {
        "wsVersion": "1.0.0",
        "id": "<masked>",
        "password": "<masked>",
        "PO": {
            "poNumber": order.po_number,
            "customerPONumber": order.customer_po,
            "paymentTerms": order.payment_terms,
            "carrier": _normalize_carrier(order.carrier),
            "requestedShipDate": (
                order.requested_ship_date.isoformat()
                if order.requested_ship_date
                else None
            ),
            "ShipTo": _address_to_dict(order.ship_to),
            "BillTo": _address_to_dict(order.bill_to),
            "LineItemArray": {
                "LineItem": [
                    _line_item_to_dict(li) for li in order.line_items
                ]
            },
        },
    }
