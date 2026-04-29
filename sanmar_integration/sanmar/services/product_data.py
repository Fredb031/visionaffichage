"""SanMar PromoStandards Product Data Service v2.0.0 wrapper.

Reference: ``supabase/functions/_shared/sanmar/products.ts`` for the
URL pattern + envelope shape. The Python layer uses zeep so we don't
hand-roll XML, but the operation names (``getProduct``,
``getProductSellable``) and the partId regex pattern
``STYLE(COLOR,SIZE,DISCONTINUED_FLAG)`` mirror the TS layer exactly.
"""
from __future__ import annotations

import re
from typing import Any, ClassVar, Optional

from sanmar.dto import ActivePart, ProductResponse, SellableVariant
from sanmar.services.base import SanmarServiceBase

# Pattern used to decode the overloaded `partId` string returned by
# getProductSellable, e.g. "PC54(Black,LT,Adult)" or
# "ATC1000(Black,M,)" (active) / "ATC1000(Black,M,C)" (discontinued).
_PART_ID_RE = re.compile(r"^([^(]+)\(([^,]*),([^,]*),([^)]*)\)$")


def _to_str(value: Any, default: str = "") -> str:
    """Coerce zeep's loosely-typed return values (str | None | int) to str."""
    if value is None:
        return default
    return str(value)


def _to_list(value: Any) -> list[Any]:
    """Coerce a value that zeep may hand back as `T | list[T] | None` to a
    flat list. PromoStandards repeating elements arrive as lists when N>1
    but as bare objects when N=1 — callers want list-shape either way."""
    if value is None:
        return []
    if isinstance(value, list):
        return value
    return [value]


