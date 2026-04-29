"""Tests for the Phase 10 read-only HTTP API.

Each test builds a fresh SQLite at ``tmp_path``, seeds the rows it
cares about, and overrides the ``get_engine`` dependency on a
freshly-built FastAPI app so route handlers see the test DB instead
of the production one. The factory pattern means cached responses
can't bleed between tests.
"""
from __future__ import annotations

import json
from datetime import datetime, timedelta, timezone
from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.engine import Engine

from sanmar.api.app import create_app, get_engine
from sanmar.api.cache_pricing import CachedPricing
from sanmar.db import init_schema, make_engine, make_session_factory
from sanmar.models import (
    Brand,
    InventorySnapshot,
    Product,
    SyncState,
    Variant,
)


def _seed_engine(tmp_path: Path) -> Engine:
    """Build a fresh SQLite engine with the empty schema applied."""
    engine = make_engine(tmp_path / "api.db")
    init_schema(engine)
    return engine


@pytest.fixture
def client_factory(tmp_path):
    """Yield a callable returning ``(client, engine)`` per test.

    A new app is constructed each call so the dependency overrides +
    response cache don't bleed between tests.
    """
    created: list[TestClient] = []

    def _make() -> tuple[TestClient, Engine]:
        engine = _seed_engine(tmp_path)
        application = create_app()
        application.dependency_overrides[get_engine] = lambda: engine
        # Stub out the lifespan-resolved engine too, so handlers that
        # touch ``request.app.state.engine`` directly see the test DB.
        application.state.engine = engine
        client = TestClient(application)
        created.append(client)
        return client, engine

    yield _make
    for c in created:
        c.close()


def _seed_product(
    engine: Engine,
    *,
    style: str = "PC54",
    brand: str = "Port & Company",
    name: str = "Core Tee",
    category: str = "Tees",
    variants: list[tuple[str, str, float]] | None = None,
) -> int:
    """Insert a Brand + Product + Variants. Return the product id."""
    factory = make_session_factory(engine)
    with factory() as session:
        from sqlalchemy import select

        b = session.execute(
            select(Brand).where(Brand.name == brand)
        ).scalar_one_or_none()
        if b is None:
            b = Brand(name=brand, slug=brand.lower().replace(" ", "-"))
            session.add(b)
            session.flush()
        p = Product(
            style_number=style,
            brand_id=b.id,
            name=name,
            category=category,
            status="active",
        )
        session.add(p)
        session.flush()
        for color, size, price in variants or [
            ("Black", "L", 12.50),
            ("Black", "XL", 12.50),
        ]:
            session.add(
                Variant(
                    product_id=p.id,
                    full_sku=f"{style}-{color}-{size}",
                    color=color,
                    size=size,
                    price_cad=price,
                )
            )
        session.commit()
        return p.id


# ── 1: health ────────────────────────────────────────────────────────


def test_health_returns_200_with_status_ok(client_factory) -> None:
    """``GET /health`` on a valid empty DB must return 200 with
    ``status: 'ok'`` (no SyncState rows ⇒ no warnings)."""
    client, _ = client_factory()
    r = client.get("/health")
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["status"] == "ok"
    assert body["db"] is True
    assert body["db_connected"] is True
    # The brief's contract: response carries sync_freshness keys.
    assert "sync_freshness" in body
    for key in (
        "catalog_age_seconds",
        "inventory_age_seconds",
        "order_status_age_seconds",
    ):
        assert key in body["sync_freshness"]


# ── 2 & 3: list with empty DB / seeded DB ────────────────────────────


def test_products_empty_db_returns_zero(client_factory) -> None:
    """``GET /products`` against an empty DB must return ``total: 0``
    with an empty ``products`` list — no 500."""
    client, _ = client_factory()
    r = client.get("/products")
    assert r.status_code == 200
    body = r.json()
    assert body["total"] == 0
    assert body["products"] == []


def test_products_seeded_db_returns_rows(client_factory) -> None:
    """A seeded product must surface in the list response."""
    client, engine = client_factory()
    _seed_product(engine, style="PC54")
    r = client.get("/products")
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["total"] == 1
    assert len(body["products"]) == 1
    assert body["products"][0]["styleNumber"] == "PC54"


# ── 4: filter by brand ───────────────────────────────────────────────


def test_products_filter_by_brand(client_factory) -> None:
    """``?brand=Port Authority`` must filter to that brand only."""
    client, engine = client_factory()
    _seed_product(engine, style="PC54", brand="Port & Company")
    _seed_product(
        engine,
        style="K500",
        brand="Port Authority",
        name="Silk Touch Polo",
        category="Polos",
    )
    r = client.get("/products", params={"brand": "Port Authority"})
    assert r.status_code == 200
    body = r.json()
    assert body["total"] == 1
    assert body["products"][0]["styleNumber"] == "K500"


# ── 5 & 6: detail / 404 ──────────────────────────────────────────────


def test_get_product_returns_seeded_product(client_factory) -> None:
    """A seeded product must come back via ``GET /products/{style}``."""
    client, engine = client_factory()
    _seed_product(engine)
    r = client.get("/products/PC54")
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["styleNumber"] == "PC54"
    assert body["brandName"] == "Port & Company"


def test_get_product_unknown_returns_404(client_factory) -> None:
    """``GET /products/UNKNOWN`` on an empty DB must 404."""
    client, _ = client_factory()
    r = client.get("/products/UNKNOWN")
    assert r.status_code == 404


