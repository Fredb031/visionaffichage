"""Phase 14 — Cloudflare Workers edge cache hit-ratio report.

Queries the Cloudflare GraphQL Analytics API for the
``sanmar_edge_cache`` Workers Analytics Engine dataset, aggregates by
``(operation, outcome)``, and renders a Rich table with the 24-hour
hit ratio per operation.

Designed to be cron-able as a health check: exits ``0`` when every
operation is at or above the 50% hit-ratio threshold, ``1`` otherwise.
The non-zero exit lets ``cron`` / ``systemd`` mail or page the operator
without any extra glue.

Env vars
--------
``CLOUDFLARE_ACCOUNT_ID``
    The numeric Cloudflare account ID hosting the worker.
``CLOUDFLARE_API_TOKEN``
    A scoped API token with the ``Account · Account Analytics · Read``
    permission. The token is sent as ``Authorization: Bearer …``.
``SANMAR_EDGE_CACHE_DATASET``
    Optional override for the dataset name. Defaults to
    ``sanmar_edge_cache`` (matches ``wrangler.toml``).

CLI usage
---------
::

    python -m scripts.edge_cache_report --days 1
    python -m sanmar edge-report  # via the Typer wrapper

Exit codes
----------
* ``0`` — every operation has hit ratio ≥ ``HEALTHY_HIT_RATIO``.
* ``1`` — at least one operation is below the threshold (or no data).
"""
from __future__ import annotations

import argparse
import os
import sys
from collections import defaultdict
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional, Tuple

import requests
from rich.console import Console
from rich.table import Table

from sanmar.exceptions import SanmarApiError

CLOUDFLARE_GRAPHQL_URL = "https://api.cloudflare.com/client/v4/graphql"
DEFAULT_DATASET = "sanmar_edge_cache"
HEALTHY_HIT_RATIO = 0.50  # operations below this trip exit code 1

# GraphQL query template. Cloudflare exposes Workers Analytics Engine
# data via the ``workersAnalyticsEngineAdaptiveGroups`` view. We bind
# the account tag, dataset, and datetime window via inline string
# interpolation rather than GraphQL variables because Cloudflare's
# adaptive-groups filter scalars are quoted strings, not typed inputs.
_QUERY_TEMPLATE = """
{{
  viewer {{
    accounts(filter: {{ accountTag: "{account_tag}" }}) {{
      workersAnalyticsEngineAdaptiveGroups(
        filter: {{ datetime_geq: "{start}", datetime_leq: "{end}", dataset: "{dataset}" }}
        limit: 10000
      ) {{
        dimensions {{
          blob1
          blob2
          blob3
          index1
        }}
        count
      }}
    }}
  }}
}}
""".strip()


@dataclass
class OperationStats:
    """Aggregated counts for a single operation (e.g. ``products``)."""

    operation: str
    hits: int = 0
    misses: int = 0
    bypass: int = 0

    @property
    def total(self) -> int:
        return self.hits + self.misses + self.bypass

    @property
    def hit_ratio(self) -> float:
        # Bypass requests are excluded from the denominator — they
        # never *could* have hit the cache, so counting them would
        # artificially deflate the ratio for write-heavy operations.
        cacheable = self.hits + self.misses
        if cacheable == 0:
            return 0.0
        return self.hits / cacheable


def _required_env(name: str) -> str:
    """Read a required env var or raise with a friendly message."""
    value = os.getenv(name)
    if not value:
        raise SanmarApiError(
            f"Missing required env var {name!r}. Set it before running "
            "the edge cache report (see deploy/cloudflare/README.md).",
            operation="edge_cache_report",
        )
    return value


def _build_window(days: int) -> Tuple[str, str]:
    """Return ISO-8601 ``(start, end)`` covering the last ``days`` days."""
    end = datetime.now(tz=timezone.utc).replace(microsecond=0)
    start = end - timedelta(days=days)
    return start.isoformat().replace("+00:00", "Z"), end.isoformat().replace("+00:00", "Z")


