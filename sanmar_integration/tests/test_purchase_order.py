"""Unit tests for the Purchase Order Service v1.0.0 wrapper.

Covers pre-flight validation (forbidden chars, postal codes, carrier
allowlist) and the asymmetric ``SendPOResponse`` wrapper parsing —
including the fall-back to ``SubmitPOOrderResponse`` for forward-compat.
"""
from __future__ import annotations

from decimal import Decimal
from unittest.mock import MagicMock, PropertyMock, patch

import pytest

from sanmar.config import Settings
from sanmar.dto import (
    Address,
    LineItem,
    PurchaseOrderInput,
    PurchaseOrderResponse,
)
from sanmar.exceptions import (
    ForbiddenCharError,
    InvalidCarrierError,
    InvalidPostalCodeError,
    SanmarApiError,
)
from sanmar.services.purchase_order import PurchaseOrderService


# ── Fixtures ───────────────────────────────────────────────────────────


@pytest.fixture
def settings() -> Settings:
    return Settings(
        customer_id="cust-123",
        password="secret-pw",
        media_password="media-pw",
        env="uat",
    )


@pytest.fixture
def service(settings: Settings) -> PurchaseOrderService:
    return PurchaseOrderService(settings)


def _good_address(**overrides) -> Address:
    base = dict(
        name="Frederick Bouchard",
        company="Vision Affichage",
        address_line_1="123 Rue Main",
        address_line_2="Suite 4",
        city="Montreal",
        state_province="QC",
        postal_code="H2X 1Y4",
        country="CA",
        phone="514-555-0123",
        email="fred@example.com",
    )
    base.update(overrides)
    return Address(**base)


def _good_order(**overrides) -> PurchaseOrderInput:
    base = dict(
        po_number="PO-2026-001",
        customer_po="CUST-001",
        ship_to=_good_address(),
        bill_to=_good_address(),
        line_items=[
            LineItem(
                style_number="PC54",
                color="Black",
                size="L",
                quantity=12,
                line_price=Decimal("9.99"),
            )
        ],
        carrier="UPS",
    )
    base.update(overrides)
    return PurchaseOrderInput(**base)


# ── Forbidden char validation ──────────────────────────────────────────


def test_submit_order_rejects_lt_in_address_line_1(
    service: PurchaseOrderService,
) -> None:
    bad = _good_order(ship_to=_good_address(address_line_1="123 Main <script>"))
    with pytest.raises(ForbiddenCharError) as exc:
        service.submit_order(bad)
    assert exc.value.char == "<"
    assert "address_line_1" in exc.value.field
    assert exc.value.code == "210"


@pytest.mark.parametrize(
    "field,value,bad_char",
    [
        ("name", "Bad <Name>", "<"),
        ("company", "Co & Sons", "&"),
        ("address_line_1", '123 "Quoted" St', '"'),
        ("address_line_2", "Apt 'B'", "'"),
        ("city", "Mon>real", ">"),
    ],
)
def test_submit_order_rejects_forbidden_chars_in_each_field(
    service: PurchaseOrderService,
    field: str,
    value: str,
    bad_char: str,
) -> None:
    bad = _good_order(ship_to=_good_address(**{field: value}))
    with pytest.raises(ForbiddenCharError) as exc:
        service.submit_order(bad)
    assert exc.value.char == bad_char
    assert field in exc.value.field


# ── Postal code validation ─────────────────────────────────────────────


@pytest.mark.parametrize("postal", ["H2X 1Y4", "H2X1Y4", "k1a 0b1"])
def test_postal_validation_accepts_canadian_codes(
    service: PurchaseOrderService, postal: str
) -> None:
    """Both spaced and unspaced Canadian formats; case-insensitive
    on the alpha positions."""
    order = _good_order(
        ship_to=_good_address(country="CA", postal_code=postal),
        bill_to=_good_address(country="CA", postal_code=postal),
    )
    # We only care that validation passes — short-circuit before the SOAP
    # call by mocking the client to return the minimal happy response.
    mock_client = MagicMock()
    mock_client.service.submitPO.return_value = {
        "SendPOResponse": {"transactionId": "999"}
    }
    with patch.object(
        PurchaseOrderService,
        "client",
        new_callable=PropertyMock,
        return_value=mock_client,
    ):
        result = service.submit_order(order)
    assert result.transaction_id == 999


def test_postal_validation_rejects_us_zip_for_canadian_country(
    service: PurchaseOrderService,
) -> None:
    order = _good_order(
        ship_to=_good_address(country="CA", postal_code="12345"),
    )
    with pytest.raises(InvalidPostalCodeError) as exc:
        service.submit_order(order)
    assert exc.value.country == "CA"
    assert exc.value.code == "220"


@pytest.mark.parametrize("postal", ["12345", "12345-6789"])
def test_postal_validation_accepts_us_zips(
    service: PurchaseOrderService, postal: str
) -> None:
    order = _good_order(
        ship_to=_good_address(country="US", postal_code=postal, state_province="WA"),
        bill_to=_good_address(country="US", postal_code=postal, state_province="WA"),
    )
    mock_client = MagicMock()
    mock_client.service.submitPO.return_value = {
        "SendPOResponse": {"transactionId": "1"}
    }
    with patch.object(
        PurchaseOrderService,
        "client",
        new_callable=PropertyMock,
        return_value=mock_client,
    ):
        service.submit_order(order)


