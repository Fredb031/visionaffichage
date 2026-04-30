"""Unit tests for the Phase-17 :class:`OrderWebhookClient`.

Covers the contract documented in ``docs/SANMAR_WEBHOOKS.md``:

* No-op when ``url`` is ``None``.
* 2xx response → returns ``True``.
* 5xx response on first attempt → one retry → 2xx → ``True``.
* 5xx + 5xx → returns ``False`` and never raises.
* 4xx → no retry, returns ``False`` and never raises.
* HMAC-SHA256 signature can be re-derived from the body + secret.
"""
from __future__ import annotations

import hashlib
import hmac
import json
from datetime import datetime, timezone
from types import SimpleNamespace
from unittest.mock import MagicMock, patch

import pytest
import requests

from sanmar.orchestrator import (
    WEBHOOK_RETRY_BACKOFF_SECONDS,
    OrderWebhookClient,
)


def _fake_order(**overrides):
    """Minimal duck-typed OrderRow stand-in for the webhook client."""
    base = dict(
        po_number="VA-12345",
        customer_email="ops@acme.ca",
        expected_ship_date=datetime(2026, 5, 1, tzinfo=timezone.utc),
        tracking_numbers=["1Z999AA10123456784"],
    )
    base.update(overrides)
    return SimpleNamespace(**base)


# ── 1. Unset URL → silent no-op ─────────────────────────────────────


def test_fire_noop_when_url_is_none() -> None:
    """An unset URL must produce zero HTTP calls and return False."""
    client = OrderWebhookClient(url=None, secret="anything")
    assert client.enabled is False

    with patch("sanmar.orchestrator.requests.post") as post:
        result = client.fire("order.shipped", _fake_order(), 60, 80)

    assert result is False
    post.assert_not_called()


# ── 2. 200 OK → success on first attempt ─────────────────────────────


def test_fire_returns_true_on_200() -> None:
    """A 2xx response on the first attempt should short-circuit retry."""
    client = OrderWebhookClient(
        url="https://customer.example.com/hook",
        secret="s3cr3t",
    )

    fake_response = MagicMock(status_code=200)
    with patch(
        "sanmar.orchestrator.requests.post", return_value=fake_response
    ) as post, patch("sanmar.orchestrator.time.sleep") as sleep:
        ok = client.fire("order.shipped", _fake_order(), 60, 80)

    assert ok is True
    assert post.call_count == 1
    sleep.assert_not_called()  # no retry path entered

    # 5s timeout per the spec.
    _, kwargs = post.call_args
    assert kwargs["timeout"] == pytest.approx(5.0)


# ── 3. 500 → retries once → 200 second time ─────────────────────────


def test_fire_retries_once_on_5xx_then_succeeds() -> None:
    """A 500 on attempt 1, 200 on attempt 2 must yield overall success."""
    client = OrderWebhookClient(
        url="https://customer.example.com/hook",
        secret="s3cr3t",
    )

    responses = [MagicMock(status_code=500), MagicMock(status_code=200)]
    with patch(
        "sanmar.orchestrator.requests.post", side_effect=responses
    ) as post, patch("sanmar.orchestrator.time.sleep") as sleep:
        ok = client.fire("order.shipped", _fake_order(), 60, 80)

    assert ok is True
    assert post.call_count == 2
    sleep.assert_called_once_with(WEBHOOK_RETRY_BACKOFF_SECONDS)


# ── 4. 500 + 500 → fails gracefully, no exception ───────────────────


def test_fire_two_5xx_failures_returns_false_without_raising() -> None:
    """Exhausted retries must surface as ``False``, never an exception."""
    client = OrderWebhookClient(
        url="https://customer.example.com/hook",
        secret="s3cr3t",
    )

    responses = [MagicMock(status_code=503), MagicMock(status_code=502)]
    with patch(
        "sanmar.orchestrator.requests.post", side_effect=responses
    ) as post, patch("sanmar.orchestrator.time.sleep"):
        ok = client.fire("order.shipped", _fake_order(), 60, 80)

    assert ok is False
    assert post.call_count == 2  # initial + one retry


