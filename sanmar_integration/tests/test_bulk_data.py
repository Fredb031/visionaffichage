"""Unit tests for the Bulk Data Service v1.0 wrapper."""
from __future__ import annotations

from datetime import datetime, timezone
from unittest.mock import MagicMock, PropertyMock, patch

import pytest

from sanmar.config import Settings
from sanmar.dto import BulkDataResponse, BulkInventoryResponse
from sanmar.exceptions import SanmarApiError
from sanmar.services.bulk_data import BulkDataService


@pytest.fixture
def settings() -> Settings:
    return Settings(
        customer_id="cust-123",
        password="secret-pw",
        media_password="media-pw",
        env="uat",
    )


@pytest.fixture
def service(settings: Settings) -> BulkDataService:
    return BulkDataService(settings)


@pytest.fixture
def since() -> datetime:
    return datetime(2026, 4, 28, 12, 0, 0, tzinfo=timezone.utc)


# ── Tests ──────────────────────────────────────────────────────────────


def test_get_product_data_delta_empty_window_returns_zero_changes(
    service: BulkDataService, since: datetime
) -> None:
    mock_client = MagicMock()
    mock_client.service.getProductDataDelta.return_value = {
        "windowStart": "2026-04-28T12:00:00",
        "windowEnd": "2026-04-29T00:00:00",
        "totalChanges": "0",
        "ProductArray": None,
    }
    with patch.object(
        BulkDataService,
        "client",
        new_callable=PropertyMock,
        return_value=mock_client,
    ):
        result = service.get_product_data_delta(since)

    assert isinstance(result, BulkDataResponse)
    assert result.total_changes == 0
    assert result.products == []
    # Auth + window param sent.
    kwargs = mock_client.service.getProductDataDelta.call_args.kwargs
    assert kwargs["id"] == "cust-123"
    assert "lastModifiedDate" in kwargs


def test_get_product_data_delta_parses_multi_product(
    service: BulkDataService, since: datetime
) -> None:
    mock_client = MagicMock()
    mock_client.service.getProductDataDelta.return_value = {
        "windowStart": "2026-04-28T12:00:00",
        "windowEnd": "2026-04-29T00:00:00",
        "totalChanges": "2",
        "ProductArray": {
            "Product": [
                {
                    "productId": "PC54",
                    "productBrand": "Port & Company",
                    "productName": "Core Cotton Tee",
                    "description": "100% cotton tee",
                    "category": "T-Shirts",
                    "status": "active",
                    "ProductPartArray": {
                        "ProductPart": [
                            {
                                "ColorArray": {
                                    "Color": {"colorName": "Black"}
                                },
                                "labelSize": "L",
                            }
                        ]
                    },
                },
                {
                    "productId": "ST650",
                    "productBrand": "Sport-Tek",
                    "productName": "PosiCharge Polo",
                    "description": "Performance polo",
                    "category": "Polos",
                    "status": "active",
                    "ProductPartArray": {
                        "ProductPart": [
                            {
                                "ColorArray": {
                                    "Color": {"colorName": "Navy"}
                                },
                                "labelSize": "M",
                            }
                        ]
                    },
                },
            ]
        },
    }
    with patch.object(
        BulkDataService,
        "client",
        new_callable=PropertyMock,
        return_value=mock_client,
    ):
        result = service.get_product_data_delta(since)

    assert result.total_changes == 2
    assert len(result.products) == 2
    style_numbers = {p.style_number for p in result.products}
    assert style_numbers == {"PC54", "ST650"}
    # Sanity: window is the parsed datetime, not raw string.
    assert result.window_end.year == 2026


def test_get_inventory_delta_parses_correctly(
    service: BulkDataService, since: datetime
) -> None:
    mock_client = MagicMock()
    mock_client.service.getInventoryDataDelta.return_value = {
        "windowStart": "2026-04-28T12:00:00",
        "windowEnd": "2026-04-29T00:00:00",
        "totalChanges": "1",
        "InventoryArray": {
            "Inventory": [
                {
                    "productId": "PC54",
                    "PartInventoryArray": {
                        "PartInventory": {
                            "partId": "PC54-Black-L",
                            "InventoryLocationArray": {
                                "InventoryLocation": {
                                    "inventoryLocationId": "1",
                                    "inventoryLocationQuantity": {
                                        "Quantity": {"uom": "EA", "value": "55"}
                                    },
                                }
                            },
                        }
                    },
                }
            ]
        },
    }
    with patch.object(
        BulkDataService,
        "client",
        new_callable=PropertyMock,
        return_value=mock_client,
    ):
        result = service.get_inventory_delta(since)

    assert isinstance(result, BulkInventoryResponse)
    assert result.total_changes == 1
    assert len(result.snapshots) == 1
    snap = result.snapshots[0]
    assert snap.style_number == "PC54"
    assert snap.locations[0].quantity == 55
    assert snap.locations[0].warehouse_name == "Vancouver"


def test_bulk_data_fault_maps_to_sanmar_api_error(
    service: BulkDataService, since: datetime
) -> None:
    from sanmar.services import base as base_module

    class FakeFault(Exception):
        def __init__(self, message: str, code: str) -> None:
            super().__init__(message)
            self.message = message
            self.code = code

    mock_client = MagicMock()
    mock_client.service.getProductDataDelta.side_effect = FakeFault(
        "Window too large", code="120"
    )

    with patch.object(base_module, "_ZeepFault", FakeFault), patch.object(
        BulkDataService,
        "client",
        new_callable=PropertyMock,
        return_value=mock_client,
    ):
        with pytest.raises(SanmarApiError) as exc_info:
            service.get_product_data_delta(since)

    assert exc_info.value.code == "120"
    assert exc_info.value.operation == "getProductDataDelta"
