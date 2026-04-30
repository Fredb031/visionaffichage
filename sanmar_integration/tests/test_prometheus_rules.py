"""Structural validation of the Phase 9 Prometheus + Alertmanager YAML.

These tests use PyYAML so they pass in CI without `promtool` installed.
If `promtool` is on PATH (the prometheus tarball ships it), we also
shell out to it for an authoritative check — but the absence of the
binary never fails the suite.
"""

from __future__ import annotations

import shutil
import subprocess
from pathlib import Path

import pytest
import yaml

DEPLOY_DIR = Path(__file__).resolve().parent.parent / "deploy" / "prometheus"
RECORDING_RULES = DEPLOY_DIR / "recording_rules.yml"
ALERTS = DEPLOY_DIR / "alerts.yml"
SCRAPE = DEPLOY_DIR / "scrape.yml"
ALERTMANAGER = DEPLOY_DIR / "alertmanager-receiver.yml"


def _load(path: Path) -> dict:
    assert path.exists(), f"{path} missing"
    with path.open() as f:
        data = yaml.safe_load(f)
    assert isinstance(data, dict), f"{path} must parse to a YAML mapping"
    return data


# ---------------------------------------------------------------------------
# scrape.yml
# ---------------------------------------------------------------------------


def test_scrape_yaml_valid_and_has_sanmar_job():
    data = _load(SCRAPE)
    assert "scrape_configs" in data
    jobs = data["scrape_configs"]
    assert isinstance(jobs, list) and len(jobs) >= 1
    sanmar = next((j for j in jobs if j.get("job_name") == "sanmar"), None)
    assert sanmar is not None, "scrape config must define job_name=sanmar"
    assert sanmar.get("scrape_interval") == "30s"
    targets = sanmar["static_configs"][0]["targets"]
    assert any("9100" in t for t in targets), "exporter port 9100 must be in targets"


# ---------------------------------------------------------------------------
# recording_rules.yml
# ---------------------------------------------------------------------------


def test_recording_rules_yaml_valid():
    data = _load(RECORDING_RULES)
    assert "groups" in data
    assert len(data["groups"]) == 1
    group = data["groups"][0]
    assert group["name"] == "sanmar_recording_rules"


def test_recording_rules_has_exactly_6_rules():
    data = _load(RECORDING_RULES)
    rules = data["groups"][0]["rules"]
    # Phase 15 added ``sanmar:edge_hit_ratio_5m`` to the original 5.
    assert len(rules) == 6, f"expected 6 recording rules, got {len(rules)}"


def test_recording_rules_each_have_record_and_expr():
    data = _load(RECORDING_RULES)
    rules = data["groups"][0]["rules"]
    expected_records = {
        "sanmar:sync_freshness_seconds",
        "sanmar:sync_error_rate_5m",
        "sanmar:sync_success_rate_5m",
        "sanmar:sync_total_runs_24h",
        "sanmar:open_orders_change_1h",
        "sanmar:edge_hit_ratio_5m",
    }
    seen = set()
    for rule in rules:
        assert "record" in rule, f"rule missing 'record': {rule}"
        assert "expr" in rule, f"rule missing 'expr': {rule}"
        assert isinstance(rule["expr"], str) and rule["expr"].strip()
        seen.add(rule["record"])
    assert seen == expected_records


# ---------------------------------------------------------------------------
# alerts.yml
# ---------------------------------------------------------------------------


def test_alerts_yaml_valid():
    data = _load(ALERTS)
    assert "groups" in data
    assert len(data["groups"]) == 1
    group = data["groups"][0]
    assert group["name"] == "sanmar_slo_alerts"


def test_alerts_has_exactly_9_alerts():
    data = _load(ALERTS)
    rules = data["groups"][0]["rules"]
    # Phase 15 added ``SanmarEdgeCacheLowHitRatio`` and
    # ``SanmarEdgeExporterStale`` to the original 7.
    assert len(rules) == 9, f"expected 9 alerts, got {len(rules)}"