def test_fire_swallows_connection_error() -> None:
    """A network error must be caught — reconcile cannot abort here."""
    client = OrderWebhookClient(
        url="https://customer.example.com/hook",
        secret="s3cr3t",
    )

    with patch(
        "sanmar.orchestrator.requests.post",
        side_effect=requests.ConnectionError("DNS fail"),
    ), patch("sanmar.orchestrator.time.sleep"):
        # Must not raise.
        ok = client.fire("order.shipped", _fake_order(), 60, 80)

    assert ok is False


# ── 5. 4xx → no retry, fails gracefully ──────────────────────────────


def test_fire_does_not_retry_on_4xx() -> None:
    """A 4xx is terminal — receiver said 'bad payload', retry won't help."""
    client = OrderWebhookClient(
        url="https://customer.example.com/hook",
        secret="s3cr3t",
    )

    with patch(
        "sanmar.orchestrator.requests.post",
        return_value=MagicMock(status_code=400),
    ) as post, patch("sanmar.orchestrator.time.sleep") as sleep:
        ok = client.fire("order.shipped", _fake_order(), 60, 80)

    assert ok is False
    assert post.call_count == 1  # exactly one attempt, no retry
    sleep.assert_not_called()


# ── 6. HMAC signature is correct + verifiable ───────────────────────


def test_hmac_signature_matches_manual_computation() -> None:
    """Re-derive the signature from the captured body and assert match."""
    secret = "shared-with-receiver"
    client = OrderWebhookClient(
        url="https://customer.example.com/hook",
        secret=secret,
    )

    captured: dict = {}

    def _capture(url, data=None, headers=None, timeout=None, **_):
        captured["url"] = url
        captured["body"] = data
        captured["headers"] = dict(headers or {})
        return MagicMock(status_code=200)

    with patch("sanmar.orchestrator.requests.post", side_effect=_capture):
        ok = client.fire(
            "order.shipped",
            _fake_order(),
            prev_status=60,
            new_status=80,
        )

    assert ok is True
    assert captured["url"] == "https://customer.example.com/hook"
    assert captured["headers"]["Content-Type"] == "application/json"
    assert captured["headers"]["X-Sanmar-Event"] == "order.shipped"

    body_bytes: bytes = captured["body"]
    sent_signature = captured["headers"]["X-Sanmar-Signature"]

    # The X-Sanmar-Signature header is computed over the *pre-mirrored*
    # body — i.e. the payload before ``hmac_signature`` is injected.
    # Reconstruct that pre-mirror body by parsing, popping, reserializing.
    payload = json.loads(body_bytes.decode("utf-8"))
    assert payload["event"] == "order.shipped"
    assert payload["po_number"] == "VA-12345"
    assert payload["customer_email"] == "ops@acme.ca"
    assert payload["status_id"] == 80
    assert payload["previous_status_id"] == 60
    assert payload["status_label"] == "Complete / Shipped"
    assert payload["tracking_number"] == "1Z999AA10123456784"
    assert payload["tracking_numbers"] == ["1Z999AA10123456784"]
    assert payload["expected_ship_date"] == "2026-05-01T00:00:00+00:00"
    assert "timestamp" in payload
    # The mirrored signature in-body equals the header.
    assert payload["hmac_signature"] == sent_signature

    # Recompute the header signature exactly as the client did:
    # serialize the payload *without* hmac_signature, sorted keys,
    # default=str — that's the canonical body the header signs.
    pre_mirror = {k: v for k, v in payload.items() if k != "hmac_signature"}
    canonical = json.dumps(pre_mirror, sort_keys=True, default=str).encode(
        "utf-8"
    )
    expected = hmac.new(
        secret.encode("utf-8"), canonical, hashlib.sha256
    ).hexdigest()
    assert sent_signature == expected
