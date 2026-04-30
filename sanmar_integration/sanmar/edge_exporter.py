"""Phase 15 — Cloudflare Worker edge metrics → Prometheus exporter.

Polls the Cloudflare GraphQL Analytics API every 60 seconds, rolls up
the ``sanmar_edge_cache`` Workers Analytics Engine dataset, and exposes
three Prometheus metrics on a long-running ``/metrics`` HTTP endpoint:

* ``sanmar_edge_requests_total{operation, outcome}`` — Counter (cumulative)
* ``sanmar_edge_hit_ratio{operation}`` — Gauge in [0, 1]
* ``sanmar_edge_last_poll_age_seconds`` — Gauge of seconds since last
  successful poll. Climbs forever during a Cloudflare outage; resets to
  zero on each success.

Why a separate exporter (vs. extending :mod:`sanmar.exporter`)?
--------------------------------------------------------------
The existing exporter is a *stateless snapshot collector* — it
recomputes everything from SQLite on each scrape. This one is
fundamentally different: Cloudflare's GraphQL API is rate-limited and
slow (~600ms) so we cannot poll on every Prometheus scrape. Instead we
poll on a 60s cadence in a background thread and let Prometheus scrape
our cached counters at any rate it likes. The two exporters live in
the same process namespace but use disjoint metric prefixes
(``sanmar_*`` vs ``sanmar_edge_*``) and disjoint registries so neither
can corrupt the other.

Counter delta semantics
-----------------------
Cloudflare returns *cumulative* counts for the lookback window. Our
Prometheus :class:`Counter` is also cumulative — but Counter only
exposes ``inc()``, so each poll we compute the *delta* vs the previous
poll's per-(operation, outcome) totals and inc by that delta. If
Cloudflare ever returns a count smaller than what we last saw (e.g.
window rolled or the dataset was reset) we treat it as a fresh start
for that series and skip the increment, which is the only safe option
that preserves Counter monotonicity.
"""
from __future__ import annotations

import os
import signal
import threading
import time
from http.server import HTTPServer
from typing import Callable, Dict, Optional, Tuple

from prometheus_client import CollectorRegistry, Counter, Gauge, generate_latest
from prometheus_client.exposition import MetricsHandler
from rich.console import Console

from sanmar.exceptions import SanmarApiError

# Default bind. Mirrors the pattern in :mod:`sanmar.exporter_app` but
# uses port 9101 so the two exporters can co-exist on the same host
# without an env-var collision.
DEFAULT_HOST: str = "0.0.0.0"
DEFAULT_PORT: int = 9101

# Poll cadence in seconds. 60s matches the Cloudflare GraphQL data
# resolution and keeps the API call budget well under the per-account
# ceiling (Cloudflare permits ~60 GraphQL requests/min).
DEFAULT_POLL_INTERVAL_SECONDS: float = 60.0

# How far back each poll looks. We use 5 minutes — long enough to
# absorb a missed cycle from a transient Cloudflare 5xx without
# losing data, short enough that the per-poll payload stays tiny.
POLL_LOOKBACK_DAYS: float = 5.0 / (60 * 24)  # 5 minutes expressed in days

console = Console()


