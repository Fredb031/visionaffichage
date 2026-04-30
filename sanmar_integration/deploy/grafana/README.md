# Grafana — SanMar Ops dashboard

`sanmar-ops.json` is the 6-panel ops dashboard fed by the
SanMar Prometheus exporter (`/metrics` on port 9100).

## Import

1. Grafana → **Dashboards** → **New** → **Import**.
2. Upload `sanmar-ops.json` (or paste the contents).
3. When prompted, set the `DS_PROMETHEUS` data source variable to your
   Prometheus instance — the UID is usually `prometheus`.
4. Save.

## Prometheus scrape config

Add this job to your Prometheus `scrape_configs`:

```yaml
scrape_configs:
  - job_name: sanmar
    scrape_interval: 30s
    static_configs:
      - targets: ['sanmar-host:9100']
```

The scrape interval is intentionally generous — the SanMar
exporter recomputes every metric from SQLite on each scrape, so 30s
gives the dashboard fresh data without hammering the cache file.

## Panels

| # | Panel                              | Source metric                                |
|---|------------------------------------|----------------------------------------------|
| 1 | Sync runs (24h)                    | `sanmar_sync_success_total`, `sanmar_sync_errors_total` |
| 2 | Sync duration (p50/p95)            | `sanmar_sync_duration_seconds_bucket`        |
| 3 | Open orders by status              | `sanmar_orders_by_status`                    |
| 4 | Inventory snapshots written / hour | `sanmar_inventory_snapshots_24h`             |
| 5 | Time since last sync               | `sanmar_last_sync_timestamp_seconds`         |
| 6 | Recent errors (1h rate)            | `sanmar_sync_errors_total`                   |

A vertical annotation marks each completed sync run, drawn from
changes in `sanmar_last_sync_timestamp_seconds`.

## Variables

* `$sync_type` — multi-select, populated from
  `label_values(sanmar_sync_errors_total, sync_type)`. Filters every
  panel except panel 3 (which is per-status, not per-type).
* `$DS_PROMETHEUS` — your Prometheus data source.

---

# Grafana — SanMar Edge dashboard (Phase 15)

`sanmar-edge.json` is the 4-panel Cloudflare Worker edge cache
dashboard fed by the SanMar **edge** Prometheus exporter (`/metrics`
on port 9101). The edge exporter polls Cloudflare GraphQL every 60s
and exposes the rolled-up counters; this dashboard reads them.

## Import

1. Grafana → **Dashboards** → **New** → **Import**.
2. Upload `sanmar-edge.json` (or paste the contents).
3. When prompted, set the `DS_PROMETHEUS` data source variable to your
   Prometheus instance — same UID you picked for `sanmar-ops.json`.
4. Save.

## Prometheus scrape config

Add this **second** job to your Prometheus `scrape_configs` (the
sanmar-ops job stays put on port 9100):

```yaml
scrape_configs:
  - job_name: sanmar_edge
    scrape_interval: 60s
    static_configs:
      - targets: ['sanmar-host:9101']
        labels: { service: sanmar, layer: edge }
```

Scrape interval matches the upstream Cloudflare poll — scraping
faster than 60s just re-reads cached counters and burns disk on
Prometheus' TSDB without surfacing fresher data.

The exporter must run as `sanmar-edge-exporter.service` and have
`CLOUDFLARE_ACCOUNT_ID` + `CLOUDFLARE_API_TOKEN` set in
`/opt/sanmar/.env` (token needs `Account · Account Analytics · Read`).

## Panels

| # | Panel                                  | Source metric / rule                              |
|---|----------------------------------------|---------------------------------------------------|
| 1 | Edge requests/sec by outcome (stacked) | `rate(sanmar_edge_requests_total[5m])`            |
| 2 | Hit ratio by operation (5m)            | `sanmar:edge_hit_ratio_5m`                        |
| 3 | Top 20 (operation, outcome) by req rate| `topk(20, rate(sanmar_edge_requests_total[5m]))`  |
| 4 | Exporter freshness (last poll age)     | `sanmar_edge_last_poll_age_seconds`               |

## Variables

* `$operation` — multi-select, populated from
  `label_values(sanmar_edge_requests_total, operation)`. Filters
  panels 1–3.
* `$DS_PROMETHEUS` — your Prometheus data source.

## Alerts

The companion `deploy/prometheus/alerts.yml` ships two rules backing
this dashboard:

* `SanmarEdgeCacheLowHitRatio` — fires when any operation drops below
  50% hit ratio for 30m (warning).
* `SanmarEdgeExporterStale` — fires when the exporter hasn't polled
  Cloudflare in 5+ minutes (warning).
