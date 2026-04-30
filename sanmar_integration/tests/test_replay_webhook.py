"""Phase-18 unit tests for the ``replay-webhook`` CLI."""
from __future__ import annotations

import json
from datetime import datetime, timezone
from unittest.mock import MagicMock, patch

import pytest

from sanmar.config import Settings
from sanmar.db import init_schema, make_engine, session_scope
from sanmar.models import WebhookDelivery
from scripts.replay_webhook import replay


@pytest.fixture
def engine(tmp_path):
    db = tmp_path / "replay.db"
    eng = make_engine(db)
    init_schema(eng)
    return eng


@pytest.fixture
def seeded_delivery(engine) -> int:
    """Seed one historical WebhookDelivery row and return its id."""
    payload = {
        "event": "order.shipped",
        "event_id": "11111111-1111-1111-1111-111111111111",
        "po_number": "VA-REPLAY-1",
        "customer_email": "ops@acme.ca",
        "previous_status_id": 60,
        "status_id": 80,
        "status_label": "Complete / Shipped",
        "expected_ship_date": "2026-05-01T00:00:00+00:00",
        "tracking_number": "1Z999AA10123456784",
        "tracking_numbers": ["1Z999AA10123456784"],
        "timestamp": "2026-04-29T18:30:00+00:00",
    }
    with session_scope(engine) as session:
        row = WebhookDelivery(
            po_number="VA-REPLAY-1",
            event="order.shipped",
            payload_json=json.dumps(payload, sort_keys=True),
            signature_hex="deadbeef" * 8,
            attempt_count=1,
            status_code=200,
            response_body="ok",
            response_ms=42,
            error=None,
            outcome="success",
            event_id="11111111-1111-1111-1111-111111111111",
            signed_at=datetime(2026, 4, 29, 18, 30, tzinfo=timezone.utc),
        )
        session.add(row)
        session.flush()
        return row.id


def _patched_settings(engine):
    """Settings used by replay() — db_path is irrelevant because the
    test patches make_engine to return the seeded engine directly.
    """
    s = Settings(
        customer_id="cust-replay",
        password="secret-replay",
        media_password="m",
        env="uat",
        customer_webhook_url="https://customer.example.com/hook",
        customer_webhook_secret="s3cr3t",
    )
    return s


# ── 6. Replay by id re-fires + writes a NEW row ─────────────────────


def test_replay_by_id_writes_new_row(engine, seeded_delivery) -> None:
    settings = _patched_settings(engine)

    response = MagicMock(status_code=200)
    response.text = "ok"

    with patch(
        "scripts.replay_webhook.get_settings", return_value=settings
    ), patch(
        "scripts.replay_webhook.make_engine", return_value=engine
    ), patch(
        "sanmar.orchestrator.requests.post", return_value=response
    ):
        code = replay(
            delivery_id=seeded_delivery,
            po=None,
            event=None,
            dry_run=False,
        )

    assert code == 0
    with session_scope(engine) as session:
        rows = (
            session.query(WebhookDelivery)
            .order_by(WebhookDelivery.id)
            .all()
        )
    # One original + one fresh replay = 2 rows.
    assert len(rows) == 2
    fresh = rows[-1]
    assert fresh.id != seeded_delivery
    assert fresh.po_number == "VA-REPLAY-1"
    assert fresh.event == "order.shipped"
    assert fresh.outcome == "success"
    assert fresh.status_code == 200
    # event_id is preserved across replay so receivers can dedupe.
    assert fresh.event_id == "11111111-1111-1111-1111-111111111111"


# ── 7. Dry-run does not fire and does not write ─────────────────────


def test_replay_dry_run_does_not_fire_or_persist(engine, seeded_delivery) -> None:
    settings = _patched_settings(engine)

    with patch(
        "scripts.replay_webhook.get_settings", return_value=settings
    ), patch(
        "scripts.replay_webhook.make_engine", return_value=engine
    ), patch(
        "sanmar.orchestrator.requests.post"
    ) as post:
        code = replay(
            delivery_id=seeded_delivery,
            po=None,
            event=None,
            dry_run=True,
        )

    assert code == 0
    post.assert_not_called()
    with session_scope(engine) as session:
        # Only the seeded row is present.
        assert session.query(WebhookDelivery).count() == 1


# ── extra: error path ───────────────────────────────────────────────


def test_replay_with_no_args_returns_2(engine) -> None:
    """Neither --delivery-id nor (--po + --event) provided → exit 2."""
    code = replay(
        delivery_id=None, po=None, event=None, dry_run=False
    )
    assert code == 2
