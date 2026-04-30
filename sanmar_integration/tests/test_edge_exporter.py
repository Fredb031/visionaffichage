"""Phase 15 — tests for ``sanmar.edge_exporter``.

Covers the four guarantees the Prometheus stack depends on:

1. :class:`EdgeMetrics` initializes the three named metrics
   (``sanmar_edge_requests_total``, ``sanmar_edge_hit_ratio``,
   ``sanmar_edge_last_poll_age_seconds``) on its private registry.
2. :meth:`EdgeMetrics.poll_and_update` advances Counter values by the
   delta between successive cumulative payloads — never resets, never
   double-counts on the second poll.
3. ``last_poll_age`` increments on failure (poll exception) and
   resets to zero on the next successful poll.
4. :func:`render_metrics` produces a Prometheus exposition body
   containing every metric name we promise downstream.
"""
from __future__ import annotations

from typing import Dict, List
from unittest.mock import MagicMock

import pytest

from sanmar.edge_exporter import EdgeMetrics, render_metrics
from scripts.edge_cache_report import OperationStats, aggregate


def _mk_group(operation: str, outcome: str, count: int) -> dict:
    """Helper — one ``workersAnalyticsEngineAdaptiveGroups`` row."""
    return {
        "dimensions": {
            "blob1": "GET",
            "blob2": f"/{operation}/STYLE001",
            "blob3": outcome,
            "index1": operation,
        },
        "count": count,
    }


# ── 1. Initialization ──────────────────────────────────────────────────


def test_edge_metrics_initializes_named_counters_and_gauges() -> None:
    """All three metrics must be discoverable on the private registry."""
    metrics = EdgeMetrics()
    body = render_metrics(metrics).decode("utf-8")

    # Counter / Gauge HELP lines are stable in prometheus_client output —
    # asserting on them is the cleanest way to confirm registration
    # without poking private fields.
    assert "# HELP sanmar_edge_requests_total" in body
    assert "# HELP sanmar_edge_hit_ratio" in body
    assert "# HELP sanmar_edge_last_poll_age_seconds" in body
    # Gauge starts at 0 so /metrics has the series before the first poll.
    assert "sanmar_edge_last_poll_age_seconds 0.0" in body


# ── 2. Counter delta math ──────────────────────────────────────────────


def test_poll_and_update_advances_counters_by_delta() -> None:
    """Two successive polls should sum to the latest cumulative count."""
    metrics = EdgeMetrics()

    # First poll: 100 hits / 50 misses for "products". Counter starts
    # at 0; the first observation bootstraps the bookkeeping but does
    # NOT inc — we only inc on the *second* and later polls so a cold
    # start doesn't emit a giant ramp.
    poll_1: List[dict] = [
        _mk_group("products", "hit", 100),
        _mk_group("products", "miss", 50),
    ]
    ok = metrics.poll_and_update(lambda: poll_1, aggregate)
    assert ok is True

    body = render_metrics(metrics).decode("utf-8")
    # First poll bootstraps without incrementing. prometheus_client
    # only emits a Counter sample once .inc() has been called for a
    # given label set, so the ``products`` Counter line is absent here
    # by design — the bookkeeping was seeded but no delta was applied.
    assert (
        'sanmar_edge_requests_total{operation="products",outcome="hit"}' not in body
    )
    # Hit ratio gauge IS updated on every poll (it's a snapshot, not a delta).
    assert 'sanmar_edge_hit_ratio{operation="products"}' in body

    # Second poll: cumulative bumped to 130 hits / 70 misses.
    # Expected Counter values: 30 hit / 20 miss (the deltas).
    poll_2: List[dict] = [
        _mk_group("products", "hit", 130),
        _mk_group("products", "miss", 70),
    ]
    metrics.poll_and_update(lambda: poll_2, aggregate)

    body = render_metrics(metrics).decode("utf-8")
    assert 'sanmar_edge_requests_total{operation="products",outcome="hit"} 30.0' in body
    assert 'sanmar_edge_requests_total{operation="products",outcome="miss"} 20.0' in body

    # Third poll: same payload as poll_2 — delta is zero, Counter holds.
    metrics.poll_and_update(lambda: poll_2, aggregate)
    body = render_metrics(metrics).decode("utf-8")
    assert 'sanmar_edge_requests_total{operation="products",outcome="hit"} 30.0' in body


# ── 3. Failure handling — last_poll_age climbs ─────────────────────────


def test_last_poll_age_increments_on_failure_resets_on_success() -> None:
    """A failed poll must leave counters intact and let age tick up."""
    metrics = EdgeMetrics()

    # Fake monotonic clock so the test is deterministic.
    clock = {"now": 1_000_000.0}

    def _now() -> float:
        return clock["now"]

    # First successful poll establishes the baseline.
    metrics.poll_and_update(
        lambda: [_mk_group("products", "hit", 5)],
        aggregate,
        now=_now,
    )

    # Now force a failure by raising inside fetch_fn. The exporter
    # must swallow it and return False — never crash the host process.
    def _boom() -> list:
        raise RuntimeError("Cloudflare 5xx")

    clock["now"] += 90.0  # advance 90s
    ok = metrics.poll_and_update(_boom, aggregate, now=_now)
    assert ok is False

    metrics.refresh_age(now=_now)
    body = render_metrics(metrics).decode("utf-8")
    # 90s should be reflected; pull the line and parse the value.
    age_line = next(
        line for line in body.splitlines()
        if line.startswith("sanmar_edge_last_poll_age_seconds ")
        and not line.startswith("# ")
    )
    age_value = float(age_line.split()[-1])
    assert age_value == pytest.approx(90.0, abs=0.5)

    # A subsequent successful poll resets the age to zero.
    clock["now"] += 30.0
    metrics.poll_and_update(
        lambda: [_mk_group("products", "hit", 7)],
        aggregate,
        now=_now,
    )
    body = render_metrics(metrics).decode("utf-8")
    assert "sanmar_edge_last_poll_age_seconds 0.0" in body


# ── 4. Exposition body shape ───────────────────────────────────────────


def test_render_metrics_contains_all_three_metric_names() -> None:
    """``generate_latest`` output is what Prometheus actually scrapes."""
    metrics = EdgeMetrics()
    # Drive at least two polls so Counter series materialise (the first
    # poll only seeds the baseline).
    metrics.poll_and_update(
        lambda: [
            _mk_group("inventory", "hit", 10),
            _mk_group("inventory", "miss", 5),
            _mk_group("inventory", "bypass", 1),
        ],
        aggregate,
    )
    metrics.poll_and_update(
        lambda: [
            _mk_group("inventory", "hit", 25),
            _mk_group("inventory", "miss", 12),
            _mk_group("inventory", "bypass", 3),
        ],
        aggregate,
    )

    body = render_metrics(metrics).decode("utf-8")

    for expected in (
        "sanmar_edge_requests_total",
        "sanmar_edge_hit_ratio",
        "sanmar_edge_last_poll_age_seconds",
    ):
        assert expected in body, f"missing {expected} in /metrics body"

    # All three outcome label values must surface for inventory.
    for outcome in ("hit", "miss", "bypass"):
        assert (
            f'sanmar_edge_requests_total{{operation="inventory",outcome="{outcome}"}}'
            in body
        )
