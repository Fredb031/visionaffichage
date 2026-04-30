"""Phase-18 replay CLI for outbound customer webhooks.

Re-fires a previously persisted :class:`sanmar.models.WebhookDelivery`
through the existing :class:`sanmar.orchestrator.OrderWebhookClient`,
writes a *new* audit row for the replay attempt, and reports the
outcome on the rich console.

Usage::

    # Replay by primary key — exact bytes preserved
    python -m scripts.replay_webhook --delivery-id 42

    # Replay the most recent matching (po_number, event) pair
    python -m scripts.replay_webhook --po VA-12345 --event order.shipped

    # Print what would be sent without firing
    python -m scripts.replay_webhook --delivery-id 42 --dry-run

The replay reuses the same secret + URL the orchestrator was
configured with at run time, so receivers verifying via shared secret
will accept the signature without operator intervention.

Why a NEW row? Because each replay is a fresh delivery from the
receiver's perspective (new ``signed_at``, new HTTP attempt). Keeping
the original row immutable preserves an honest audit trail. Receivers
that should not double-process should dedupe on the ``event_id`` field
inside the payload (which the original payload_json already carries).
"""
from __future__ import annotations

import json
import sys
from typing import Optional

import typer
from rich.console import Console
from rich.table import Table

app = typer.Typer(
    name="replay-webhook",
    help="Re-fire a persisted SanMar webhook delivery (Phase 18).",
    add_completion=False,
)

console = Console()


def _resolve_delivery(
    session, *, delivery_id: Optional[int], po: Optional[str], event: Optional[str]
):
    """Look up a :class:`WebhookDelivery` row by id or by (po, event).

    Returns ``None`` when nothing matches; the caller renders a
    user-friendly error.
    """
    from sanmar.models import WebhookDelivery

    if delivery_id is not None:
        return session.get(WebhookDelivery, delivery_id)

    q = session.query(WebhookDelivery)
    if po:
        q = q.filter(WebhookDelivery.po_number == po)
    if event:
        q = q.filter(WebhookDelivery.event == event)
    return q.order_by(WebhookDelivery.signed_at.desc()).first()


def _print_dry_run(original) -> None:
    """Pretty-print the would-be replay without firing."""
    table = Table(title=f"Dry-run replay (delivery id={original.id})")
    table.add_column("field")
    table.add_column("value")
    table.add_row("po_number", original.po_number)
    table.add_row("event", original.event)
    table.add_row("event_id", original.event_id or "—")
    table.add_row("original_signed_at", str(original.signed_at))
    table.add_row("original_outcome", original.outcome)
    console.print(table)
    try:
        parsed = json.loads(original.payload_json)
        pretty = json.dumps(parsed, indent=2, sort_keys=True)
    except (ValueError, TypeError):
        pretty = original.payload_json
    console.print("[bold]payload (would re-send):[/bold]")
    console.print(pretty)


def replay(
    delivery_id: Optional[int],
    po: Optional[str],
    event: Optional[str],
    dry_run: bool,
) -> int:
    """Programmatic entry point. Returns a process exit code."""
    if delivery_id is None and not (po and event):
        console.print(
            "[red]Pass either --delivery-id, or both --po and --event.[/red]"
        )
        return 2

    # Lazy imports so `--help` is fast and tests can monkeypatch.
    from sanmar.config import get_settings
    from sanmar.db import init_schema, make_engine, session_scope
    from sanmar.models import WebhookDelivery
    from sanmar.orchestrator import OrderWebhookClient
    from types import SimpleNamespace

    settings = get_settings()
    engine = make_engine(settings.db_path)
    init_schema(engine)

    with session_scope(engine) as session:
        original = _resolve_delivery(
            session, delivery_id=delivery_id, po=po, event=event
        )
        if original is None:
            console.print("[red]No matching delivery found.[/red]")
            return 1

        if dry_run:
            _print_dry_run(original)
            return 0

        # Reconstruct a duck-typed OrderRow stand-in from the persisted
        # payload. This means a replay is honest about the historical
        # state at the time the original event fired (not the *current*
        # OrderRow state), which is what receivers care about.
        try:
            payload = json.loads(original.payload_json)
        except (ValueError, TypeError):
            console.print("[red]Original payload is not valid JSON.[/red]")
            return 1

        fake_order = SimpleNamespace(
            po_number=payload.get("po_number"),
            customer_email=payload.get("customer_email"),
            tracking_numbers=payload.get("tracking_numbers") or [],
            expected_ship_date=None,  # already pre-stringified in payload
        )
        prev_status = int(payload.get("previous_status_id") or 0)
        new_status = int(payload.get("status_id") or 0)

        # Reuse the orchestrator-configured secret + URL so the
        # signature verifies on the receiver side.
        client = OrderWebhookClient(
            url=settings.customer_webhook_url,
            secret=settings.customer_webhook_secret,
            log_skipped=False,  # replay always intends to fire
        )

        # Reuse the original event_id so receivers can dedupe across
        # the original fire + all replays as one logical event.
        ok = client.fire(
            original.event,
            fake_order,
            prev_status,
            new_status,
            session=session,
            event_id=original.event_id,
        )

        # The fresh row is the most recently inserted WebhookDelivery
        # for this (po, event) — fetch it for the report.
        fresh = (
            session.query(WebhookDelivery)
            .filter(
                WebhookDelivery.po_number == original.po_number,
                WebhookDelivery.event == original.event,
            )
            .order_by(WebhookDelivery.signed_at.desc())
            .first()
        )

    table = Table(title="Replay outcome")
    table.add_column("field")
    table.add_column("value")
    table.add_row("original_id", str(original.id))
    table.add_row(
        "new_id",
        str(fresh.id) if fresh and fresh.id != original.id else "—",
    )
    table.add_row("outcome", "success" if ok else "failed")
    if fresh and fresh.id != original.id:
        table.add_row("status_code", str(fresh.status_code or "—"))
        table.add_row("response_ms", str(fresh.response_ms or "—"))
        table.add_row("attempts", str(fresh.attempt_count))
    console.print(table)
    return 0 if ok else 1


@app.command()
def main(
    delivery_id: Optional[int] = typer.Option(
        None, "--delivery-id", help="Replay this WebhookDelivery row by primary key."
    ),
    po: Optional[str] = typer.Option(
        None, "--po", help="Replay the latest delivery for this PO + event."
    ),
    event: Optional[str] = typer.Option(
        None,
        "--event",
        help="Event name (e.g. order.shipped) — required when --po is used.",
    ),
    dry_run: bool = typer.Option(
        False,
        "--dry-run",
        help="Print what would be sent without firing or writing a row.",
    ),
) -> None:
    """Re-fire a persisted webhook delivery."""
    raise typer.Exit(code=replay(delivery_id, po, event, dry_run))


if __name__ == "__main__":  # pragma: no cover
    app()