class EdgeMetrics:
    """Holds the three Prometheus metrics + the polling state.

    All three metrics live on a *private* :class:`CollectorRegistry` so
    importing this module never disturbs the global registry that
    :mod:`sanmar.exporter_app` writes to. Tests construct one
    :class:`EdgeMetrics` per test to keep them isolated.
    """

    def __init__(
        self,
        registry: Optional[CollectorRegistry] = None,
    ) -> None:
        self.registry = registry or CollectorRegistry()

        self.requests = Counter(
            "sanmar_edge_requests_total",
            "Total Cloudflare Worker requests by operation and outcome.",
            labelnames=("operation", "outcome"),
            registry=self.registry,
        )
        self.hit_ratio = Gauge(
            "sanmar_edge_hit_ratio",
            "Cache hit ratio per operation (0-1, bypass excluded from denom).",
            labelnames=("operation",),
            registry=self.registry,
        )
        self.last_poll_age = Gauge(
            "sanmar_edge_last_poll_age_seconds",
            "Seconds since last successful Cloudflare GraphQL poll.",
            registry=self.registry,
        )

        # Bookkeeping for delta calculation. Keyed by (operation, outcome)
        # → cumulative count at the previous successful poll. Starts
        # empty so the first successful poll bootstraps without
        # incrementing — we don't want to emit a giant ramp on cold
        # start that would skew rate() queries.
        self._last_counts: Dict[Tuple[str, str], int] = {}

        # Wall-clock of the last *successful* poll. None means we've
        # never had one — the gauge stays at 0 so absence of data is
        # visually distinct from "120s since last good poll".
        self._last_poll_at: Optional[float] = None

        # Initialize the gauge so /metrics always has the series even
        # before the first poll completes.
        self.last_poll_age.set(0.0)

    # ── public API ─────────────────────────────────────────────────────

    def poll_and_update(
        self,
        fetch_fn: Callable[[], list],
        aggregate_fn: Callable[[list], Dict[str, "OperationStats"]],
        *,
        now: Optional[Callable[[], float]] = None,
    ) -> bool:
        """Run one poll + metric update cycle. Returns True on success.

        ``fetch_fn`` and ``aggregate_fn`` are injected so this method
        is testable without monkeypatching module globals — the
        production caller wires them to
        :func:`scripts.edge_cache_report.fetch_edge_cache_groups` and
        ``aggregate``.

        On failure (any exception in ``fetch_fn`` / ``aggregate_fn``)
        the method swallows the exception, logs it, leaves all
        Counters/hit-ratio Gauges at their previous values, and lets
        ``last_poll_age`` continue to climb on subsequent ``refresh_age``
        calls. This is the right behaviour for an observability
        sidecar: a flaky upstream must never poison cached state.
        """
        now_fn = now or time.time
        try:
            groups = fetch_fn()
            stats = aggregate_fn(groups)
        except Exception as exc:  # noqa: BLE001 — observability sidecar must never crash
            console.log(f"[yellow]edge poll failed:[/yellow] {exc}")
            return False

        # Counter delta math. For each (operation, outcome) we compare
        # the new cumulative count to the previous one and increment by
        # the positive delta, ignoring decreases (window rollover).
        for operation, op_stats in stats.items():
            for outcome, new_count in (
                ("hit", op_stats.hits),
                ("miss", op_stats.misses),
                ("bypass", op_stats.bypass),
            ):
                key = (operation, outcome)
                prev = self._last_counts.get(key, new_count)
                delta = new_count - prev
                if delta > 0:
                    self.requests.labels(
                        operation=operation, outcome=outcome
                    ).inc(delta)
                # Update the bookkeeping even when delta <= 0 so a
                # dropped-then-recovered series re-anchors cleanly.
                self._last_counts[key] = new_count

            # Hit ratio gauge — bypass is excluded from denominator,
            # mirroring :class:`OperationStats.hit_ratio`.
            self.hit_ratio.labels(operation=operation).set(op_stats.hit_ratio)

        self._last_poll_at = now_fn()
        self.last_poll_age.set(0.0)
        return True

    def refresh_age(self, *, now: Optional[Callable[[], float]] = None) -> None:
        """Recompute ``last_poll_age`` from the wall-clock.

        Called once per second by the background thread (cheap — just
        a subtraction and a gauge set). Exported separately from
        :meth:`poll_and_update` so the test suite can advance the
        clock deterministically without firing a poll.
        """
        if self._last_poll_at is None:
            return  # gauge stays at its initial 0.0
        now_fn = now or time.time
        self.last_poll_age.set(max(0.0, now_fn() - self._last_poll_at))


# ── HTTP server plumbing ──────────────────────────────────────────────


def _resolve_bind(
    host: Optional[str], port: Optional[int]
) -> Tuple[str, int]:
    """Resolve bind from explicit args > env > defaults.

    Mirrors :func:`sanmar.exporter_app._resolve_bind`. Env vars are
    namespaced as ``EDGE_EXPORTER_HOST`` / ``EDGE_EXPORTER_PORT`` so
    they don't collide with the SQLite exporter's ``EXPORTER_*`` vars.
    """
    resolved_host = host or os.environ.get("EDGE_EXPORTER_HOST") or DEFAULT_HOST
    if port is not None:
        resolved_port = port
    else:
        env_port = os.environ.get("EDGE_EXPORTER_PORT")
        resolved_port = int(env_port) if env_port else DEFAULT_PORT
    return resolved_host, resolved_port


def _make_handler(metrics: EdgeMetrics):
    """Build a :class:`MetricsHandler` subclass bound to a private registry.

    :class:`MetricsHandler.factory` is the documented way to wire a
    non-default registry into the stdlib ``http.server`` plumbing.
    """
    return MetricsHandler.factory(metrics.registry)