# ── 7: inventory breakdown ──────────────────────────────────────────


def test_get_product_inventory_returns_warehouse_breakdown(
    client_factory,
) -> None:
    """``GET /products/{style}/inventory`` must aggregate the latest
    snapshot per warehouse and return one ``WarehouseLevel`` per."""
    client, engine = client_factory()
    _seed_product(engine)
    factory = make_session_factory(engine)
    fresh = datetime.now(tz=timezone.utc) - timedelta(minutes=5)
    with factory() as session:
        # Two warehouses for the same SKU.
        session.add_all(
            [
                InventorySnapshot(
                    full_sku="PC54-Black-L",
                    warehouse_code="Vancouver",
                    quantity=12,
                    fetched_at=fresh,
                ),
                InventorySnapshot(
                    full_sku="PC54-Black-XL",
                    warehouse_code="Mississauga",
                    quantity=5,
                    fetched_at=fresh,
                ),
            ]
        )
        session.commit()
    r = client.get("/products/PC54/inventory")
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["productId"] == "PC54"
    qty_by_wh = {loc["warehouse_name"]: loc["qty"] for loc in body["locations"]}
    assert qty_by_wh.get("Vancouver") == 12
    assert qty_by_wh.get("Mississauga") == 5


# ── 8: metrics/freshness ────────────────────────────────────────────


def test_metrics_freshness_returns_three_keys(client_factory) -> None:
    """``GET /metrics/freshness`` returns the 3 sync-type keys, each
    either an int or null. Empty DB ⇒ all null."""
    client, _ = client_factory()
    r = client.get("/metrics/freshness")
    assert r.status_code == 200, r.text
    body = r.json()
    assert set(body.keys()) == {
        "catalog_age_seconds",
        "inventory_age_seconds",
        "order_status_age_seconds",
    }
    # All None initially.
    for v in body.values():
        assert v is None


def test_metrics_freshness_populates_after_sync(client_factory) -> None:
    """Once a SyncState row is finished, the matching age field flips
    from None to a non-negative integer."""
    client, engine = client_factory()
    factory = make_session_factory(engine)
    finished = datetime.now(tz=timezone.utc) - timedelta(seconds=42)
    with factory() as session:
        session.add(
            SyncState(
                sync_type="inventory",
                started_at=finished,
                finished_at=finished,
                success_count=1,
                error_count=0,
                total_processed=1,
            )
        )
        session.commit()
    r = client.get("/metrics/freshness")
    body = r.json()
    assert body["inventory_age_seconds"] is not None
    assert body["inventory_age_seconds"] >= 0
    assert body["catalog_age_seconds"] is None
    assert body["order_status_age_seconds"] is None


# ── 9: CORS preflight ──────────────────────────────────────────────


def test_cors_preflight_returns_allow_origin(client_factory) -> None:
    """An OPTIONS preflight from an allowed origin returns 200 + the
    ``Access-Control-Allow-Origin`` header echoing the origin."""
    client, _ = client_factory()
    origin = "http://localhost:5173"
    r = client.options(
        "/health",
        headers={
            "Origin": origin,
            "Access-Control-Request-Method": "GET",
            "Access-Control-Request-Headers": "content-type",
        },
    )
    assert r.status_code == 200
    assert r.headers.get("access-control-allow-origin") == origin


# ── Bonus: cached pricing 404 with hint ────────────────────────────


def test_cached_pricing_404_hints_at_sync_pricing(client_factory) -> None:
    """``GET /products/{style}/pricing`` with no CachedPricing row
    returns 404 with the brief-mandated hint string."""
    client, engine = client_factory()
    _seed_product(engine)
    r = client.get("/products/PC54/pricing")
    assert r.status_code == 404
    assert "sync-pricing" in r.json()["detail"].lower()


def test_cached_pricing_returns_break_ladder(client_factory) -> None:
    """A seeded ``CachedPricing`` row must come back as a ``PricingResponse``."""
    client, engine = client_factory()
    _seed_product(engine)
    factory = make_session_factory(engine)
    with factory() as session:
        session.add(
            CachedPricing(
                style_number="PC54",
                color="Black",
                size="L",
                breaks=[
                    {"min_qty": 1, "max_qty": 11, "price_cad": "12.50"},
                    {"min_qty": 12, "max_qty": None, "price_cad": "10.00"},
                ],
            )
        )
        session.commit()
    r = client.get("/products/PC54/pricing")
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["productId"] == "PC54"
    assert body["currency"] == "CAD"
    assert body["fobId"] == "CUSTOMER"
    assert len(body["breaks"]) == 2
    assert body["breaks"][0]["minQuantity"] == 1


# ── Bonus: search ────────────────────────────────────────────────


def test_products_search_finds_match(client_factory) -> None:
    """``GET /products/search?q=`` LIKE-matches name/style/description."""
    client, engine = client_factory()
    _seed_product(engine, style="PC54", name="Core Cotton Tee")
    _seed_product(engine, style="K500", name="Silk Touch Polo", brand="Port Authority")
    r = client.get("/products/search", params={"q": "cotton"})
    assert r.status_code == 200, r.text
    body = r.json()
    assert len(body) == 1
    assert body[0]["styleNumber"] == "PC54"