def fetch_edge_cache_groups(
    account_id: str,
    api_token: str,
    *,
    days: int = 1,
    dataset: str = DEFAULT_DATASET,
    session: Optional[requests.Session] = None,
) -> List[Dict[str, Any]]:
    """Hit Cloudflare's GraphQL API and return the raw adaptive-groups list.

    Parameters
    ----------
    account_id, api_token
        Credentials. ``api_token`` needs ``Account Analytics:Read``.
    days
        Window to query — typically ``1`` for the daily health check.
    dataset
        Analytics Engine dataset name — ``sanmar_edge_cache`` by
        default (must match ``wrangler.toml``).
    session
        Optional ``requests.Session`` injected for testing. Production
        callers should leave this ``None`` so a fresh session is used.

    Raises
    ------
    SanmarApiError
        On any non-2xx response or GraphQL-level error.
    """
    start, end = _build_window(days)
    query = _QUERY_TEMPLATE.format(
        account_tag=account_id,
        start=start,
        end=end,
        dataset=dataset,
    )
    http = session or requests.Session()
    try:
        resp = http.post(
            CLOUDFLARE_GRAPHQL_URL,
            json={"query": query},
            headers={
                "Authorization": f"Bearer {api_token}",
                "Content-Type": "application/json",
            },
            timeout=30,
        )
    except requests.RequestException as exc:  # pragma: no cover - network
        raise SanmarApiError(
            f"Cloudflare GraphQL request failed: {exc}",
            operation="edge_cache_report",
        ) from exc

    if resp.status_code >= 400:
        raise SanmarApiError(
            f"Cloudflare GraphQL returned HTTP {resp.status_code}: "
            f"{resp.text[:200]}",
            code=str(resp.status_code),
            operation="edge_cache_report",
        )

    payload = resp.json()
    if payload.get("errors"):
        raise SanmarApiError(
            f"Cloudflare GraphQL errors: {payload['errors']}",
            operation="edge_cache_report",
        )

    accounts = (
        payload.get("data", {}).get("viewer", {}).get("accounts") or []
    )
    if not accounts:
        return []
    return accounts[0].get("workersAnalyticsEngineAdaptiveGroups", []) or []


def aggregate(groups: List[Dict[str, Any]]) -> Dict[str, OperationStats]:
    """Roll the raw adaptive-groups list up into one row per operation."""
    by_op: Dict[str, OperationStats] = defaultdict(
        lambda: OperationStats(operation="unknown")
    )
    for group in groups:
        dims = group.get("dimensions") or {}
        operation = dims.get("index1") or "unknown"
        outcome = (dims.get("blob3") or "").lower()
        count = int(group.get("count") or 0)

        stats = by_op.setdefault(operation, OperationStats(operation=operation))
        if outcome == "hit":
            stats.hits += count
        elif outcome == "miss":
            stats.misses += count
        elif outcome == "bypass":
            stats.bypass += count
        # Unknown outcomes are dropped on the floor by design — better
        # to under-report than to inflate the totals with garbage.
    return dict(by_op)


def render_table(stats: Dict[str, OperationStats], *, console: Console) -> None:
    """Print the per-operation hit ratio table to ``console``."""
    if not stats:
        console.print(
            "[yellow]No edge cache telemetry in the requested window.[/yellow] "
            "Either traffic is zero or the worker hasn't been deployed yet."
        )
        return

    table = Table(title="SanMar edge cache — 24h hit ratio")
    table.add_column("Operation", style="cyan")
    table.add_column("Requests", justify="right")
    table.add_column("Hits", justify="right")
    table.add_column("Misses", justify="right")
    table.add_column("Bypass", justify="right")
    table.add_column("Hit Ratio", justify="right")

    # Sort by total descending so the busiest operation lands on top.
    for op in sorted(stats.values(), key=lambda s: s.total, reverse=True):
        ratio_pct = op.hit_ratio * 100
        ratio_str = f"{ratio_pct:5.1f}%"
        if op.hit_ratio < HEALTHY_HIT_RATIO and (op.hits + op.misses) > 0:
            ratio_str = f"[bold red]{ratio_str}[/bold red]"
        table.add_row(
            op.operation,
            f"{op.total:,}",
            f"{op.hits:,}",
            f"{op.misses:,}",
            f"{op.bypass:,}",
            ratio_str,
        )
    console.print(table)


def evaluate_health(stats: Dict[str, OperationStats]) -> int:
    """Return the exit code: ``0`` healthy, ``1`` degraded."""
    if not stats:
        # No data is treated as degraded — either nothing's flowing
        # or telemetry is broken; either way the operator should look.
        return 1
    for op in stats.values():
        if (op.hits + op.misses) == 0:
            continue  # only bypass traffic — doesn't affect health
        if op.hit_ratio < HEALTHY_HIT_RATIO:
            return 1
    return 0


def main(argv: Optional[List[str]] = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument(
        "--days",
        type=int,
        default=1,
        help="Lookback window in days (default: 1).",
    )
    parser.add_argument(
        "--dataset",
        default=os.getenv("SANMAR_EDGE_CACHE_DATASET", DEFAULT_DATASET),
        help="Analytics Engine dataset name.",
    )
    args = parser.parse_args(argv)

    console = Console()
    try:
        account_id = _required_env("CLOUDFLARE_ACCOUNT_ID")
        api_token = _required_env("CLOUDFLARE_API_TOKEN")
        groups = fetch_edge_cache_groups(
            account_id,
            api_token,
            days=args.days,
            dataset=args.dataset,
        )
    except SanmarApiError as exc:
        console.print(f"[bold red]error:[/bold red] {exc.message}")
        return 1

    stats = aggregate(groups)
    render_table(stats, console=console)
    return evaluate_health(stats)


if __name__ == "__main__":  # pragma: no cover
    sys.exit(main())
