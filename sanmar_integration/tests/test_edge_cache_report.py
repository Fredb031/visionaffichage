"""Phase 14 — tests for ``scripts.edge_cache_report``.

Covers the four behaviours an operator actually depends on:

1. A well-formed Cloudflare GraphQL response is aggregated correctly
   (per-operation counts + hit ratio).
2. An empty payload (worker deployed but no traffic yet) is handled
   gracefully — no exception, message printed, exit 1.
3. A 4xx response from Cloudflare is surfaced as :class:`SanmarApiError`.
4. A response where any operation is below the 50% hit-ratio threshold
   makes ``main()`` exit ``1`` so the command works as a cron health
   check.
"""
from __future__ import annotations

from typing import Any, Dict, List
from unittest.mock import MagicMock

import pytest

from sanmar.exceptions import SanmarApiError
from scripts import edge_cache_report


def _mk_group(operation: str, outcome: str, count: int) -> Dict[str, Any]:
    """Helper — build one ``workersAnalyticsEngineAdaptiveGroups`` entry."""
    return {
        "dimensions": {
            "blob1": "GET",
            "blob2": f"/{operation}/STYLE001",
            "blob3": outcome,
            "index1": operation,
        },
        "count": count,
    }


def _mk_response(
    groups: List[Dict[str, Any]],
    *,
    status_code: int = 200,
    text: str = "",
) -> MagicMock:
    """Build a mock ``requests.Response`` shaped like Cloudflare's."""
    resp = MagicMock()
    resp.status_code = status_code
    resp.text = text or "ok"
    resp.json.return_value = {
        "data": {
            "viewer": {
                "accounts": [
                    {
                        "workersAnalyticsEngineAdaptiveGroups": groups,
                    }
                ]
            }
        }
    }
    return resp


def _mk_session(response: MagicMock) -> MagicMock:
    """Wrap a response into a session.post-style mock."""
    session = MagicMock()
    session.post.return_value = response
    return session


# ── 1. Aggregation correctness ─────────────────────────────────────────


def test_aggregation_counts_hits_misses_and_bypass_per_operation() -> None:
    """A realistic mixed payload should aggregate cleanly into per-op rows."""
    groups = [
        _mk_group("products", "hit", 9234),
        _mk_group("products", "miss", 2891),
        _mk_group("products", "bypass", 328),
        _mk_group("inventory", "hit", 1823),
        _mk_group("inventory", "miss", 1953),
        _mk_group("pricing", "hit", 894),
        _mk_group("pricing", "miss", 301),
    ]

    stats = edge_cache_report.aggregate(groups)

    assert set(stats.keys()) == {"products", "inventory", "pricing"}

    products = stats["products"]
    assert products.hits == 9234
    assert products.misses == 2891
    assert products.bypass == 328
    assert products.total == 12453
    # 9234 / (9234 + 2891) ≈ 0.7616 — bypass is excluded from denom.
    assert products.hit_ratio == pytest.approx(9234 / (9234 + 2891), rel=1e-4)

    inventory = stats["inventory"]
    assert inventory.hit_ratio == pytest.approx(1823 / (1823 + 1953), rel=1e-4)


# ── 2. Empty payload handling ──────────────────────────────────────────


def test_empty_response_renders_no_data_message_and_exits_one(
    monkeypatch: pytest.MonkeyPatch,
    capsys: pytest.CaptureFixture[str],
) -> None:
    """No traffic in the window should print a message and exit 1."""
    monkeypatch.setenv("CLOUDFLARE_ACCOUNT_ID", "acct-test")
    monkeypatch.setenv("CLOUDFLARE_API_TOKEN", "token-test")

    session = _mk_session(_mk_response([]))
    monkeypatch.setattr(
        edge_cache_report.requests,
        "Session",
        lambda: session,
    )

    exit_code = edge_cache_report.main(["--days", "1"])

    captured = capsys.readouterr()
    assert "No edge cache telemetry" in captured.out
    # No data == degraded == exit 1 (operator should investigate).
    assert exit_code == 1


# ── 3. 4xx response surfaces as SanmarApiError ─────────────────────────


def test_4xx_response_raises_sanmar_api_error() -> None:
    """A 401 from Cloudflare must be wrapped in ``SanmarApiError``."""
    bad_resp = MagicMock()
    bad_resp.status_code = 401
    bad_resp.text = "Unauthorized — bad token"
    session = _mk_session(bad_resp)

    with pytest.raises(SanmarApiError) as excinfo:
        edge_cache_report.fetch_edge_cache_groups(
            "acct-test",
            "bad-token",
            days=1,
            session=session,
        )

    err = excinfo.value
    assert err.code == "401"
    assert "401" in err.message
    assert err.operation == "edge_cache_report"


# ── 4. Hit ratio < 50% trips exit code 1 ───────────────────────────────


def test_main_exits_one_when_any_operation_below_threshold(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """One unhealthy operation should fail the whole health check."""
    # ``products`` is healthy (75%); ``inventory`` is unhealthy (40%).
    # The command should exit 1 because *any* op below threshold trips it.
    groups = [
        _mk_group("products", "hit", 750),
        _mk_group("products", "miss", 250),
        _mk_group("inventory", "hit", 40),
        _mk_group("inventory", "miss", 60),
    ]
    monkeypatch.setenv("CLOUDFLARE_ACCOUNT_ID", "acct-test")
    monkeypatch.setenv("CLOUDFLARE_API_TOKEN", "token-test")
    session = _mk_session(_mk_response(groups))
    monkeypatch.setattr(
        edge_cache_report.requests,
        "Session",
        lambda: session,
    )

    exit_code = edge_cache_report.main(["--days", "1"])

    assert exit_code == 1

    # Sanity-check the contrapositive: if every op is >= 50% the same
    # path returns 0. This guards against the threshold logic getting
    # stuck always returning 1.
    healthy_groups = [
        _mk_group("products", "hit", 750),
        _mk_group("products", "miss", 250),
        _mk_group("inventory", "hit", 600),
        _mk_group("inventory", "miss", 400),
    ]
    session2 = _mk_session(_mk_response(healthy_groups))
    monkeypatch.setattr(
        edge_cache_report.requests,
        "Session",
        lambda: session2,
    )
    assert edge_cache_report.main(["--days", "1"]) == 0
