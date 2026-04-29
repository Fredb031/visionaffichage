"""Pydantic v2 response DTOs for SanMar SOAP responses.

These are *separate* from the SQLAlchemy ORM models in `sanmar/models.py`.
The ORM persists rows; the DTOs shape SOAP responses for transit. Keep
them decoupled: a DTO change must not force a schema migration.
"""
from __future__ import annotations

from datetime import date
from decimal import Decimal
from typing import Literal, Optional

from pydantic import BaseModel, ConfigDict, Field, computed_field


class ProductResponse(BaseModel):
    """Normalized projection of a `getProduct` response."""

    model_config = ConfigDict(populate_by_name=True)

    style_number: str = Field(alias="styleNumber")
    brand_name: str = Field(default="", alias="brandName")
    product_name: str = Field(default="", alias="productName")
    description: str = Field(default="", alias="description")
    category: str = Field(default="", alias="category")
    status: str = Field(default="active", alias="status")
    list_of_colors: list[str] = Field(default_factory=list, alias="listOfColors")
    list_of_sizes: list[str] = Field(default_factory=list, alias="listOfSizes")
    image_url: Optional[str] = Field(default=None, alias="imageUrl")


class SellableVariant(BaseModel):
    """One row from `getProductSellable` after partId regex parsing."""

    model_config = ConfigDict(populate_by_name=True)

    part_id: str = Field(alias="partId")
    style_number: str = Field(alias="styleNumber")
    color: str
    size: str
    sku: str


class ActivePart(BaseModel):
    """One row from `getAllActiveParts`."""

    model_config = ConfigDict(populate_by_name=True)

    style_number: str = Field(alias="styleNumber")
    color: str
    size: str
    sku: str


# ── Inventory v2.0.0 ───────────────────────────────────────────────────


# SanMar Canada warehouse names keyed by `inventoryLocationId`. Per the
# Inventory Service PDF: 1=Vancouver, 2=Mississauga, 4=Calgary. ID 3 is
# unused on the Canadian side; we don't synthesize a name for unknown IDs
# so callers can still tell when SanMar surfaces a new location.
WAREHOUSE_NAMES: dict[int, str] = {
    1: "Vancouver",
    2: "Mississauga",
    4: "Calgary",
}


class FutureStock(BaseModel):
    """Back-ordered / incoming-shipment row attached to a warehouse.

    SanMar emits these inside `futureAvailabilityArray.FutureAvailability`
    when there is replenishment scheduled. The TS layer parses the same
    `Quantity { value }` envelope we drill through here.
    """

    model_config = ConfigDict(populate_by_name=True)

    quantity: int = Field(alias="qty")
    expected_date: str = Field(default="", alias="availableOn")


class WarehouseLevel(BaseModel):
    """One warehouse's slice of an `InventoryResponse`.

    `warehouse_name` is computed from the well-known `WAREHOUSE_NAMES`
    table so callers don't carry the mapping around. Unknown warehouse
    IDs surface as `Location <id>` rather than blank.
    """

    model_config = ConfigDict(populate_by_name=True)

    warehouse_id: int = Field(alias="inventoryLocationId")
    quantity: int = Field(default=0, alias="qty")
    future_quantities: list[FutureStock] = Field(
        default_factory=list, alias="futureAvailability"
    )

    @computed_field  # type: ignore[prop-decorator]
    @property
    def warehouse_name(self) -> str:
        return WAREHOUSE_NAMES.get(
            self.warehouse_id, f"Location {self.warehouse_id}"
        )


class InventoryResponse(BaseModel):
    """Normalized projection of `getInventoryLevels`.

    `total` is a computed_field that sums `locations[*].quantity` so the
    caller never has to do the math (and so we never disagree with
    ourselves about what "total stock" means).
    """

    model_config = ConfigDict(populate_by_name=True)

    style_number: str = Field(alias="productId")
    color: Optional[str] = Field(default=None, alias="partColor")
    size: Optional[str] = Field(default=None, alias="labelSize")
    locations: list[WarehouseLevel] = Field(default_factory=list)

    @computed_field  # type: ignore[prop-decorator]
    @property
    def total(self) -> int:
        return sum(loc.quantity for loc in self.locations)


# ── Pricing & Configuration v1.0.0 ─────────────────────────────────────


class PriceBreak(BaseModel):
    """One tier in the price ladder returned by `getConfigurationAndPricing`.

    `max_quantity` is `None` when the tier is open-ended (the last/top
    break, e.g. "72+"). Prices are stored as `Decimal` because
    round-tripping currency through `float` corrupts cents — pydantic v2
    accepts strings/numerics and coerces them to Decimal at validation.
    """

    model_config = ConfigDict(populate_by_name=True)

    min_quantity: int = Field(alias="minQuantity")
    max_quantity: Optional[int] = Field(default=None, alias="maxQuantity")
    price_cad: Decimal = Field(alias="price")


