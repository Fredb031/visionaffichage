"""Unit tests for the Order Shipment Notification v2.0.0 wrapper.

Fully zeep-mocked — no network, no installed zeep required.
"""
from __future__ import annotations

from datetime import date
from unittest.mock import MagicMock, PropertyMock, patch

import pytest

from sanmar.config import Settings
from sanmar.dto import ShipmentNotification, TrackingInfo
from sanmar.exceptions import SanmarApiError
from sanmar.services.shipment import ShipmentService


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
def service(settings: Settings) -> ShipmentService:
    return ShipmentService(settings)


# ── Canned responses ───────────────────────────────────────────────────


def _single_shipment_response() -> dict:
    return {
        "ShipmentNotificationArray": {
            "ShipmentNotification": {
                "shipmentId": "SHP-001",
                "poNumber": "PO-2026-001",
                "customerPONumber": "CUST-001",
                "shipDate": "2026-04-20",
                "carrier": "UPS",
                "trackingNumber": "1Z999AA10123456784",
                "ShipTo": {
                    "Name": "Frederick Bouchard",
                    "CompanyName": "Vision Affichage",
                    "Address1": "123 Rue Main",
                    "Address2": "Suite 4",
                    "City": "Montreal",
                    "State": "QC",
                    "Zip": "H2X 1Y4",
                    "Country": "CA",
                    "Phone": "514-555-0123",
                    "Email": "fred@example.com",
                },
                "LineItemArray": {
                    "LineItem": [
                        {
                            "Style": "PC54",
                            "Color": "Black",
                            "Size": "L",
                            "Quantity": "12",
                        }
                    ]
                },
                "weightKg": "3.5",
                "packages": "1",
            }
        }
    }


def _multi_shipment_response() -> dict:
    return {
        "ShipmentNotificationArray": {
            "ShipmentNotification": [
                {
                    "shipmentId": "SHP-A",
                    "poNumber": "PO-2026-002",
                    "carrier": "PUR",
                    "trackingNumber": "PRL12345",
                    "shipDate": "2026-04-19",
                    "LineItemArray": {
                        "LineItem": {
                            "Style": "PC54",
                            "Color": "Red",
                            "Size": "M",
                            "Quantity": "6",
                        }
                    },
                },
                {
                    "shipmentId": "SHP-B",
                    "poNumber": "PO-2026-002",
                    "carrier": "PUR",
                    "trackingNumber": "PRL67890",
                    "shipDate": "2026-04-21",
                    "LineItemArray": {
                        "LineItem": {
                            "Style": "PC54",
                            "Color": "Red",
                            "Size": "L",
                            "Quantity": "4",
                        }
                    },
                },
            ]
        }
    }


# ── Tests ──────────────────────────────────────────────────────────────


def test_get_shipment_notifications_parses_single(
    service: ShipmentService,
) -> None:
    mock_client = MagicMock()
    mock_client.service.getOrderShipmentNotification.return_value = (
        _single_shipment_response()
    )
    with patch.object(
        ShipmentService,
        "client",
        new_callable=PropertyMock,
        return_value=mock_client,
    ):
        result = service.get_shipment_notifications(po_number="PO-2026-001")

    assert isinstance(result, list)
    assert len(result) == 1
    n = result[0]
    assert isinstance(n, ShipmentNotification)
    assert n.po_number == "PO-2026-001"
    assert n.carrier == "UPS"
    assert n.tracking_number == "1Z999AA10123456784"
    assert n.ship_date == date(2026, 4, 20)
    assert n.ship_to_address is not None
    assert n.ship_to_address.city == "Montreal"
    assert len(n.line_items) == 1
    assert n.line_items[0].style_number == "PC54"

    # Auth + queryType propagated.
    kwargs = mock_client.service.getOrderShipmentNotification.call_args.kwargs
    assert kwargs["id"] == "cust-123"
    assert kwargs["queryType"] == 1
    assert kwargs["referenceNumber"] == "PO-2026-001"


def test_get_shipment_notifications_handles_multiple(
    service: ShipmentService,
) -> None:
    mock_client = MagicMock()
    mock_client.service.getOrderShipmentNotification.return_value = (
        _multi_shipment_response()
    )
    with patch.object(
        ShipmentService,
        "client",
        new_callable=PropertyMock,
        return_value=mock_client,
    ):
        result = service.get_shipment_notifications(po_number="PO-2026-002")

    assert len(result) == 2
    assert result[0].tracking_number == "PRL12345"
    assert result[1].tracking_number == "PRL67890"


def test_get_tracking_info_filters_to_tracking_only_fields(
    service: ShipmentService,
) -> None:
    mock_client = MagicMock()
    mock_client.service.getOrderShipmentNotification.return_value = (
        _single_shipment_response()
    )
    with patch.object(
        ShipmentService,
        "client",
        new_callable=PropertyMock,
        return_value=mock_client,
    ):
        tracking = service.get_tracking_info("PO-2026-001")

    assert isinstance(tracking, list)
    assert len(tracking) == 1
    t = tracking[0]
    assert isinstance(t, TrackingInfo)
    assert t.po_number == "PO-2026-001"
    assert t.tracking_number == "1Z999AA10123456784"
    assert t.carrier == "UPS"
    assert t.ship_date == date(2026, 4, 20)
    # TrackingInfo must not leak line items / addresses.
    assert not hasattr(t, "line_items")


def test_empty_response_returns_empty_list(
    service: ShipmentService,
) -> None:
    """No shipments matched → empty list, not a crash."""
    mock_client = MagicMock()
    mock_client.service.getOrderShipmentNotification.return_value = {
        "ShipmentNotificationArray": None
    }
    with patch.object(
        ShipmentService,
        "client",
        new_callable=PropertyMock,
        return_value=mock_client,
    ):
        result = service.get_shipment_notifications(po_number="PO-NONE")

    assert result == []


def test_shipment_fault_maps_to_sanmar_api_error(
    service: ShipmentService,
) -> None:
    from sanmar.services import base as base_module

    class FakeFault(Exception):
        def __init__(self, message: str, code: str) -> None:
            super().__init__(message)
            self.message = message
            self.code = code

    mock_client = MagicMock()
    mock_client.service.getOrderShipmentNotification.side_effect = FakeFault(
        "Auth failed", code="100"
    )

    with patch.object(base_module, "_ZeepFault", FakeFault), patch.object(
        ShipmentService,
        "client",
        new_callable=PropertyMock,
        return_value=mock_client,
    ):
        with pytest.raises(SanmarApiError) as exc_info:
            service.get_shipment_notifications(po_number="PO-X")

    assert exc_info.value.code == "100"
    assert exc_info.value.operation == "getOrderShipmentNotification"
