"""Tests for the Phase 16 public /track endpoint.

The endpoint is the first *public* (no auth) surface on the FastAPI
cache. Each test below pins one slice of the security model so a
regression on any layer (rate limit, email gate, generic-404 leak
defence) trips a single, named test instead of being hidden behind a
broader integration test.

Test app construction follows the same factory pattern as
``test_api.py`` / ``test_rate_limit.py``: a fresh in-memory SQLite per
test, the slowapi storage reset between tests so per-IP buckets don't
bleed, and ``app.dependency_overrides[get_engine]`` swapped in so
handlers see the test DB.
"""
from __future__ import annotations

from datetime import datetime, timezone

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.engine import Engine

from sanmar.api.app import create_app, get_engine
from sanmar.api.rate_limit import limiter as global_limiter
from sanmar.api.routes.track import map_to_4_step
from sanmar.db import init_schema, make_engine, make_session_factory
from sanmar.models import OrderRow


@pytest.fixture
def fresh_app(tmp_path):
    """Yield ``(client, engine)`` with a clean DB + reset rate-limit bucket.

    The fixture mirrors the rate-limit test fixture so the 429 case
    below works identically — slowapi keys per source IP and TestClient
    always reports "testclient" as the address, so without the storage
    reset a previous test's burn would push us straight into a 429.
    """
    engine = make_engine(tmp_path / "track.db")
    init_schema(engine)

    try:
        global_limiter._storage.reset()  # type: ignore[attr-defined]
    except Exception:  # noqa: BLE001 — best-effort reset
        pass
    global_limiter.enabled = True

    application = create_app()
    application.dependency_overrides[get_engine] = lambda: engine
    application.state.engine = engine
    client = TestClient(application)
    yield client, engine
    client.close()


def _seed_order(
    engine: Engine,
    *,
    po_number: str = "PO-PHASE16-001",
    customer_email: str = "shopper@example.com",
    status_id: int = 60,
    expected_ship_date: datetime | None = None,
    tracking_numbers: list[str] | None = None,
    line_items: list[dict] | None = None,
    shipping_address: dict | None = None,
) -> None:
    """Insert one OrderRow with the Phase 16 fields populated.

    Defaults give a representative "in production" order — the most
    common test case. Each test that needs to deviate (cancelled,
    missing email, etc.) overrides only the fields it cares about.
    """
    factory = make_session_factory(engine)
    with factory() as session:
        session.add(
            OrderRow(
                po_number=po_number,
                customer_email=customer_email,
                status_id=status_id,
                expected_ship_date=expected_ship_date
                or datetime(2026, 5, 15, tzinfo=timezone.utc),
                tracking_numbers=tracking_numbers or ["1Z999AA10123456784"],
                line_items=line_items
                or [
                    {"style": "PC54", "qty": 25},
                    {"style": "PC61", "qty": 10},
                ],
                shipping_address=shipping_address
                or {
                    "street": "123 rue Principale",
                    "city": "Saint-Hyacinthe",
                    "postal_code": "J2S 1A1",
                    "province": "QC",
                },
            )
        )
        session.commit()


def test_valid_po_and_correct_email_returns_masked_payload(fresh_app) -> None:
    """Happy path — match on email, get back the full safe payload.

    Asserts every field on the response shape and *also* that the
    masked shipping address dropped the street name. A future
    refactor that accidentally widens the address back to the raw
    value will trip this test, which is the whole point of pinning
    the masking layer here.
    """
    client, engine = fresh_app
    _seed_order(engine)

    r = client.get("/track/PO-PHASE16-001", params={"email": "shopper@example.com"})
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["po_number"] == "PO-PHASE16-001"
    assert body["status_id"] == 60
    assert body["current_step"] == 3
    assert body["status_label"] == "En production"  # default lang FR
    assert body["tracking_number"] == "1Z999AA10123456784"
    assert body["line_items"] == [
        {"style": "PC54", "qty": 25},
        {"style": "PC61", "qty": 10},
    ]
    # Masked address must contain city + postal prefix only — no street.
    assert body["shipping_address"] == {
        "city": "Saint-Hyacinthe",
        "postal_prefix": "J2S",
    }
    assert "street" not in body["shipping_address"]


def test_wrong_email_returns_404_without_leaking_existence(fresh_app) -> None:
    """Email mismatch → identical 404 to the "PO doesn't exist" case.

    The body must carry the same generic detail string both for a
    real-but-mismatched PO and for a missing PO; otherwise an
    attacker iterating PO numbers could distinguish "exists" from
    "doesn't exist" by the shape of the error.
    """
    client, engine = fresh_app
    _seed_order(engine)

    mismatch = client.get(
        "/track/PO-PHASE16-001", params={"email": "wrong@example.com"}
    )
    missing = client.get("/track/PO-DOES-NOT-EXIST", params={"email": "x@x.co"})

    assert mismatch.status_code == 404
    assert missing.status_code == 404
    assert mismatch.json() == missing.json()