class PricingResponse(BaseModel):
    """Normalized projection of a `getConfigurationAndPricing` response."""

    model_config = ConfigDict(populate_by_name=True)

    style_number: str = Field(alias="productId")
    color: Optional[str] = Field(default=None, alias="partColor")
    size: Optional[str] = Field(default=None, alias="labelSize")
    currency: str = Field(default="CAD")
    fob_id: str = Field(default="CUSTOMER", alias="fobId")
    breaks: list[PriceBreak] = Field(default_factory=list)


# ── Media Content v1.1.0 ───────────────────────────────────────────────


class MediaItem(BaseModel):
    """One row from the ``mediaContentArray.MediaContent`` response.

    SanMar collapses every CDN URL for a given MediaContent node into a
    single ``<url>`` element separated by newlines. We split on ``\\n``
    and surface both the first URL (``url``) and the full split list
    (``all_urls``).

    Descriptions on SanMar Canada are bilingual — typically formatted
    ``"FR: Logo brodé / EN: Embroidered logo"``. The bilingual parser
    lives in :mod:`sanmar.services.media`; if the regex misses, both
    ``description_fr`` and ``description_en`` fall back to
    ``raw_description`` so callers always have *something* to display.
    """

    model_config = ConfigDict(populate_by_name=True)

    url: str
    all_urls: list[str] = Field(default_factory=list)
    media_type: str = Field(default="", alias="mediaType")
    description_fr: str = Field(default="")
    description_en: str = Field(default="")
    raw_description: str = Field(default="", alias="description")


class MediaResponse(BaseModel):
    """Normalized projection of a ``getMediaContent`` response."""

    model_config = ConfigDict(populate_by_name=True)

    style_number: str = Field(alias="productId")
    items: list[MediaItem] = Field(default_factory=list)


# ── Purchase Order v1.0.0 + Order Status v1.0.0 ────────────────────────


# Order status code → human description. Per SanMar's PO PDF page on
# status response codes:
#   10 = received, 11 = on credit hold, 41 = on customer-service hold,
#   44 = on backorder hold, 60 = in production, 75 = partially shipped,
#   80 = complete / shipped, 99 = cancelled.
ORDER_STATUS_DESCRIPTIONS: dict[int, str] = {
    10: "Received",
    11: "On Credit Hold",
    41: "On Customer Service Hold",
    44: "On Backorder Hold",
    60: "In Production",
    75: "Partially Shipped",
    80: "Complete / Shipped",
    99: "Cancelled",
}


class Address(BaseModel):
    """Shipping or billing address for a purchase order.

    Pre-flight validation in :class:`sanmar.services.purchase_order.
    PurchaseOrderService` enforces the SanMar character allowlist on
    every string field and the country-specific postal-code regex on
    ``postal_code``.
    """

    model_config = ConfigDict(populate_by_name=True)

    name: str
    company: Optional[str] = None
    address_line_1: str
    address_line_2: Optional[str] = None
    city: str
    state_province: str
    postal_code: str
    country: Literal["CA", "US"]
    phone: str
    email: str


class LineItem(BaseModel):
    """One product line on a purchase order."""

    model_config = ConfigDict(populate_by_name=True)

    style_number: str
    color: str
    size: str
    quantity: int
    line_price: Optional[Decimal] = None


class PurchaseOrderInput(BaseModel):
    """Caller-supplied inputs for a ``submitPO`` invocation.

    ``carrier`` is normalized to upper-case and validated against the
    supported set (UPS / PUR / FDX / CPC) inside the service. Anything
    else raises :class:`sanmar.exceptions.InvalidCarrierError`.
    """

    model_config = ConfigDict(populate_by_name=True)

    po_number: str
    customer_po: str
    ship_to: Address
    bill_to: Address
    line_items: list[LineItem]
    carrier: str
    payment_terms: str = "NET30"
    requested_ship_date: Optional[date] = None


class PurchaseOrderResponse(BaseModel):
    """Normalized projection of a ``SendPOResponse`` (the asymmetric
    response wrapper SanMar emits — see ``orders.ts`` for the bug)."""

    model_config = ConfigDict(populate_by_name=True)

    transaction_id: int = Field(default=0, alias="transactionId")
    success: bool = False
    message: str = ""
    po_number: str = ""


class OrderStatusResponse(BaseModel):
    """Normalized projection of a ``getOrderStatus`` response.

    ``raw_response`` retains the parsed dict for debugging — SanMar's
    status payload is shaped erratically across query types (1=single PO
    vs 2=date range vs 4=open orders) and we'd rather hand the whole
    parsed blob to operators than discard it."""

    model_config = ConfigDict(populate_by_name=True)

    order_number: str = ""
    status_id: int = 0
    status_description: str = ""
    expected_ship_date: str = ""
    tracking_numbers: list[str] = Field(default_factory=list)
    raw_response: dict = Field(default_factory=dict)
