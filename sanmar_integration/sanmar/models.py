"""SQLAlchemy 2.0 ORM models for the local SanMar catalog cache."""
from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Optional

from sqlalchemy import (
    JSON,
    DateTime,
    Enum,
    ForeignKey,
    Index,
    Integer,
    Numeric,
    String,
    UniqueConstraint,
)
from sqlalchemy.ext.hybrid import hybrid_property
from sqlalchemy.orm import Mapped, mapped_column, relationship

from sanmar.db import Base

# Status codes per SanMar PromoStandards Order Status PDF — orders
# leave the "open" set when they reach Complete/Shipped (80) or
# Cancelled (99).
CLOSED_STATUS_IDS: tuple[int, ...] = (80, 99)

# Cap on errors[] entries on a SyncState row. SanMar deltas + bulk
# inventory legitimately produce hundreds of warnings on bad days; we
# don't want a single sync to bloat the cache with megabytes of repeats.
SYNC_STATE_ERROR_CAP: int = 100


def _utcnow() -> datetime:
    return datetime.now(tz=timezone.utc)


class Brand(Base):
    __tablename__ = "brands"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False, unique=True)
    slug: Mapped[str] = mapped_column(String(255), nullable=False, unique=True)

    products: Mapped[list["Product"]] = relationship(
        "Product", back_populates="brand", cascade="all, delete-orphan"
    )

    def __repr__(self) -> str:  # pragma: no cover - debug helper
        return f"Brand(id={self.id!r}, name={self.name!r})"


class Product(Base):
    __tablename__ = "products"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    style_number: Mapped[str] = mapped_column(
        String(64), nullable=False, unique=True, index=True
    )
    parent_sku: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    brand_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("brands.id", ondelete="SET NULL"), nullable=True, index=True
    )
    name: Mapped[Optional[str]] = mapped_column(String(512), nullable=True)
    description: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    category: Mapped[Optional[str]] = mapped_column(String(128), nullable=True)
    status: Mapped[str] = mapped_column(String(16), nullable=False, default="active")
    last_synced_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=_utcnow
    )

    brand: Mapped[Optional[Brand]] = relationship("Brand", back_populates="products")
    variants: Mapped[list["Variant"]] = relationship(
        "Variant", back_populates="product", cascade="all, delete-orphan"
    )

    def __repr__(self) -> str:  # pragma: no cover
        return f"Product(id={self.id!r}, style_number={self.style_number!r})"


class Variant(Base):
    __tablename__ = "variants"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    product_id: Mapped[int] = mapped_column(
        ForeignKey("products.id", ondelete="CASCADE"), nullable=False, index=True
    )
    full_sku: Mapped[str] = mapped_column(
        String(128), nullable=False, unique=True, index=True
    )
    color: Mapped[Optional[str]] = mapped_column(String(128), nullable=True)
    size: Mapped[Optional[str]] = mapped_column(String(32), nullable=True)
    weight_g: Mapped[Optional[float]] = mapped_column(Numeric(10, 2), nullable=True)
    price_cad: Mapped[Optional[float]] = mapped_column(Numeric(12, 2), nullable=True)
    last_synced_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=_utcnow
    )

    product: Mapped[Product] = relationship("Product", back_populates="variants")

    __table_args__ = (
        UniqueConstraint("full_sku", name="uq_variants_full_sku"),
        Index("ix_variants_product_color_size", "product_id", "color", "size"),
    )

    def __repr__(self) -> str:  # pragma: no cover
        return f"Variant(id={self.id!r}, full_sku={self.full_sku!r})"


class InventorySnapshot(Base):
    __tablename__ = "inventory_snapshots"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    full_sku: Mapped[str] = mapped_column(String(128), nullable=False, index=True)
    warehouse_code: Mapped[str] = mapped_column(String(32), nullable=False, index=True)
    quantity: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    fetched_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=_utcnow, index=True
    )

    __table_args__ = (
        Index("ix_inv_snap_sku_fetched", "full_sku", "fetched_at"),
    )

    def __repr__(self) -> str:  # pragma: no cover
        return (
            f"InventorySnapshot(full_sku={self.full_sku!r}, "
            f"warehouse={self.warehouse_code!r}, qty={self.quantity})"
        )


