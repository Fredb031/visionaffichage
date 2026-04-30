"""Phase-18 unit tests for ``WebhookDelivery`` persistence.

Covers the audit-log path threaded into
:meth:`sanmar.orchestrator.OrderWebhookClient.fire`:

1. Successful 2xx delivery persists ``outcome='success'`` with status
   code, ms, and signature populated.
2. 5xx → retry → 5xx persists ``attempt_count=2`` and
   ``outcome='failed'``.
3. Connection error persists with ``error`` populated and
   ``status_code is None``.
4. URL-unset writes nothing by default and writes
   ``outcome='skipped'`` when ``log_skipped=True``.
5. Response body larger than the 4 KB cap is truncated with the
   marker.
"""
from __future__ import annotations

from datetime import datetime, timezone
from types import SimpleNamespace
from unittest.mock import MagicMock, patch

import pytest
import requests

from sanmar.db import init_schema, make_engine, session_scope
from sanmar.models import (
    WEBHOOK_BODY_TRUNCATION_MARKER,
    WEBHOOK_RESPONSE_BODY_CAP_BYTES,
    WebhookDelivery,
)
from sanmar.orchestrator import OrderWebhookClient


def _fake_order(**overrides):
    base = dict(
        po_number="VA-PERSIST-1",
        customer_email="ops@acme.ca",
        expected_ship_date=datetime(2026, 5, 1, tzinfo=timezone.utc),
        tracking_numbers=["1Z999AA10123456784"],
    )
    base.update(overrides)
    return SimpleNamespace(**base)


@pytest.fixture
def engine(tmp_path):
    db = tmp_path / "wh.db"
    eng = make_engine(db)
    init_schema(eng)
    return eng


# ── 1. Success path persists outcome='success' ──────────────────────


def test_success_persists_row_with_status_200(engine) -> None:
    client = OrderWebhookClient(
        url="https://customer.example.com/hook", secret="s3cr3t"
    )

    response = MagicMock(status_code=200)
    response.text = "ok"

    with patch("sanmar.orchestrator.requests.post", return_value=response):
        with session_scope(engine) as session:
            ok = client.fire(
                "order.shipped", _fake_order(), 60, 80, session=session
            )

    assert ok is True
    with session_scope(engine) as session:
        rows = session.query(WebhookDelivery).all()
    assert len(rows) == 1
    row = rows[0]
    assert row.po_number == "VA-PERSIST-1"
    assert row.event == "order.shipped"
    assert row.outcome == "success"
    assert row.status_code == 200
    assert row.attempt_count == 1
    assert row.response_body == "ok"
    assert row.response_ms is not None and row.response_ms >= 0
    assert row.signature_hex  # non-empty
    assert row.error is None
    assert row.event_id  # uuid present


# ── 2. 5xx + 5xx → outcome='failed', attempt_count=2 ────────────────


def test_double_5xx_persists_failed_with_attempt_count_two(engine) -> None:
    client = OrderWebhookClient(
        url="https://customer.example.com/hook", secret="s3cr3t"
    )

    bad1 = MagicMock(status_code=500)
    bad1.text = "internal err"
    bad2 = MagicMock(status_code=502)
    bad2.text = "bad gateway"

    with patch(
        "sanmar.orchestrator.requests.post", side_effect=[bad1, bad2]
    ), patch("sanmar.orchestrator.time.sleep"):
        with session_scope(engine) as session:
            ok = client.fire(
                "order.shipped", _fake_order(), 60, 80, session=session
            )

    assert ok is False
    with session_scope(engine) as session:
        rows = session.query(WebhookDelivery).all()
    assert len(rows) == 1
    row = rows[0]
    assert row.outcome == "failed"
    assert row.attempt_count == 2
    assert row.status_code == 502  # last response observed


# ── 3. Connection error persists with error and null status ─────────


def test_connection_error_persists_with_error_and_null_status(engine) -> None:
    client = OrderWebhookClient(
        url="https://customer.example.com/hook", secret="s3cr3t"
    )

    with patch(
        "sanmar.orchestrator.requests.post",
        side_effect=requests.ConnectionError("DNS fail"),
    ), patch("sanmar.orchestrator.time.sleep"):
        with session_scope(engine) as session:
            ok = client.fire(
                "order.shipped", _fake_order(), 60, 80, session=session
            )

    assert ok is False
    with session_scope(engine) as session:
        rows = session.query(WebhookDelivery).all()
    assert len(rows) == 1
    row = rows[0]
    assert row.outcome == "failed"
    assert row.attempt_count == 2  # connection error retries
    assert row.status_code is None
    assert row.error == "ConnectionError"


