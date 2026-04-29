"""SanMar PromoStandards Media Content Service v1.1.0 wrapper.

Reference: ``supabase/functions/_shared/sanmar/media.ts``.

Two SanMar quirks the parser handles:

1. **Separate password.** The Media service authenticates with
   ``SANMAR_MEDIA_PASSWORD``, *not* the regular EDI login password used
   by Product / Inventory / Pricing / Order. We override
   :meth:`auth_dict` so callers don't have to remember.

2. **Multi-URL ``<url>`` element.** SanMar collapses every CDN URL for
   a MediaContent node into one ``<url>`` element separated by
   newlines (rather than emitting repeated ``<url>`` tags). We split on
   ``\\n`` and surface both the first URL and the full list.

3. **Bilingual descriptions.** SanMar Canada emits descriptions like
   ``"FR: Logo brodé / EN: Embroidered logo"``. We extract the two
   halves with a regex; if it doesn't match (English-only assets), both
   sides fall back to the raw string so callers always have something
   to display.
"""
from __future__ import annotations

import re
from typing import Any, ClassVar, Optional

from sanmar.dto import MediaItem, MediaResponse
from sanmar.services.base import SanmarServiceBase

# Bilingual description pattern. SanMar Canada writes descriptions like
# "FR: Logo brodé / EN: Embroidered logo". The regex is intentionally
# permissive on whitespace so a few stray spaces around the slash don't
# kick us into the raw-string fallback.
_BILINGUAL_RE = re.compile(
    r"FR:\s*(.+?)\s*/\s*EN:\s*(.+)", re.IGNORECASE | re.DOTALL
)


def _to_str(value: Any, default: str = "") -> str:
    if value is None:
        return default
    return str(value)


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


def _parse_bilingual(desc: str) -> tuple[str, str]:
    """Split a bilingual description into ``(french, english)``.

    Falls back to ``(desc, desc)`` when no ``FR:`` / ``EN:`` marker is
    present, so callers always have content for both locales."""
    if not desc:
        return "", ""
    m = _BILINGUAL_RE.search(desc)
    if not m:
        return desc, desc
    return m.group(1).strip(), m.group(2).strip()


class MediaContentService(SanmarServiceBase):
    """Wrapper around the Media Content Service v1.1.0 endpoint."""

    # Canonical PromoStandards path. The TS layer points at the PHP
    # gateway directly (``mediacontent1.1/MediaContentService.php``);
    # both resolve to the same WSDL on the SanMar edge.
    wsdl_path: ClassVar[str] = "media/v1.1.0/?wsdl"

    def auth_dict(self) -> dict[str, str]:
        """Override — Media authenticates with ``settings.media_password``,
        a separate credential issued by SanMar's EDI team. Using the
        regular EDI password against this endpoint returns code 100
        (auth failure)."""
        return {
            "id": self.settings.customer_id,
            "password": self.settings.media_password,
        }

    def get_product_images(
        self,
        style_number: str,
        color: Optional[str] = None,
    ) -> MediaResponse:
        """Fetch image / spec-sheet / video metadata for a style.

        Returns a :class:`MediaResponse` whose ``items`` list contains
        one :class:`MediaItem` per ``MediaContent`` node SanMar
        returned. Each item has a primary ``url`` plus the full
        ``all_urls`` list (split on ``\\n``) and bilingual descriptions
        peeled out of the overloaded ``description`` field."""
        params: dict[str, Any] = {
            **self.auth_dict(),
            "wsVersion": "1.1.0",
            "productId": style_number,
            "mediaType": "Image",
            "cultureName": "en-US",
            "classType": "1006",
        }
        if color is not None:
            # PromoStandards uses partId for SKU-narrowing, but on Media
            # SanMar Canada accepts a plain colorName filter as well —
            # mirror the TS layer which forwards the optional partId.
            params["partId"] = color

        raw = self._call("getMediaContent", **params)
        return self._parse_media(raw, style_number)

    @staticmethod
    def _parse_media(raw: Any, fallback_style: str) -> MediaResponse:
        """Project a zeep response into :class:`MediaResponse`.

        Handles both upper- and lower-cased element names so plain
        ``dict`` mocks work in tests."""
        # The response root may already be unwrapped by zeep; tolerate
        # `GetMediaContentResponse` wrapping or direct.
        root = (
            _get(raw, "GetMediaContentResponse")
            or _get(raw, "getMediaContentResponse")
            or raw
        )

        arr_container = (
            _get(root, "MediaContentArray")
            or _get(root, "mediaContentArray")
            or root
        )
        nodes = _to_list(
            _get(arr_container, "MediaContent")
            or _get(arr_container, "mediaContent")
        )

        items: list[MediaItem] = []
        for node in nodes:
            raw_url = _to_str(_get(node, "url"))
            # Multi-URL split — SanMar puts every CDN URL inside one
            # `<url>` separated by newlines.
            all_urls = [u.strip() for u in raw_url.split("\n") if u.strip()]
            primary = all_urls[0] if all_urls else ""

            raw_desc = _to_str(_get(node, "description"))
            fr, en = _parse_bilingual(raw_desc)

            items.append(
                MediaItem(
                    url=primary,
                    all_urls=all_urls,
                    media_type=_to_str(_get(node, "mediaType")),
                    description_fr=fr,
                    description_en=en,
                    raw_description=raw_desc,
                )
            )

        return MediaResponse(
            style_number=_to_str(
                _get(root, "productId"), default=fallback_style
            )
            or fallback_style,
            items=items,
        )