class ProductDataService(SanmarServiceBase):
    """Wrapper around the Product Data Service v2.0.0 endpoint."""

    # The TS layer points at a PHP gateway
    # (`productdata2.0/ProductDataServiceV2.php`); for the WSDL discovery
    # path we use the conventional `?wsdl` form against the same
    # versioned mount. Callers pointing at a different gateway can
    # subclass and override.
    wsdl_path: ClassVar[str] = "productdata2.0/ProductDataServiceV2.php?wsdl"

    # ── getProduct ─────────────────────────────────────────────────────

    def get_product(
        self,
        style_number: str,
        color: Optional[str] = None,
        size: Optional[str] = None,
    ) -> ProductResponse:
        """Fetch full metadata for a style. `color` / `size` narrow the
        response to a single SKU. Always localized to CA / EN per
        SanMar Canada's published localization."""
        params: dict[str, Any] = {
            **self.auth_dict(),
            "wsVersion": "2.0.0",
            "productId": style_number,
            "localizationCountry": "CA",
            "localizationLanguage": "EN",
        }
        if color is not None:
            params["color"] = color
        if size is not None:
            params["size"] = size

        raw = self._call("getProduct", **params)
        return self._parse_product(raw, style_number)

    @staticmethod
    def _parse_product(raw: Any, fallback_style: str) -> ProductResponse:
        """Project a zeep response object into our `ProductResponse` DTO.

        zeep returns `OrderedDict`-like attribute-accessible objects that
        mirror the WSDL types. We tolerate both attribute and key access
        so this also works against plain dict mocks in unit tests."""

        def get(obj: Any, *keys: str, default: Any = None) -> Any:
            for k in keys:
                if obj is None:
                    return default
                if isinstance(obj, dict):
                    if k in obj:
                        obj = obj[k]
                        continue
                    return default
                if hasattr(obj, k):
                    obj = getattr(obj, k)
                    continue
                return default
            return obj if obj is not None else default

        product = get(raw, "Product") or get(raw, "product") or raw

        # ProductPartArray.ProductPart → list of {colorName, labelSize, ...}
        parts = _to_list(
            get(product, "ProductPartArray", "ProductPart")
            or get(product, "productPartArray", "productPart")
            or get(product, "parts")
        )
        colors: list[str] = []
        sizes: list[str] = []
        image_url: Optional[str] = None
        for p in parts:
            color_obj = get(p, "ColorArray", "Color") or get(
                p, "colorArray", "color"
            )
            cname = (
                _to_str(get(color_obj, "standardColorName"))
                or _to_str(get(color_obj, "colorName"))
                or _to_str(get(p, "colorName"))
            )
            sname = _to_str(get(p, "labelSize")) or _to_str(get(p, "size"))
            if cname and cname not in colors:
                colors.append(cname)
            if sname and sname not in sizes:
                sizes.append(sname)
            if image_url is None:
                # First part with an image wins.
                image_url = (
                    _to_str(get(p, "ColorFrontImage"), default="") or None
                )

        return ProductResponse(
            style_number=_to_str(
                get(product, "productId"), default=fallback_style
            ),
            brand_name=_to_str(
                get(product, "productBrand") or get(product, "brand")
            ),
            product_name=_to_str(get(product, "productName")),
            description=_to_str(
                get(product, "description")
                or get(product, "productDescription")
            ),
            category=_to_str(get(product, "category")),
            status=_to_str(get(product, "status"), default="active"),
            list_of_colors=colors,
            list_of_sizes=sizes,
            image_url=image_url,
        )

    # ── getProductSellable ─────────────────────────────────────────────

    def get_product_sellable(self, style_number: str) -> list[SellableVariant]:
        """Fetch the lightweight sellable matrix for a style. The SOAP
        response packs style+color+size+discontinued into one
        ``partId`` string per row; we parse it with `_PART_ID_RE`."""
        params: dict[str, Any] = {
            **self.auth_dict(),
            "wsVersion": "2.0.0",
            "productId": style_number,
        }
        raw = self._call("getProductSellable", **params)
        return self._parse_sellable(raw)

    @staticmethod
    def _parse_sellable(raw: Any) -> list[SellableVariant]:
        def get(obj: Any, *keys: str) -> Any:
            for k in keys:
                if obj is None:
                    return None
                if isinstance(obj, dict):
                    obj = obj.get(k)
                    continue
                obj = getattr(obj, k, None)
            return obj

        container = (
            get(raw, "ProductSellableArray", "ProductSellable")
            or get(raw, "productSellableArray", "productSellable")
            or get(raw, "ProductSellable")
            or get(raw, "productSellable")
        )
        items = _to_list(container)

        out: list[SellableVariant] = []
        for item in items:
            part_id = _to_str(
                get(item, "partId") or get(item, "productId") or get(item, "id")
            )
            if not part_id:
                continue
            m = _PART_ID_RE.match(part_id)
            if m:
                style, color, size, _disc = (
                    m.group(1).strip(),
                    m.group(2).strip(),
                    m.group(3).strip(),
                    m.group(4).strip(),
                )
            else:
                style, color, size = part_id, "", ""
            sku = _to_str(get(item, "sku")) or part_id
            out.append(
                SellableVariant(
                    part_id=part_id,
                    style_number=style,
                    color=color,
                    size=size,
                    sku=sku,
                )
            )
        return out

    # ── getAllActiveParts ──────────────────────────────────────────────

    def get_all_active_parts(self) -> list[ActivePart]:
        """Fetch every currently-sellable part across the catalog. SanMar
        returns thousands of rows — callers should expect a large list."""
        params: dict[str, Any] = {
            **self.auth_dict(),
            "wsVersion": "2.0.0",
        }
        raw = self._call("getAllActiveParts", **params)
        return self._parse_active_parts(raw)

    @staticmethod
    def _parse_active_parts(raw: Any) -> list[ActivePart]:
        def get(obj: Any, *keys: str) -> Any:
            for k in keys:
                if obj is None:
                    return None
                if isinstance(obj, dict):
                    obj = obj.get(k)
                    continue
                obj = getattr(obj, k, None)
            return obj

        container = (
            get(raw, "PartArray", "Part")
            or get(raw, "partArray", "part")
            or get(raw, "ProductPartArray", "ProductPart")
            or raw
        )
        items = _to_list(container)
        out: list[ActivePart] = []
        for item in items:
            part_id = _to_str(get(item, "partId") or get(item, "productId"))
            if not part_id:
                continue
            m = _PART_ID_RE.match(part_id)
            if m:
                style, color, size = (
                    m.group(1).strip(),
                    m.group(2).strip(),
                    m.group(3).strip(),
                )
            else:
                style = _to_str(get(item, "productId"), default=part_id)
                color = _to_str(get(item, "color") or get(item, "colorName"))
                size = _to_str(get(item, "size") or get(item, "labelSize"))
            sku = _to_str(get(item, "sku")) or part_id
            out.append(
                ActivePart(
                    style_number=style, color=color, size=size, sku=sku
                )
            )
        return out
