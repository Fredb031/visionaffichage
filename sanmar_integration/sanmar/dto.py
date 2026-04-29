"""Pydantic v2 response DTOs for SanMar SOAP responses.

These are *separate* from the SQLAlchemy ORM models in `sanmar/models.py`.
The ORM persists rows; the DTOs shape SOAP responses for transit. Keep
them decoupled: a DTO change must not force a schema migration.
"""
from __future__ import annotations

from typing import Optional

from pydantic import BaseModel, ConfigDict, Field


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
