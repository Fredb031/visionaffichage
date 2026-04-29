"""SanMar Invoice Service v1.0.0 wrapper.

Used for AR reconciliation — pulls invoices for SanMar-issued POs so
the local AP system can match against vendor bills before paying.

Status is auto-derived rather than relying on SanMar's ``status``
string, which is occasionally absent or stale:

* ``balance_due == 0``                              → ``paid``
* ``balance_due > 0`` and ``due_date < today``      → ``overdue``
* ``balance_due > 0`` and ``balance_due < total``   → ``partial``
* otherwise                                          → ``open``
"""
from __future__ import annotations

from datetime import date, datetime
from decimal import Decimal, InvalidOperation
from typing import Any, ClassVar, Literal, Optional

from sanmar.dto import Invoice, InvoiceLineItem
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


def _to_decimal(value: Any, default: str = "0") -> Decimal:
    if value is None:
        return Decimal(default)
    if isinstance(value, Decimal):
        return value
    try:
        return Decimal(str(value))
    except (InvalidOperation, ValueError):
        return Decimal(default)


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
    if value is None:
        return None
    if isinstance(value, date) and not isinstance(value, datetime):
        return value
    if isinstance(value, datetime):
        return value.date()
    s = str(value).strip()
    if not s:
        return None
    for fmt in ("%Y-%m-%d", "%Y-%m-%dT%H:%M:%S", "%Y-%m-%dT%H:%M:%SZ"):
        try:
            return datetime.strptime(s, fmt).date()
        except ValueError:
            continue
    try:
        return datetime.fromisoformat(s.replace("Z", "+00:00")).date()
    except ValueError:
        return None


def _derive_status(
    balance_due: Decimal,
    total: Decimal,
    due_date: Optional[date],
    today: Optional[date] = None,
) -> Literal["paid", "open", "overdue", "partial"]:
    """Compute invoice status from balance/total/due_date.

    ``today`` is overridable for deterministic unit tests."""
    today = today or date.today()
    if balance_due <= Decimal("0"):
        return "paid"
    if due_date is not None and due_date < today:
        return "overdue"
    if balance_due < total:
        return "partial"
    return "open"


class InvoiceService(SanmarServiceBase):
    """Wrapper around the SanMar Invoice Service v1.0.0."""

    wsdl_path: ClassVar[str] = "invoice/v1/?wsdl"

    def get_invoice(
        self,
        invoice_number: str,
        *,
        today: Optional[date] = None,
    ) -> Invoice:
        """Fetch one invoice by number.

        ``today`` overrides the date used to compute ``overdue`` status
        — pass it from tests to avoid wall-clock flake."""
        params: dict[str, Any] = {
            **self.auth_dict(),
            "wsVersion": "1.0.0",
            "invoiceNumber": invoice_number,
        }
        raw = self._call("getInvoice", **params)
        return self._parse_invoice(raw, invoice_number, today=today)

    def get_open_invoices(
        self,
        since: Optional[datetime] = None,
        *,
        today: Optional[date] = None,
    ) -> list[Invoice]:
        """List unpaid invoices, optionally narrowed to a starting date.

        Uses ``getInvoiceList`` with ``status=open`` per the spec; the
        response wrapper hands back a list of invoices we project one
        at a time through :meth:`_parse_invoice`."""
        params: dict[str, Any] = {
            **self.auth_dict(),
            "wsVersion": "1.0.0",
            "status": "open",
        }
        if since is not None:
            params["lastUpdateDate"] = since.isoformat()

        raw = self._call("getInvoiceList", **params)
        return self._parse_invoice_list(raw, today=today)

    @staticmethod
    def _parse_invoice(
        raw: Any,
        fallback_number: str,
        *,
        today: Optional[date] = None,
    ) -> Invoice:
        root = (
            _get(raw, "GetInvoiceResponse")
            or _get(raw, "getInvoiceResponse")
            or _get(raw, "Invoice")
            or _get(raw, "invoice")
            or raw
        )

        # The "Invoice" key can be one level deeper after unwrapping the
        # outer response envelope.
        inv = _get(root, "Invoice") or _get(root, "invoice") or root

        line_items_container = (
            _get(inv, "LineItemArray")
            or _get(inv, "lineItemArray")
        )
        li_nodes = _to_list(
            _get(line_items_container, "LineItem")
            or _get(line_items_container, "lineItem")
        )
        line_items: list[InvoiceLineItem] = []
        for li in li_nodes:
            quantity = _to_int(_get(li, "Quantity") or _get(li, "quantity"))
            unit_price = _to_decimal(_get(li, "UnitPrice") or _get(li, "unitPrice"))
            line_total = _to_decimal(
                _get(li, "LineTotal") or _get(li, "lineTotal")
            )
            line_items.append(
                InvoiceLineItem(
                    style_number=_to_str(
                        _get(li, "Style")
                        or _get(li, "styleNumber")
                        or _get(li, "style")
                    ),
                    color=_to_str(_get(li, "Color") or _get(li, "color")),
                    size=_to_str(_get(li, "Size") or _get(li, "size")),
                    quantity=quantity,
                    unit_price=unit_price,
                    line_total=line_total,
                )
            )

        subtotal = _to_decimal(_get(inv, "subtotal") or _get(inv, "Subtotal"))
        tax = _to_decimal(_get(inv, "tax") or _get(inv, "Tax"))
        shipping = _to_decimal(_get(inv, "shipping") or _get(inv, "Shipping"))
        total = _to_decimal(_get(inv, "total") or _get(inv, "Total"))
        balance_due = _to_decimal(
            _get(inv, "balanceDue") or _get(inv, "BalanceDue")
        )
        due_date = _to_date(_get(inv, "dueDate") or _get(inv, "DueDate"))

        status = _derive_status(balance_due, total, due_date, today=today)

        return Invoice(
            invoice_number=_to_str(
                _get(inv, "invoiceNumber") or _get(inv, "InvoiceNumber"),
                default=fallback_number,
            )
            or fallback_number,
            po_number=_to_str(
                _get(inv, "poNumber") or _get(inv, "PONumber")
            ),
            invoice_date=_to_date(
                _get(inv, "invoiceDate") or _get(inv, "InvoiceDate")
            ),
            due_date=due_date,
            line_items=line_items,
            subtotal=subtotal,
            tax=tax,
            shipping=shipping,
            total=total,
            balance_due=balance_due,
            status=status,
        )

    @staticmethod
    def _parse_invoice_list(
        raw: Any,
        *,
        today: Optional[date] = None,
    ) -> list[Invoice]:
        root = (
            _get(raw, "GetInvoiceListResponse")
            or _get(raw, "getInvoiceListResponse")
            or raw
        )
        arr_container = (
            _get(root, "InvoiceArray")
            or _get(root, "invoiceArray")
            or root
        )
        nodes = _to_list(
            _get(arr_container, "Invoice") or _get(arr_container, "invoice")
        )
        if not nodes:
            return []
        return [
            InvoiceService._parse_invoice(
                {"Invoice": n}, fallback_number="", today=today
            )
            for n in nodes
        ]