def build_server(
    metrics: EdgeMetrics,
    *,
    host: Optional[str] = None,
    port: Optional[int] = None,
) -> HTTPServer:
    """Construct an HTTPServer that serves ``metrics`` on ``/metrics``."""
    bind_host, bind_port = _resolve_bind(host, port)
    handler = _make_handler(metrics)
    return HTTPServer((bind_host, bind_port), handler)


def _build_production_callbacks() -> Tuple[Callable[[], list], Callable[[list], Dict]]:
    """Wire :func:`fetch_edge_cache_groups` + :func:`aggregate`.

    Reads ``CLOUDFLARE_ACCOUNT_ID`` / ``CLOUDFLARE_API_TOKEN`` from the
    process env on every call so an operator can rotate credentials by
    restarting the unit. Lazy-imports the script module to keep the
    cold-start cost off ``python -m sanmar --help``.
    """
    from scripts.edge_cache_report import (
        DEFAULT_DATASET,
        aggregate,
        fetch_edge_cache_groups,
    )

    def _fetch() -> list:
        account_id = os.environ.get("CLOUDFLARE_ACCOUNT_ID")
        api_token = os.environ.get("CLOUDFLARE_API_TOKEN")
        if not account_id or not api_token:
            raise SanmarApiError(
                "CLOUDFLARE_ACCOUNT_ID / CLOUDFLARE_API_TOKEN not set",
                operation="edge_exporter",
            )
        dataset = os.environ.get("SANMAR_EDGE_CACHE_DATASET", DEFAULT_DATASET)
        # We always pass days=1 — the dataset has 5-min resolution and
        # the Counter delta math doesn't care about window size, only
        # about cumulative monotonicity within a series.
        return fetch_edge_cache_groups(
            account_id, api_token, days=1, dataset=dataset
        )

    return _fetch, aggregate


def serve_forever(
    host: Optional[str] = None,
    port: Optional[int] = None,
    *,
    poll_interval_seconds: float = DEFAULT_POLL_INTERVAL_SECONDS,
    metrics: Optional[EdgeMetrics] = None,
) -> None:
    """Run the edge exporter HTTP server + background poller.

    Two threads in the background:

    1. *poll thread* — wakes every ``poll_interval_seconds`` and calls
       :meth:`EdgeMetrics.poll_and_update`.
    2. *age thread* — wakes every 1s and calls
       :meth:`EdgeMetrics.refresh_age` so ``last_poll_age`` ticks up
       even if no scrape comes in.

    SIGTERM / SIGINT trigger graceful shutdown.
    """
    metrics = metrics or EdgeMetrics()
    fetch_fn, aggregate_fn = _build_production_callbacks()

    server = build_server(metrics, host=host, port=port)
    bind_host, bind_port = server.server_address[0], server.server_address[1]
    console.log(
        f"[bold green]sanmar-edge-exporter[/bold green] listening on "
        f"http://{bind_host}:{bind_port}/metrics"
    )

    shutdown_event = threading.Event()

    def _request_shutdown(signum, _frame):  # noqa: ANN001
        console.log(f"[yellow]signal {signum} received, shutting down…[/yellow]")
        shutdown_event.set()

    signal.signal(signal.SIGTERM, _request_shutdown)
    signal.signal(signal.SIGINT, _request_shutdown)

    def _poll_loop() -> None:
        # Fire one poll immediately so /metrics has data within seconds
        # of process start — otherwise the first 60s show all zeros.
        metrics.poll_and_update(fetch_fn, aggregate_fn)
        while not shutdown_event.wait(poll_interval_seconds):
            metrics.poll_and_update(fetch_fn, aggregate_fn)

    def _age_loop() -> None:
        while not shutdown_event.wait(1.0):
            metrics.refresh_age()

    serve_thread = threading.Thread(
        target=server.serve_forever, name="sanmar-edge-exporter-http", daemon=True
    )
    poll_thread = threading.Thread(
        target=_poll_loop, name="sanmar-edge-exporter-poll", daemon=True
    )
    age_thread = threading.Thread(
        target=_age_loop, name="sanmar-edge-exporter-age", daemon=True
    )
    serve_thread.start()
    poll_thread.start()
    age_thread.start()

    try:
        shutdown_event.wait()
    finally:
        server.shutdown()
        server.server_close()
        for t in (serve_thread, poll_thread, age_thread):
            t.join(timeout=5.0)
        console.log("[bold]sanmar-edge-exporter stopped.[/bold]")


def render_metrics(metrics: EdgeMetrics) -> bytes:
    """Return the current ``/metrics`` body. Convenience for tests."""
    return generate_latest(metrics.registry)


if __name__ == "__main__":  # pragma: no cover
    serve_forever()