def test_invalid_email_format_returns_422(fresh_app) -> None:
    """Path/query validation runs before the DB hit — invalid → 422.

    Confirms the regex on the ``email`` query parameter rejects
    obvious garbage so the rate-limit bucket isn't burned by
    malformed input. 422 instead of 400 because that's FastAPI's
    Pydantic-validation default and tooling expects it.
    """
    client, engine = fresh_app
    _seed_order(engine)

    r = client.get("/track/PO-PHASE16-001", params={"email": "not-an-email"})
    assert r.status_code == 422


def test_po_not_in_db_returns_generic_404(fresh_app) -> None:
    """Unknown PO → 404 with the same generic detail as every miss."""
    client, _ = fresh_app
    r = client.get("/track/PO-NEVER-EXISTED", params={"email": "x@example.com"})
    assert r.status_code == 404
    assert "Order not found" in r.json()["detail"]


def test_cancelled_order_returns_step_zero_and_note(fresh_app) -> None:
    """Status 99 → current_step=0, cancelled flag, bilingual note.

    The storefront switches its UI tone (rose card, "annulée" badge)
    on the cancelled flag rather than re-deriving from status_id, so
    we pin that the server populates *both* fields.
    """
    client, engine = fresh_app
    _seed_order(
        engine,
        po_number="PO-CANCELLED-001",
        status_id=99,
        tracking_numbers=[],
    )

    r = client.get(
        "/track/PO-CANCELLED-001",
        params={"email": "shopper@example.com"},
        headers={"Accept-Language": "en-US,en;q=0.9"},
    )
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["current_step"] == 0
    assert body["status_id"] == 99
    assert body["cancelled"] is True
    assert body["status_label"] == "Cancelled"
    assert body["lang"] == "en"
    assert "cancellation_note" in body


def test_rate_limit_kicks_in_at_eleventh_request_in_a_minute(fresh_app) -> None:
    """11 requests inside the 10/min ceiling → final one is 429.

    We don't sleep through a real 60s window because that crawls the
    suite. The slowapi limiter is keyed on remote address +
    in-memory storage, so within a single process all 11 hits land
    in the same bucket — request #11 must be rejected.
    """
    client, engine = fresh_app
    _seed_order(engine)

    statuses: list[int] = []
    for _ in range(11):
        r = client.get(
            "/track/PO-PHASE16-001",
            params={"email": "shopper@example.com"},
        )
        statuses.append(r.status_code)

    # The first 10 should pass (200), the 11th must be 429.
    assert statuses[:10].count(200) == 10, statuses
    assert statuses[10] == 429, statuses


def test_missing_customer_email_on_row_returns_404(fresh_app) -> None:
    """Legacy rows pre-Phase 16 may lack ``customer_email`` — the
    endpoint must 404 those rather than letting through a request
    that can't actually be email-verified."""
    client, engine = fresh_app
    factory = make_session_factory(engine)
    with factory() as session:
        session.add(
            OrderRow(
                po_number="PO-LEGACY-001",
                customer_email=None,
                status_id=10,
            )
        )
        session.commit()

    r = client.get(
        "/track/PO-LEGACY-001",
        params={"email": "anyone@example.com"},
    )
    assert r.status_code == 404


def test_email_match_is_case_insensitive(fresh_app) -> None:
    """Customers paste their email with random capitalisation; we
    don't want a casing mismatch to look like a real "wrong email"
    miss. Lowercased compare on both sides."""
    client, engine = fresh_app
    _seed_order(engine, customer_email="Shopper@Example.COM")

    r = client.get(
        "/track/PO-PHASE16-001", params={"email": "shopper@example.com"}
    )
    assert r.status_code == 200, r.text


def test_map_to_4_step_handles_every_documented_status() -> None:
    """Pure-function unit test on the status-bucket mapper. Pins the
    table so a future SanMar code addition forces a deliberate update
    here rather than silently hitting the default branch."""
    assert map_to_4_step(10) == 1
    assert map_to_4_step(11) == 1
    assert map_to_4_step(41) == 2
    assert map_to_4_step(44) == 2
    assert map_to_4_step(60) == 3
    assert map_to_4_step(75) == 3
    assert map_to_4_step(80) == 4
    assert map_to_4_step(99) == 0
    # Unknown / missing → safe default.
    assert map_to_4_step(None) == 1
    assert map_to_4_step(123) == 1
