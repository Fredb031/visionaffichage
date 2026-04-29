"""Unit tests for the SanmarOrchestrator facade."""
from __future__ import annotations

from datetime import datetime, timezone
from unittest.mock import MagicMock

import pytest

from sanmar.config import Settings
from sanmar.dto import (
    BulkDataResponse,
    OrderStatusResponse,
    ProductResponse,
)
from sanmar.orchestrator import (
    CatalogSyncResult,
    OrderReconResult,
    SanmarOrchestrator,
)
from sanmar.services.bulk_data import BulkDataService
from sanmar.services.inventory import InventoryService
from sanmar.services.invoice import InvoiceService
from sanmar.services.media import MediaContentService
from sanmar.services.pricing import PricingService
from sanmar.services.product_data import ProductDataService
from sanmar.services.purchase_order import PurchaseOrderService
from sanmar.services.shipment import ShipmentService


@pytest.fixture
def settings() -> Settings:
    return Settings(
        customer_id="cust-123",
        password="secret-pw",
        media_password="media-pw",
        env="uat",
    )


@pytest.fixture
def orchestrator(settings: Settings) -> SanmarOrchestrator:
    return SanmarOrchestrator(settings)


def test_orchestrator_instantiates_all_eight_services(
    orchestrator: SanmarOrchestrator,
) -> None:
    """Spec contract: the facade composes all 8 services."""
    assert isinstance(orchestrator.product_data, ProductDataService)
    assert isinstance(orchestrator.inventory, InventoryService)
    assert isinstance(orchestrator.pricing, PricingService)
    assert isinstance(orchestrator.media, MediaContentService)
    assert isinstance(orchestrator.purchase_order, PurchaseOrderService)
    assert isinstance(orchestrator.shipment, ShipmentService)
    assert isinstance(orchestrator.invoice, InvoiceService)
    assert isinstance(orchestrator.bulk_data, BulkDataService)
    # And the public diagnostics map exposes them.
    assert len(orchestrator.services) == 8


def test_sync_catalog_delta_calls_bulk_data_then_persists(
    orchestrator: SanmarOrchestrator,
) -> None:
    """sync_catalog_delta must call bulk_data.get_product_data_delta
    and (when given a session) write through the catalog store."""
    since = datetime(2026, 4, 28, tzinfo=timezone.utc)
    end = datetime(2026, 4, 29, tzinfo=timezone.utc)

    fake_delta = BulkDataResponse(
        window_start=since,
        window_end=end,
        total_changes=1,
        products=[
            ProductResponse(
                style_number="PC54",
                brand_name="Port & Company",
                product_name="Core Tee",
                description="cotton",
                category="Tees",
                status="active",
                list_of_colors=["Black"],
                list_of_sizes=["L"],
            )
        ],
    )

    # Mock the bulk_data service's method.
    orchestrator.bulk_data = MagicMock(spec=BulkDataService)
    orchestrator.bulk_data.get_product_data_delta.return_value = fake_delta

    # Mock persist_catalog so we don't need a live SQLAlchemy session.
    fake_session = MagicMock()
    with pytest.MonkeyPatch.context() as mp:
        called: dict[str, object] = {}

        def fake_persist(df, session):  # noqa: ANN001
            called["rows"] = len(df)
            called["session"] = session
            return {"brands": 0, "products": 1, "variants": 1, "rows_processed": 1}

        mp.setattr(
            "sanmar.catalog.store.persist_catalog", fake_persist
        )
        result = orchestrator.sync_catalog_delta(since, session=fake_session)

    assert isinstance(result, CatalogSyncResult)
    assert result.success_count == 1
    assert result.products_seen == 1
    assert result.window_start == since
    assert result.window_end == end
    # Persistence was called with our fake session.
    assert called["session"] is fake_session
    assert called["rows"] == 1
    # And bulk_data was invoked with the right since.
    orchestrator.bulk_data.get_product_data_delta.assert_called_once_with(
        since
    )


def test_reconcile_open_orders_detects_status_transition(
    orchestrator: SanmarOrchestrator,
) -> None:
    """When SanMar reports a different status_id, reconcile must count
    the transition and append a 'transition' row to errors."""
    fake_session = MagicMock()
    open_orders = [
        # Locally we believe this PO is at status 60 (In Production).
        {"po_number": "PO-2026-100", "status_id": 60},
        # And this one already shipped — no transition expected.
        {"po_number": "PO-2026-101", "status_id": 80},
    ]

    orchestrator.purchase_order = MagicMock(spec=PurchaseOrderService)
    orchestrator.purchase_order.get_order_status.side_effect = [
        # First call: 60 → 80 transition.
        OrderStatusResponse(
            order_number="PO-2026-100",
            status_id=80,
            status_description="Complete / Shipped",
        ),
        # Second call: still 80, no transition.
        OrderStatusResponse(
            order_number="PO-2026-101",
            status_id=80,
            status_description="Complete / Shipped",
        ),
    ]

    result = orchestrator.reconcile_open_orders(
        fake_session, open_orders=open_orders
    )

    assert isinstance(result, OrderReconResult)
    assert result.success_count == 2
    assert result.error_count == 0
    assert result.transitions == 1

    # The transition row carries the from/to ids.
    transitions = [e for e in result.errors if e.get("phase") == "transition"]
    assert len(transitions) == 1
    assert transitions[0]["po_number"] == "PO-2026-100"
    assert transitions[0]["from_status"] == 60
    assert transitions[0]["to_status"] == 80

    # And the caller's dict was mutated in place for the transitioned
    # order (so the caller can write back to their own table without
    # re-querying).
    assert open_orders[0]["status_id"] == 80
    assert open_orders[1]["status_id"] == 80
