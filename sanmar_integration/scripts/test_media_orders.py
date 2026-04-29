"""Live smoke test for Media Content v1.1.0 + Purchase Order v1.0.0.

Read-only by design. We:

* Call ``getMediaContent`` for style ``NF0A529K`` and pretty-print the
  CDN URLs + bilingual descriptions.
* Build a fake :class:`PurchaseOrderInput` and print the SOAP envelope
  that *would* be sent. We DO NOT call ``submitPO`` — submitting a
  bogus order to UAT pollutes SanMar's transaction log and triggers
  follow-up phone calls from their EDI team.
* Call ``getOrderStatus`` for a placeholder PO. Expect a "not found"
  / empty response — that's success for a smoke test.

Skips silently with exit 0 when the credentials are still placeholders
from `.env.example`, so it's safe to run in CI.

Usage::

    python -m scripts.test_media_orders
"""
from __future__ import annotations

import json
import sys
from datetime import date
from decimal import Decimal
from typing import Callable

from rich.console import Console
from rich.table import Table

from sanmar.config import get_settings
from sanmar.dto import (
    Address,
    LineItem,
    MediaResponse,
    OrderStatusResponse,
    PurchaseOrderInput,
)
from sanmar.services.media import MediaContentService
from sanmar.services.purchase_order import (
    PurchaseOrderService,
    preview_envelope,
)

console = Console()


PLACEHOLDER_VALUES = {"", "your_edi_password", "your_customer_id", "your_media_password"}


def _is_placeholder(s: str) -> bool:
    return s.strip() in PLACEHOLDER_VALUES


def _run(label: str, fn: Callable[[], object]) -> bool:
    try:
        result = fn()
    except Exception as exc:  # noqa: BLE001 - smoke test surfaces anything
        console.print(f"[red]✗[/red] {label}: {type(exc).__name__}: {exc}")
        return False

    if isinstance(result, MediaResponse):
        table = Table(title=f"Media — {result.style_number}")
        table.add_column("#", justify="right")
        table.add_column("Type")
        table.add_column("URL", overflow="fold")
        table.add_column("FR")
        table.add_column("EN")
        for i, item in enumerate(result.items):
            for j, url in enumerate(item.all_urls):
                table.add_row(
                    str(i + 1) if j == 0 else "",
                    item.media_type if j == 0 else "",
                    url,
                    item.description_fr if j == 0 else "",
                    item.description_en if j == 0 else "",
                )
        console.print(
            f"[green]✓[/green] {label}: {len(result.items)} media nodes, "
            f"{sum(len(i.all_urls) for i in result.items)} URLs"
        )
        console.print(table)
    elif isinstance(result, OrderStatusResponse):
        console.print(
            f"[green]✓[/green] {label}: order={result.order_number} "
            f"status={result.status_id} ({result.status_description}) "
            f"shipDate={result.expected_ship_date or '—'} "
            f"tracking={', '.join(result.tracking_numbers) or '—'}"
        )
    else:
        console.print(f"[green]✓[/green] {label}: {result!r}")
    return True


def _build_fake_order() -> PurchaseOrderInput:
    """Construct a realistic-looking but fake PurchaseOrderInput. Used
    only for envelope-preview — never submitted."""
    ship = Address(
        name="Frederick Bouchard",
        company="Vision Affichage",
        address_line_1="123 Rue Sainte-Catherine",
        address_line_2="Bureau 200",
        city="Montréal",
        state_province="QC",
        postal_code="H2X 1Y4",
        country="CA",
        phone="514-555-0123",
        email="orders@visionaffichage.ca",
    )
    return PurchaseOrderInput(
        po_number="PO-SMOKE-0001",
        customer_po="CUST-SMOKE-0001",
        ship_to=ship,
        bill_to=ship,
        line_items=[
            LineItem(
                style_number="PC54",
                color="Black",
                size="L",
                quantity=12,
                line_price=Decimal("9.99"),
            ),
            LineItem(
                style_number="PC54",
                color="Black",
                size="XL",
                quantity=6,
                line_price=Decimal("9.99"),
            ),
        ],
        carrier="ups",  # exercise the lower-case → UPS normalization
        payment_terms="NET30",
        requested_ship_date=date(2026, 5, 15),
    )


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
        f"[bold]SanMar Phase 4 smoke test[/bold] — env={settings.env} "
        f"base_url={settings.base_url}"
    )

    media = MediaContentService(settings)
    po = PurchaseOrderService(settings)

    ok = True

    # 1) Media — only attempt if a media password is configured.
    if _is_placeholder(settings.media_password):
        console.print(
            "[yellow]Media password not set — skipping media smoke[/yellow]"
        )
    else:
        ok &= _run(
            "get_product_images('NF0A529K')",
            lambda: media.get_product_images("NF0A529K"),
        )

    # 2) Purchase order envelope preview (NO submit).
    fake_order = _build_fake_order()
    envelope = preview_envelope(fake_order)
    console.print("[bold]Envelope preview (NOT submitted):[/bold]")
    console.print(json.dumps(envelope, indent=2, default=str))

    # 3) Order status — expect not-found for a fake PO; that's the test.
    ok &= _run(
        "get_order_status('PO-SMOKE-0001')",
        lambda: po.get_order_status(po_number="PO-SMOKE-0001"),
    )

    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main())