# ── 4. URL unset → no row by default; row by config flag ────────────


def test_unset_url_writes_nothing_by_default(engine) -> None:
    client = OrderWebhookClient(url=None, secret="anything")
    with session_scope(engine) as session:
        ok = client.fire(
            "order.shipped", _fake_order(), 60, 80, session=session
        )
    assert ok is False
    with session_scope(engine) as session:
        assert session.query(WebhookDelivery).count() == 0


def test_unset_url_writes_skipped_when_flag_on(engine) -> None:
    client = OrderWebhookClient(url=None, secret=None, log_skipped=True)
    with session_scope(engine) as session:
        ok = client.fire(
            "order.shipped", _fake_order(), 60, 80, session=session
        )
    assert ok is False
    with session_scope(engine) as session:
        rows = session.query(WebhookDelivery).all()
    assert len(rows) == 1
    row = rows[0]
    assert row.outcome == "skipped"
    assert row.po_number == "VA-PERSIST-1"
    assert row.event == "order.shipped"
    assert row.status_code is None
    assert row.attempt_count == 0
    assert row.event_id  # event_id still minted for dedupe


# ── 5. Oversize response bodies are truncated ───────────────────────


def test_response_body_over_cap_is_truncated_with_marker(engine) -> None:
    client = OrderWebhookClient(
        url="https://customer.example.com/hook", secret="s3cr3t"
    )

    bloated = "x" * (WEBHOOK_RESPONSE_BODY_CAP_BYTES + 500)
    response = MagicMock(status_code=200)
    response.text = bloated

    with patch("sanmar.orchestrator.requests.post", return_value=response):
        with session_scope(engine) as session:
            ok = client.fire(
                "order.shipped", _fake_order(), 60, 80, session=session
            )

    assert ok is True
    with session_scope(engine) as session:
        row = session.query(WebhookDelivery).first()
    assert row is not None
    assert row.response_body is not None
    assert row.response_body.endswith(WEBHOOK_BODY_TRUNCATION_MARKER)
    # The truncated portion should be exactly the cap (in bytes); the
    # marker is appended after the cap so total length is cap + marker.
    body_no_marker = row.response_body[: -len(WEBHOOK_BODY_TRUNCATION_MARKER)]
    assert len(body_no_marker.encode("utf-8")) == WEBHOOK_RESPONSE_BODY_CAP_BYTES


# ── 6. Backwards-compat: HMAC still verifies after event_id added ───


def test_event_id_does_not_break_existing_hmac_recipe(engine) -> None:
    """Receivers using the documented verify recipe (drop hmac_signature,
    re-sign) still pass even though event_id is now part of the body."""
    import hashlib
    import hmac
    import json as _json

    secret = "shared-with-receiver"
    client = OrderWebhookClient(
        url="https://customer.example.com/hook", secret=secret
    )

    captured: dict = {}

    def _capture(url, data=None, headers=None, timeout=None, **_):
        captured["body"] = data
        captured["headers"] = dict(headers or {})
        return MagicMock(status_code=200, text="ok")

    with patch("sanmar.orchestrator.requests.post", side_effect=_capture):
        with session_scope(engine) as session:
            client.fire("order.shipped", _fake_order(), 60, 80, session=session)

    payload = _json.loads(captured["body"].decode("utf-8"))
    assert "event_id" in payload  # additive field is present
    assert payload["event_id"]  # non-empty uuid

    # Re-derive signature exactly as the receiver would.
    sent_sig = captured["headers"]["X-Sanmar-Signature"]
    pre_mirror = {k: v for k, v in payload.items() if k != "hmac_signature"}
    canonical = _json.dumps(pre_mirror, sort_keys=True, default=str).encode(
        "utf-8"
    )
    expected = hmac.new(
        secret.encode("utf-8"), canonical, hashlib.sha256
    ).hexdigest()
    assert hmac.compare_digest(expected, sent_sig)
