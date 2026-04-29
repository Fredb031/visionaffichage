"""Live smoke test for Phase 5 — Shipment + Invoice + Bulk Data.

Read-only by design. Skips silently with exit 0 when the credentials
are still placeholders from `.env.example`, so it's safe to run in CI.

Usage::

    python -m scripts.test_shipment_invoice_bulk
"""
from __future__ import annotations

import sys
from datetime import datetime, timedelta, timezone
from typing import Callable

from rich.console import Console
from rich.table import Table

from sanmar.config import get_settings
from sanmar.dto import (
    BulkDataResponse,
    Invoice,
    ShipmentNotification,
)
from sanmar.services.bulk_data import BulkDataService
from sanmar.services.invoice import InvoiceService
from sanmar.services.shipment import ShipmentService

console = Console()


PLACEHOLDER_VALUES = {
    "",
    "your_edi_password",
    "your_customer_id",
    "your_media_password",
}


def _is_placeholder(s: str) -> bool:
    return s.strip() in PLACEHOLDER_VALUES


def _run(label: str, fn: Callable[[], object]) -> bool:
    try:
        result = fn()
    except Exception as exc:  # noqa: BLE001 - smoke test surfaces anything
        console.print(f"[red]✗[/red] {label}: {type(exc).__name__}: {exc}")
        return False

    if isinstance(result, list) and result and isinstance(
        result[0], ShipmentNotification
    ):
        table = Table(title=f"Shipments — {len(result)} rows")
        table.add_column("PO")
        table.add_column("Carrier")
        table.add_column("Tracking", overflow="fold")
        table.add_column("Ship Date")
        table.add_column("Lines", justify="right")
        for n in result:
            table.add_row(
                n.po_number,
                n.carrier,
                n.tracking_number,
                str(n.ship_date) if n.ship_date else "—",
                str(len(n.line_items)),
            )
        console.print(f"[green]✓[/green] {label}: {len(result)} shipments")
        console.print(table)
    elif isinstance(result, list) and result and isinstance(result[0], Invoice):
        table = Table(title=f"Open invoices — {len(result)}")
        table.add_column("Invoice")
        table.add_column("PO")
        table.add_column("Total", justify="right")
        table.add_column("Balance", justify="right")
        table.add_column("Status")
        for inv in result:
            table.add_row(
                inv.invoice_number,
                inv.po_number,
                str(inv.total),
                str(inv.balance_due),
                inv.status,
            )
        console.print(f"[green]✓[/green] {label}: {len(result)} invoices")
        console.print(table)
    elif isinstance(result, BulkDataResponse):
        console.print(
            f"[green]✓[/green] {label}: {result.total_changes} changes "
            f"window=({result.window_start} → {result.window_end})"
        )
    else:
        console.print(
            f"[green]✓[/green] {label}: "
            f"{type(result).__name__} count={len(result) if hasattr(result, '__len__') else '?'}"
        )
    return True


def main() -> int:
    settings = get_settings()
    if (
        _is_placeholder(settings.password)
        or _is_placeholder(settings.customer_id)
    ):
        console.print(
            "[yellow]Credentials not set, skipping live test[/yellow]"
        )
        return 0

    console.print(
        f"[bold]SanMar Phase 5 smoke test[/bold] — env={settings.env} "
        f"base_url={settings.base_url}"
    )

    shipment = ShipmentService(settings)
    invoice = InvoiceService(settings)
    bulk = BulkDataService(settings)

    ok = True

    thirty_days_ago = datetime.now(tz=timezone.utc) - timedelta(days=30)
    yesterday = datetime.now(tz=timezone.utc) - timedelta(days=1)

    # 1) Shipments — last 30d.
    ok &= _run(
        f"get_shipment_notifications(since={thirty_days_ago.date()})",
        lambda: shipment.get_shipment_notifications(since=thirty_days_ago),
    )

    # 2) Open invoices — last 30d.
    ok &= _run(
        f"get_open_invoices(since={thirty_days_ago.date()})",
        lambda: invoice.get_open_invoices(since=thirty_days_ago),
    )

    # 3) Bulk product delta — yesterday → now (small response).
    ok &= _run(
        f"get_product_data_delta(since={yesterday.date()})",
        lambda: bulk.get_product_data_delta(since=yesterday),
    )

    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main())
