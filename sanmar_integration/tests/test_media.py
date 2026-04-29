"""Unit tests for the Media Content v1.1.0 wrapper.

Mocks the zeep client end-to-end. Verifies the three SanMar quirks
documented in :mod:`sanmar.services.media`:

* multi-URL split on ``\\n`` inside one ``<url>`` element
* bilingual ``"FR: ... / EN: ..."`` description parser (with raw
  fallback)
* the separate-media-password override on :meth:`auth_dict`
"""
from __future__ import annotations

from unittest.mock import MagicMock, PropertyMock, patch

import pytest

from sanmar.config import Settings
from sanmar.dto import MediaItem, MediaResponse
from sanmar.services.base import SanmarApiError
from sanmar.services.media import MediaContentService, _parse_bilingual


# ── Fixtures ───────────────────────────────────────────────────────────


@pytest.fixture
def settings() -> Settings:
    return Settings(
        customer_id="cust-123",
        password="regular-pw",
        media_password="MEDIA-PW-XYZ",
        env="uat",
    )


@pytest.fixture
def service(settings: Settings) -> MediaContentService:
    return MediaContentService(settings)


# ── Canned responses ───────────────────────────────────────────────────


def _single_url_response() -> dict:
    return {
        "productId": "NF0A529K",
        "MediaContentArray": {
            "MediaContent": {
                "url": "https://cdn.sanmar.com/img/NF0A529K_front.jpg",
                "mediaType": "Image",
                "description": "Front view",
            }
        },
    }


def _multi_url_response() -> dict:
    """One MediaContent node, but `url` packs three CDN URLs separated
    by newlines — the SanMar quirk we're guarding against."""
    return {
        "productId": "NF0A529K",
        "MediaContentArray": {
            "MediaContent": {
                "url": (
                    "https://cdn.sanmar.com/img/NF0A529K_front.jpg\n"
                    "https://cdn.sanmar.com/img/NF0A529K_back.jpg\n"
                    "https://cdn.sanmar.com/img/NF0A529K_side.jpg"
                ),
                "mediaType": "Image",
                "description": "FR: Logo brodé / EN: Embroidered logo",
            }
        },
    }


# ── Tests ──────────────────────────────────────────────────────────────


def test_get_product_images_parses_single_url(
    service: MediaContentService,
) -> None:
    mock_client = MagicMock()
    mock_client.service.getMediaContent.return_value = _single_url_response()

    with patch.object(
        MediaContentService,
        "client",
        new_callable=PropertyMock,
        return_value=mock_client,
    ):
        result = service.get_product_images("NF0A529K")

    assert isinstance(result, MediaResponse)
    assert result.style_number == "NF0A529K"
    assert len(result.items) == 1

    item = result.items[0]
    assert isinstance(item, MediaItem)
    assert item.url == "https://cdn.sanmar.com/img/NF0A529K_front.jpg"
    assert item.all_urls == [
        "https://cdn.sanmar.com/img/NF0A529K_front.jpg"
    ]
    assert item.media_type == "Image"
    # No FR/EN markers — both sides fall back to raw.
    assert item.description_fr == "Front view"
    assert item.description_en == "Front view"
    assert item.raw_description == "Front view"


def test_get_product_images_splits_multi_url(
    service: MediaContentService,
) -> None:
    """The TS-layer-parity bug: SanMar collapses multiple CDN URLs into
    one `<url>` separated by `\\n`. We must split."""
    mock_client = MagicMock()
    mock_client.service.getMediaContent.return_value = _multi_url_response()

    with patch.object(
        MediaContentService,
        "client",
        new_callable=PropertyMock,
        return_value=mock_client,
    ):
        result = service.get_product_images("NF0A529K")

    item = result.items[0]
    assert len(item.all_urls) == 3, (
        "Parser failed to split multi-URL response — "
        "TS-layer parity bug we're guarding against."
    )
    assert item.all_urls[0].endswith("_front.jpg")
    assert item.all_urls[1].endswith("_back.jpg")
    assert item.all_urls[2].endswith("_side.jpg")
    # The primary URL is the first one in the list.
    assert item.url == item.all_urls[0]


def test_bilingual_description_regex_parses_fr_en() -> None:
    fr, en = _parse_bilingual("FR: Logo brodé / EN: Embroidered logo")
    assert fr == "Logo brodé"
    assert en == "Embroidered logo"


def test_bilingual_description_falls_back_to_raw() -> None:
    """Plain English-only descriptions: both sides return the raw."""
    raw = "Just a plain description, no markers"
    fr, en = _parse_bilingual(raw)
    assert fr == raw
    assert en == raw


def test_bilingual_description_handles_empty_string() -> None:
    fr, en = _parse_bilingual("")
    assert fr == ""
    assert en == ""


def test_get_product_images_passes_media_password_not_regular(
    service: MediaContentService,
) -> None:
    """Critical: Media uses a SEPARATE password. If the wrapper sent
    the regular EDI password we'd hit code 100 (auth failure) on the
    live endpoint."""
    mock_client = MagicMock()
    mock_client.service.getMediaContent.return_value = _single_url_response()

    with patch.object(
        MediaContentService,
        "client",
        new_callable=PropertyMock,
        return_value=mock_client,
    ):
        service.get_product_images("NF0A529K")

    kwargs = mock_client.service.getMediaContent.call_args.kwargs
    assert kwargs["password"] == "MEDIA-PW-XYZ"
    assert kwargs["password"] != "regular-pw", (
        "Media must NOT use the regular EDI password."
    )
    assert kwargs["id"] == "cust-123"
    assert kwargs["wsVersion"] == "1.1.0"
    assert kwargs["productId"] == "NF0A529K"


def test_get_product_images_forwards_color_as_partid(
    service: MediaContentService,
) -> None:
    mock_client = MagicMock()
    mock_client.service.getMediaContent.return_value = _single_url_response()

    with patch.object(
        MediaContentService,
        "client",
        new_callable=PropertyMock,
        return_value=mock_client,
    ):
        service.get_product_images("NF0A529K", color="Black")

    kwargs = mock_client.service.getMediaContent.call_args.kwargs
    assert kwargs["partId"] == "Black"


def test_media_fault_maps_to_sanmar_api_error(
    service: MediaContentService,
) -> None:
    from sanmar.services import base as base_module

    class FakeFault(Exception):
        def __init__(self, message: str, code: str) -> None:
            super().__init__(message)
            self.message = message
            self.code = code

    mock_client = MagicMock()
    mock_client.service.getMediaContent.side_effect = FakeFault(
        "Media auth failed", code="100"
    )

    with patch.object(base_module, "_ZeepFault", FakeFault), patch.object(
        MediaContentService,
        "client",
        new_callable=PropertyMock,
        return_value=mock_client,
    ):
        with pytest.raises(SanmarApiError) as exc_info:
            service.get_product_images("NF0A529K")

    err = exc_info.value
    assert err.code == "100"
    assert err.operation == "getMediaContent"
    assert "Media auth failed" in err.message