class SyncState(Base):
    """Checkpoint row for a sync run (Phase 6).

    Every orchestrator sync method writes one of these at start and
    updates it at finish. ``last_processed_marker`` lets long syncs
    resume — for catalog deltas it's the ``window_end`` ISO timestamp,
    for inventory it's the last processed style number.

    ``errors`` is capped at :data:`SYNC_STATE_ERROR_CAP` entries via
    :meth:`append_error` so a runaway sync can't flood SQLite.
    """

    __tablename__ = "sync_state"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    sync_type: Mapped[str] = mapped_column(
        Enum(
            "catalog_full",
            "catalog_delta",
            "inventory",
            "order_reconcile",
            name="sync_type_enum",
        ),
        nullable=False,
        index=True,
    )
    started_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=_utcnow
    )
    finished_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    success_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    error_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    total_processed: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    last_processed_marker: Mapped[Optional[str]] = mapped_column(
        String(255), nullable=True
    )
    metadata_json: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)
    errors: Mapped[Optional[list]] = mapped_column(JSON, nullable=True, default=list)

    __table_args__ = (
        Index("ix_sync_state_type_started", "sync_type", "started_at"),
    )

    def append_error(self, step: str, error_str: str) -> None:
        """Append an error row, respecting the per-run cap."""
        if self.errors is None:
            self.errors = []
        if len(self.errors) >= SYNC_STATE_ERROR_CAP:
            return
        # Mutating a JSON column in place doesn't always flag dirty in
        # SQLAlchemy 2.0 — reassign so the session picks up the change.
        new_list = list(self.errors)
        new_list.append({"step": step, "error_str": error_str})
        self.errors = new_list

    def mark_finished(
        self,
        *,
        success_count: int,
        error_count: int,
        total_processed: int,
        last_processed_marker: Optional[str] = None,
        metadata: Optional[dict[str, Any]] = None,
    ) -> None:
        """Stamp finish-time + final metrics in one shot."""
        self.finished_at = _utcnow()
        self.success_count = success_count
        self.error_count = error_count
        self.total_processed = total_processed
        if last_processed_marker is not None:
            self.last_processed_marker = last_processed_marker
        if metadata is not None:
            self.metadata_json = metadata

    def __repr__(self) -> str:  # pragma: no cover
        return (
            f"SyncState(id={self.id!r}, sync_type={self.sync_type!r}, "
            f"success={self.success_count}, error={self.error_count})"
        )


class OrderRow(Base):
    """Local mirror of a SanMar PO so reconciliation is self-sourcing.

    Phase 6 rewrites :meth:`SanmarOrchestrator.reconcile_open_orders`
    to query this table directly rather than accepting an externally
    supplied work-list. ``is_open`` is a hybrid_property so the same
    expression works in Python (after fetch) and in SQL (in a filter).
    """

    __tablename__ = "orders"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    po_number: Mapped[str] = mapped_column(
        String(64), nullable=False, unique=True, index=True
    )
    customer_po: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    vision_quote_id: Mapped[Optional[str]] = mapped_column(
        String(64), nullable=True, index=True
    )

    status_id: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    status_description: Mapped[Optional[str]] = mapped_column(
        String(128), nullable=True
    )
    last_status_check_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    submitted_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    expected_ship_date: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    shipped_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    tracking_numbers: Mapped[Optional[list]] = mapped_column(
        JSON, nullable=True, default=list
    )
    total_amount_cad: Mapped[Optional[float]] = mapped_column(
        Numeric(10, 2), nullable=True
    )

    # Phase 16 — public /track endpoint fields. Nullable so legacy
    # rows seeded prior to the migration still load; the /track
    # handler 404s when ``customer_email`` is missing rather than
    # leaking that the order exists in the cache. ``line_items`` and
    # ``shipping_address`` are JSON so the storefront-facing payload
    # doesn't need a separate join when serving cache hits at the
    # Cloudflare edge.
    customer_email: Mapped[Optional[str]] = mapped_column(
        String(254), nullable=True, index=True
    )
    line_items: Mapped[Optional[list]] = mapped_column(
        JSON, nullable=True, default=list
    )
    shipping_address: Mapped[Optional[dict]] = mapped_column(
        JSON, nullable=True
    )

    __table_args__ = (
        Index("ix_orders_status_submitted", "status_id", "submitted_at"),
    )

    @hybrid_property
    def is_open(self) -> bool:  # type: ignore[override]
        """True when the order hasn't reached a terminal status.

        SanMar's terminal codes per the PO PDF are 80 (Complete /
        Shipped) and 99 (Cancelled); everything else (received, holds,
        in production, partially shipped) is still open.
        """
        if self.status_id is None:
            return True
        return self.status_id not in CLOSED_STATUS_IDS

    @is_open.expression  # type: ignore[no-redef]
    def is_open(cls):  # noqa: N805 - SQLAlchemy hybrid_property convention
        from sqlalchemy import or_

        return or_(
            cls.status_id.is_(None),
            cls.status_id.notin_(CLOSED_STATUS_IDS),
        )

    def __repr__(self) -> str:  # pragma: no cover
        return (
            f"OrderRow(id={self.id!r}, po={self.po_number!r}, "
            f"status={self.status_id!r})"
        )
