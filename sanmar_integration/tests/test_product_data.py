"""Unit tests for the Product Data v2.0.0 wrapper.

These tests fully mock the zeep client — no network, no zeep install
required. We patch `ProductDataService.client` with a `Mock` whose
`.service.<op>` returns canned dict responses shaped like what zeep
would produce against the real WSDL.
"""
from __future__ import annotations

from unittest.mock import MagicMock, PropertyMock, patch

import pytest

from sanmar.config import Settings
from sanmar.dto import ActivePart, ProductResponse, SellableVariant
from sanmar.services.base import SanmarApiError, mask_password
from sanmar.services.product_data import ProductDataService


# ── Fixtures ───────────────────────────────────────────────────────────


@pytest.fixture
def settings() -> Settings:
    """Settings populated with non-placeholder credentials so the service
    treats this as a fully-configured environment."""
    return Settings(
        customer_id="cust-123",
        password="secret-pw",
        media_password="media-pw",
        env="uat",
    )


@pytest.fixture
def service(settings: Settings) -> ProductDataService:
    return ProductDataService(settings)


# ── mask_password ──────────────────────────────────────────────────────


def test_mask_password_replaces_password_field() -> None:
    masked = mask_password({"id": "abc", "password": "hunter2"})
    assert masked == {"id": "abc", "password": "***"}


def test_mask_password_does_not_mutate_input() -> None:
    original = {"id": "abc", "password": "hunter2"}
    mask_password(original)
    assert original["password"] == "hunter2"


def test_mask_password_handles_media_password_too() -> None:
    masked = mask_password({"mediaPassword": "x", "other": "y"})
    assert masked["mediaPassword"] == "***"
    assert masked["other"] == "y"


# ── SanmarApiError ─────────────────────────────────────────────────────


def test_sanmar_api_error_str_format() -> None:
    err = SanmarApiError("boom", code="100", operation="getProduct")
    assert str(err) == "[100] boom (operation: getProduct)"


# ── get_product ────────────────────────────────────────────────────────


def _canned_get_product_response() -> dict:
    return {
        "Product": {
            "productId": "NF0A529K",
            "productBrand": "The North Face",
            "productName": "Apex Barrier Soft Shell Jacket",
            "description": "Polyester soft-shell with DWR finish.",
            "category": "Outerwear",
            "status": "active",
            "ProductPartArray": {
                "ProductPart": [
                    {
                        "partId": "NF0A529K-Black-M",
                        "labelSize": "M",
                        "ColorArray": {
                            "Color": {"standardColorName": "Black"}
                        },
                        "ColorFrontImage": "https://cdn.example/nf-black.jpg",
                    },
                    {
                        "partId": "NF0A529K-Navy-L",
                        "labelSize": "L",
                        "ColorArray": {
                            "Color": {"standardColorName": "Navy"}
                        },
                    },
                ]
            },
        }
    }


def test_get_product_parses_response(service: ProductDataService) -> None:
    mock_client = MagicMock()
    mock_client.service.getProduct.return_value = _canned_get_product_response()

    with patch.object(
        ProductDataService,
        "client",
        new_callable=PropertyMock,
        return_value=mock_client,
    ):
        result = service.get_product("NF0A529K")

    assert isinstance(result, ProductResponse)
    assert result.style_number == "NF0A529K"
    assert result.brand_name == "The North Face"
    assert result.product_name == "Apex Barrier Soft Shell Jacket"
    assert result.category == "Outerwear"
    assert result.list_of_colors == ["Black", "Navy"]
    assert result.list_of_sizes == ["M", "L"]
    assert result.image_url == "https://cdn.example/nf-black.jpg"

    # Auth params propagated correctly with localization defaults.
    call_kwargs = mock_client.service.getProduct.call_args.kwargs
    assert call_kwargs["id"] == "cust-123"
    assert call_kwargs["password"] == "secret-pw"
    assert call_kwargs["productId"] == "NF0A529K"
    assert call_kwargs["localizationCountry"] == "CA"
    assert call_kwargs["localizationLanguage"] == "EN"


