"""Unit tests for the Invoice Service v1.0.0 wrapper."""
from __future__ import annotations

from datetime import date
from decimal import Decimal
from unittest.mock import MagicMock, PropertyMock, patch

import pytest

from sanmar.config import Settings
from sanmar.dto import Invoice
from sanmar.exceptions import SanmarApiError
from sanmar.services.invoice import InvoiceService


@pytest.fixture
def settings() -> Settings:
    return Settings(
        customer_id="cust-123",
        password="secret-pw",
        media_password="media-pw",
        env="uat",
    )


@pytest.fixture
def service(settings: Settings) -> InvoiceService:
    return InvoiceService(settings)


# ── Canned responses ───────────────────────────────────────────────────


def _paid_invoice_response() -> dict:
    return {
        "Invoice": {
            "invoiceNumber": "INV-1001",
            "poNumber": "PO-2026-001",
            "invoiceDate": "2026-03-15",
            "dueDate": "2026-04-14",
            "LineItemArray": {
                "LineItem": [
                    {
                        "Style": "PC54",
                        "Color": "Black",
                        "Size": "L",
                        "Quantity": "10",
                        "UnitPrice": "9.99",
                        "LineTotal": "99.90",
                    }
                ]
            },
            "subtotal": "99.90",
            "tax": "12.99",
            "shipping": "8.00",
            "total": "120.89",
            "balanceDue": "0",
        }
    }


def _open_invoice_response() -> dict:
    return {
        "Invoice": {
            "invoiceNumber": "INV-1002",
            "poNumber": "PO-2026-002",
            "invoiceDate": "2026-04-20",
            "dueDate": "2026-05-20",
            "LineItemArray": {
                "LineItem": [
                    {
                        "Style": "PC54",
                        "Color": "Red",
                        "Size": "M",
                        "Quantity": "6",
                        "UnitPrice": "10.00",
                        "LineTotal": "60.00",
                    }
                ]
            },
            "subtotal": "60.00",
            "tax": "7.80",
            "shipping": "5.00",
            "total": "72.80",
            "balanceDue": "72.80",
        }
    }


def _overdue_invoice_response() -> dict:
    return {
        "Invoice": {
            "invoiceNumber": "INV-1003",
            "poNumber": "PO-2026-003",
            "invoiceDate": "2026-01-15",
            "dueDate": "2026-02-14",
            "LineItemArray": {
                "LineItem": [
                    {
                        "Style": "PC54",
                        "Color": "White",
                        "Size": "S",
                        "Quantity": "5",
                        "UnitPrice": "8.50",
                        "LineTotal": "42.50",
                    }
                ]
            },
            "subtotal": "42.50",
            "tax": "5.53",
            "shipping": "0",
            "total": "48.03",
            "balanceDue": "48.03",
        }
    }


# ── Tests ──────────────────────────────────────────────────────────────


def test_get_invoice_parses_paid_invoice(service: InvoiceService) -> None:
    mock_client = MagicMock()
    mock_client.service.getInvoice.return_value = _paid_invoice_response()
    with patch.object(
        InvoiceService,
        "client",
        new_callable=PropertyMock,
        return_value=mock_client,
    ):
        result = service.get_invoice("INV-1001", today=date(2026, 4, 15))

    assert isinstance(result, Invoice)
    assert result.invoice_number == "INV-1001"
    assert result.po_number == "PO-2026-001"
    assert result.balance_due == Decimal("0")
    assert result.status == "paid"
    assert result.total == Decimal("120.89")


def test_get_invoice_parses_open_invoice(service: InvoiceService) -> None:
    mock_client = MagicMock()
    mock_client.service.getInvoice.return_value = _open_invoice_response()
    # Today is BEFORE due_date so it's just open.
    with patch.object(
        InvoiceService,
        "client",
        new_callable=PropertyMock,
        return_value=mock_client,
    ):
        result = service.get_invoice("INV-1002", today=date(2026, 4, 25))

    assert result.balance_due == Decimal("72.80")
    assert result.status == "open"
    assert len(result.line_items) == 1


def test_get_invoice_overdue_status_when_due_date_past(
    service: InvoiceService,
) -> None:
    mock_client = MagicMock()
    mock_client.service.getInvoice.return_value = _overdue_invoice_response()
    # Today is well past due_date 2026-02-14.
    with patch.object(
        InvoiceService,
        "client",
        new_callable=PropertyMock,
        return_value=mock_client,
    ):
        result = service.get_invoice("INV-1003", today=date(2026, 4, 29))

    assert result.balance_due > Decimal("0")
    assert result.status == "overdue"


def test_invoice_line_total_equals_unit_price_times_quantity(
    service: InvoiceService,
) -> None:
    """For receipt-style (no discount) invoices the arithmetic must
    agree exactly. Decimal-only — never float."""
    mock_client = MagicMock()
    mock_client.service.getInvoice.return_value = _paid_invoice_response()
    with patch.object(
        InvoiceService,
        "client",
        new_callable=PropertyMock,
        return_value=mock_client,
    ):
        result = service.get_invoice("INV-1001", today=date(2026, 4, 15))

    li = result.line_items[0]
    assert li.line_total == li.unit_price * li.quantity
    # And explicitly: 9.99 * 10 = 99.90 to the cent.
    assert li.line_total == Decimal("99.90")


def test_invoice_fault_maps_to_sanmar_api_error(
    service: InvoiceService,
) -> None:
    from sanmar.services import base as base_module

    class FakeFault(Exception):
        def __init__(self, message: str, code: str) -> None:
            super().__init__(message)
            self.message = message
            self.code = code

    mock_client = MagicMock()
    mock_client.service.getInvoice.side_effect = FakeFault(
        "Not authorized", code="100"
    )

    with patch.object(base_module, "_ZeepFault", FakeFault), patch.object(
        InvoiceService,
        "client",
        new_callable=PropertyMock,
        return_value=mock_client,
    ):
        with pytest.raises(SanmarApiError) as exc_info:
            service.get_invoice("INV-9999")

    assert exc_info.value.code == "100"
    assert exc_info.value.operation == "getInvoice"


def test_get_open_invoices_parses_list(service: InvoiceService) -> None:
    mock_client = MagicMock()
    mock_client.service.getInvoiceList.return_value = {
        "InvoiceArray": {
            "Invoice": [
                _open_invoice_response()["Invoice"],
                _overdue_invoice_response()["Invoice"],
            ]
        }
    }
    with patch.object(
        InvoiceService,
        "client",
        new_callable=PropertyMock,
        return_value=mock_client,
    ):
        result = service.get_open_invoices(today=date(2026, 4, 29))

    assert len(result) == 2
    assert {inv.status for inv in result} == {"open", "overdue"}
