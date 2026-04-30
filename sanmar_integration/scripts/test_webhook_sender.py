"""Manual smoke CLI for the Phase-17 customer webhook plumbing.

Builds a fake :class:`sanmar.models.OrderRow` simulating a status
transition from 60 (Picked) → 80 (Complete / Shipped) and fires it at
the configured customer webhook endpoint. The point is to let an
operator verify connectivity, HMAC verification, and payload shape on
the *receiver* side before any real order movement happens.

Usage::

    SANMAR_CUSTOMER_WEBHOOK_URL=https://your-receiver.example.com/hook \\
    SANMAR_CUSTOMER_WEBHOOK_SECRET=test_secret \\
    python -m scripts.test_webhook_sender

Exits ``0`` on a 2xx receiver response, ``1`` otherwise (so it can be
chained into a deploy gate).
"""
from __future__ import annotations

import sys
from datetime import datetime, timedelta, timezone
from types import SimpleNamespace

from sanmar.config import get_settings
from sanmar.orchestrator import (
    WEBHOOK_EVENTS,
    OrderWebhookClient,
)


def _fake_order_row():
    """Construct a minimal duck-typed OrderRow.

    Using :class:`SimpleNamespace` keeps this script DB-free — no
    SQLAlchemy session required, no fixture loading. The webhook
    client only reads attributes via ``getattr``, so the shape is
    sufficient.
    """
    now = datetime.now(tz=timezone.utc)
    return SimpleNamespace(
        po_number="VA-WEBHOOK-TEST-0001",
        customer_email="ops@example.com",
        customer_po="VISION-TEST-001",
        vision_quote_id="QUOTE-TEST-001",
        status_id=80,
        status_description="Complete / Shipped",
        expected_ship_date=now + timedelta(days=2),
        shipped_at=now,
        tracking_numbers=["1Z999AA10123456784"],
    )


def main(argv: list[str] | None = None) -> int:
    """Fire one webhook and report the outcome."""
    settings = get_settings()
    url = settings.customer_webhook_url
    secret = settings.customer_webhook_secret

    if not url:
        print(
            "SANMAR_CUSTOMER_WEBHOOK_URL is not set — nothing to send.\n"
            "Set both SANMAR_CUSTOMER_WEBHOOK_URL and "
            "SANMAR_CUSTOMER_WEBHOOK_SECRET, then re-run.",
            file=sys.stderr,
        )
        return 1

    client = OrderWebhookClient(url=url, secret=secret)
    order = _fake_order_row()
    event = WEBHOOK_EVENTS[80]  # order.shipped — most useful smoke event

    print(f"firing event={event!r} po={order.po_number!r} → {url}")
    ok = client.fire(event, order, prev_status=60, new_status=80)
    if ok:
        print("OK — receiver returned 2xx. Verify HMAC on the receiver side.")
        return 0
    print(
        "FAIL — receiver did not return 2xx (or all retries exhausted). "
        "Check receiver logs + signature verification.",
        file=sys.stderr,
    )
    return 1


if __name__ == "__main__":  # pragma: no cover
    sys.exit(main())