def test_get_product_passes_color_and_size(
    service: ProductDataService,
) -> None:
    mock_client = MagicMock()
    mock_client.service.getProduct.return_value = (
        _canned_get_product_response()
    )

    with patch.object(
        ProductDataService,
        "client",
        new_callable=PropertyMock,
        return_value=mock_client,
    ):
        service.get_product("NF0A529K", color="Black", size="M")

    kwargs = mock_client.service.getProduct.call_args.kwargs
    assert kwargs["color"] == "Black"
    assert kwargs["size"] == "M"


# ── get_product_sellable ───────────────────────────────────────────────


def test_get_product_sellable_parses_partid_regex(
    service: ProductDataService,
) -> None:
    """The brief's anchor case: 'PC54(Black,LT,Adult)' must split into
    ('PC54', 'Black', 'LT')."""
    mock_client = MagicMock()
    mock_client.service.getProductSellable.return_value = {
        "ProductSellableArray": {
            "ProductSellable": [
                {"partId": "PC54(Black,LT,Adult)"},
                {"partId": "PC54(Navy,XL,)"},
                {"partId": "PC54(Red,S,C)"},
            ]
        }
    }

    with patch.object(
        ProductDataService,
        "client",
        new_callable=PropertyMock,
        return_value=mock_client,
    ):
        rows = service.get_product_sellable("PC54")

    assert len(rows) == 3
    assert all(isinstance(r, SellableVariant) for r in rows)

    first = rows[0]
    assert first.part_id == "PC54(Black,LT,Adult)"
    assert first.style_number == "PC54"
    assert first.color == "Black"
    assert first.size == "LT"

    assert rows[1].style_number == "PC54"
    assert rows[1].color == "Navy"
    assert rows[1].size == "XL"


def test_get_product_sellable_handles_single_item(
    service: ProductDataService,
) -> None:
    """zeep returns a bare object (not a list) when N=1."""
    mock_client = MagicMock()
    mock_client.service.getProductSellable.return_value = {
        "ProductSellableArray": {
            "ProductSellable": {"partId": "ATC1000(Black,M,)"}
        }
    }

    with patch.object(
        ProductDataService,
        "client",
        new_callable=PropertyMock,
        return_value=mock_client,
    ):
        rows = service.get_product_sellable("ATC1000")

    assert len(rows) == 1
    assert rows[0].style_number == "ATC1000"
    assert rows[0].color == "Black"
    assert rows[0].size == "M"


# ── get_all_active_parts ───────────────────────────────────────────────


def test_get_all_active_parts(service: ProductDataService) -> None:
    mock_client = MagicMock()
    mock_client.service.getAllActiveParts.return_value = {
        "PartArray": {
            "Part": [
                {"partId": "PC54(Black,M,)", "sku": "PC54-BLK-M"},
                {"partId": "PC54(Navy,L,)", "sku": "PC54-NVY-L"},
            ]
        }
    }

    with patch.object(
        ProductDataService,
        "client",
        new_callable=PropertyMock,
        return_value=mock_client,
    ):
        rows = service.get_all_active_parts()

    assert len(rows) == 2
    assert all(isinstance(r, ActivePart) for r in rows)
    assert rows[0].style_number == "PC54"
    assert rows[0].color == "Black"
    assert rows[0].size == "M"
    assert rows[0].sku == "PC54-BLK-M"


# ── Fault → SanmarApiError mapping ─────────────────────────────────────


def test_zeep_fault_maps_to_sanmar_api_error(
    service: ProductDataService,
) -> None:
    """A simulated zeep.Fault must surface as SanmarApiError so callers
    don't have to depend on zeep's exception hierarchy."""
    # We can't import zeep in tests, but `_call` catches whatever class
    # `_ZeepFault` was bound to at import time. Patch that to a known
    # exception type, then make the operation raise it.
    from sanmar.services import base as base_module

    class FakeFault(Exception):
        def __init__(self, message: str, code: str) -> None:
            super().__init__(message)
            self.message = message
            self.code = code

    mock_client = MagicMock()
    mock_client.service.getProduct.side_effect = FakeFault(
        "Auth failed", code="100"
    )

    with patch.object(base_module, "_ZeepFault", FakeFault), patch.object(
        ProductDataService,
        "client",
        new_callable=PropertyMock,
        return_value=mock_client,
    ):
        with pytest.raises(SanmarApiError) as exc_info:
            service.get_product("NF0A529K")

    err = exc_info.value
    assert err.code == "100"
    assert err.operation == "getProduct"
    assert "Auth failed" in err.message