def test_each_alert_has_summary_and_description():
    data = _load(ALERTS)
    rules = data["groups"][0]["rules"]
    for rule in rules:
        ann = rule.get("annotations", {})
        assert "summary" in ann, f"alert {rule.get('alert')} missing summary"
        assert "description" in ann, (
            f"alert {rule.get('alert')} missing description"
        )
        assert ann["summary"].strip()
        assert ann["description"].strip()


def test_each_alert_has_severity_label():
    data = _load(ALERTS)
    rules = data["groups"][0]["rules"]
    valid_sev = {"info", "warning", "critical"}
    for rule in rules:
        labels = rule.get("labels", {})
        assert "severity" in labels, (
            f"alert {rule.get('alert')} missing severity label"
        )
        assert labels["severity"] in valid_sev, (
            f"alert {rule.get('alert')} has invalid severity {labels['severity']!r}"
        )


def test_each_alert_has_expected_name():
    """Lock down the alert names so a rename is a deliberate test update."""
    data = _load(ALERTS)
    rules = data["groups"][0]["rules"]
    expected = {
        "SanmarSyncStale",
        "SanmarSyncStaleCritical",
        "SanmarInventoryStale",
        "SanmarSyncErrorBurst",
        "SanmarOpenOrdersHigh",
        "SanmarOrderStuck",
        "SanmarExporterDown",
        "SanmarEdgeCacheLowHitRatio",
        "SanmarEdgeExporterStale",
    }
    seen = {r["alert"] for r in rules}
    assert seen == expected, f"alert name drift: {seen ^ expected}"


def test_critical_alerts_present():
    """SanmarSyncStaleCritical and SanmarExporterDown must be critical."""
    data = _load(ALERTS)
    rules = {r["alert"]: r for r in data["groups"][0]["rules"]}
    assert rules["SanmarSyncStaleCritical"]["labels"]["severity"] == "critical"
    assert rules["SanmarExporterDown"]["labels"]["severity"] == "critical"


def test_each_alert_has_for_clause():
    """Every alert must specify a `for:` window — instant alerts cause flapping."""
    data = _load(ALERTS)
    rules = data["groups"][0]["rules"]
    for rule in rules:
        assert "for" in rule, f"alert {rule.get('alert')} missing 'for:' clause"


# ---------------------------------------------------------------------------
# alertmanager-receiver.yml
# ---------------------------------------------------------------------------


def test_alertmanager_receiver_yaml_valid():
    data = _load(ALERTMANAGER)
    assert "receivers" in data
    receivers = data["receivers"]
    sanmar = next((r for r in receivers if r.get("name") == "sanmar-slack"), None)
    assert sanmar is not None
    slack_configs = sanmar.get("slack_configs", [])
    assert len(slack_configs) >= 1
    assert "${SANMAR_ALERT_WEBHOOK_URL}" in slack_configs[0]["api_url"]


def test_alertmanager_route_matches_sanmar_service():
    data = _load(ALERTMANAGER)
    route = data["route"]
    assert route["receiver"] == "sanmar-slack"
    sub_routes = route.get("routes", [])
    matched = [r for r in sub_routes if r.get("match", {}).get("service") == "sanmar"]
    assert matched, "alertmanager route must match service=sanmar"


# ---------------------------------------------------------------------------
# Optional promtool check (skipped if not installed)
# ---------------------------------------------------------------------------


@pytest.mark.skipif(shutil.which("promtool") is None, reason="promtool not installed")
def test_promtool_check_rules_passes():
    result = subprocess.run(
        ["promtool", "check", "rules", str(RECORDING_RULES), str(ALERTS)],
        capture_output=True,
        text=True,
        timeout=30,
    )
    assert result.returncode == 0, (
        f"promtool failed:\nSTDOUT:\n{result.stdout}\nSTDERR:\n{result.stderr}"
    )