def test_postal_validation_rejects_garbage_us_zip(
    service: PurchaseOrderService,
) -> None:
    order = _good_order(
        ship_to=_good_address(country="US", postal_code="ABC123", state_province="WA"),
    )
    with pytest.raises(InvalidPostalCodeError):
        service.submit_order(order)


# ── Carrier validation ────────────────────────────────────────────────


def test_carrier_normalizes_lowercase_to_upper(
    service: PurchaseOrderService,
) -> None:
    order = _good_order(carrier="ups")
    mock_client = MagicMock()
    mock_client.service.submitPO.return_value = {
        "SendPOResponse": {"transactionId": "1"}
    }
    with patch.object(
        PurchaseOrderService,
        "client",
        new_callable=PropertyMock,
        return_value=mock_client,
    ):
        service.submit_order(order)
    sent_po = mock_client.service.submitPO.call_args.kwargs["PO"]
    assert sent_po["carrier"] == "UPS"


def test_carrier_rejects_unknown(
    service: PurchaseOrderService,
) -> None:
    order = _good_order(carrier="DHL")
    with pytest.raises(InvalidCarrierError) as exc:
        service.submit_order(order)
    assert exc.value.code == "230"
    assert "DHL" in str(exc.value)


# ── Order status query type ───────────────────────────────────────────


def test_get_order_status_rejects_query_type_3(
    service: PurchaseOrderService,
) -> None:
    with pytest.raises(ValueError, match="queryType=3"):
        service.get_order_status(po_number="PO-1", query_type=3)


# ── SendPOResponse wrapper parsing ────────────────────────────────────


def test_submit_order_parses_send_po_response_wrapper(
    service: PurchaseOrderService,
) -> None:
    """SanMar returns `<SendPOResponse>` even though the request is
    `SubmitPOOrderRequest`. We must read the asymmetric wire name."""
    order = _good_order()
    mock_client = MagicMock()
    mock_client.service.submitPO.return_value = {
        "SendPOResponse": {
            "transactionId": "55512",
            "poNumber": "PO-2026-001",
            "ServiceMessageArray": {
                "ServiceMessage": {
                    "code": "100",
                    "description": "Order accepted",
                    "severity": "Information",
                }
            },
        }
    }
    with patch.object(
        PurchaseOrderService,
        "client",
        new_callable=PropertyMock,
        return_value=mock_client,
    ):
        result = service.submit_order(order)

    assert isinstance(result, PurchaseOrderResponse)
    assert result.transaction_id == 55512
    assert result.success is True
    assert "Order accepted" in result.message


def test_submit_order_falls_back_to_submit_po_order_response(
    service: PurchaseOrderService,
) -> None:
    """Forward-compat: if PromoStandards aligns the names later and the
    response wrapper becomes `SubmitPOOrderResponse`, we must still
    parse it."""
    order = _good_order()
    mock_client = MagicMock()
    mock_client.service.submitPO.return_value = {
        "SubmitPOOrderResponse": {
            "transactionId": "777",
            "poNumber": "PO-2026-001",
        }
    }
    with patch.object(
        PurchaseOrderService,
        "client",
        new_callable=PropertyMock,
        return_value=mock_client,
    ):
        result = service.submit_order(order)

    assert result.transaction_id == 777


def test_submit_order_marks_failure_on_error_severity(
    service: PurchaseOrderService,
) -> None:
    order = _good_order()
    mock_client = MagicMock()
    mock_client.service.submitPO.return_value = {
        "SendPOResponse": {
            "transactionId": "0",
            "ServiceMessageArray": {
                "ServiceMessage": {
                    "code": "210",
                    "description": "Invalid character",
                    "severity": "Error",
                }
            },
        }
    }
    with patch.object(
        PurchaseOrderService,
        "client",
        new_callable=PropertyMock,
        return_value=mock_client,
    ):
        result = service.submit_order(order)

    assert result.transaction_id == 0
    assert result.success is False
    assert "Invalid character" in result.message


# ── Fault → SanmarApiError ────────────────────────────────────────────


def test_submit_order_fault_maps_to_sanmar_api_error(
    service: PurchaseOrderService,
) -> None:
    from sanmar.services import base as base_module

    class FakeFault(Exception):
        def __init__(self, message: str, code: str) -> None:
            super().__init__(message)
            self.message = message
            self.code = code

    order = _good_order()
    mock_client = MagicMock()
    mock_client.service.submitPO.side_effect = FakeFault(
        "Auth failed", code="100"
    )

    with patch.object(base_module, "_ZeepFault", FakeFault), patch.object(
        PurchaseOrderService,
        "client",
        new_callable=PropertyMock,
        return_value=mock_client,
    ):
        with pytest.raises(SanmarApiError) as exc_info:
            service.submit_order(order)

    assert exc_info.value.code == "100"
    assert exc_info.value.operation == "submitPO"
