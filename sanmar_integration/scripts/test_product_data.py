"""Live smoke test for the Product Data v2.0.0 wrapper.

Invokes three operations against the configured SanMar environment
(default UAT) and prints a green ✓ / red ✗ status per call. Skips
silently with exit 0 when credentials are still the placeholder values
from `.env.example` so this is safe to run in CI.

Usage::

    python -m scripts.test_product_data
"""
from __future__ import annotations

import sys
from typing import Callable

from rich.console import Console

from sanmar.config import get_settings
from sanmar.services.product_data import ProductDataService

console = Console()


PLACEHOLDER_VALUES = {"", "your_edi_password", "your_customer_id"}


def _is_placeholder(s: str) -> bool:
    return s.strip() in PLACEHOLDER_VALUES


def _run(label: str, fn: Callable[[], object]) -> bool:
    try:
        result = fn()
    except Exception as exc:  # noqa: BLE001 - smoke test, surface anything
        console.print(f"[red]✗[/red] {label}: {type(exc).__name__}: {exc}")
        return False

    # Pretty-print whatever the call returned, truncated.
    if isinstance(result, list):
        console.print(
            f"[green]✓[/green] {label}: {len(result)} items; "
            f"first 5 = {result[:5]}"
        )
    else:
        console.print(f"[green]✓[/green] {label}: {result!r}")
    return True


def main() -> int:
    settings = get_settings()
    if _is_placeholder(settings.password) or _is_placeholder(
        settings.customer_id
    ):
        console.print(
            "[yellow]Credentials not set, skipping live test[/yellow]"
        )
        return 0

    console.print(
        f"[bold]SanMar smoke test[/bold] — env={settings.env} "
        f"base_url={settings.base_url}"
    )

    svc = ProductDataService(settings)

    ok = True
    ok &= _run(
        "get_product('NF0A529K')",
        lambda: svc.get_product("NF0A529K"),
    )
    ok &= _run(
        "get_product_sellable('PC54')",
        lambda: svc.get_product_sellable("PC54"),
    )
    ok &= _run(
        "get_all_active_parts()",
        lambda: svc.get_all_active_parts(),
    )

    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main())
