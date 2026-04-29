# sanmar-integration

Python wrapper around **SanMar Canada PromoStandards SOAP services** plus a local
SQLite cache of the master catalog. Side-track to the existing TypeScript SanMar
layer in `supabase/functions/_shared/sanmar/` — both stacks coexist while we
prototype here.

## Status

**Phase 1 only.** This commit ships:

- Project scaffolding (pyproject, env template, gitignore)
- SQLAlchemy ORM models for `Brand`, `Product`, `Variant`, `InventorySnapshot`
- A pandas-driven loader that reads the SanMar master catalog XLSX and
  upserts it into local SQLite
- A `rich`-powered CLI (`scripts/load_catalog.py`)
- Pytest suite using a synthetic DataFrame fixture (no real XLSX needed)

**Phase 2 lands SOAP base + Product Data v2.0.0**.
**Phase 3 lands Inventory v2.0.0 + Pricing & Configuration v1.0.0** (this commit).
Phases 4+ (Media Content, Order Status / Purchase Order) follow.

## Install

```bash
cd sanmar_integration
python3.11 -m venv .venv
source .venv/bin/activate
pip install -e ".[dev]"
```

## Environment

```bash
cp .env.example .env
# edit .env with real customer_id / password / media_password
```

Drop the SanMar master catalog at `data/master_catalog.xlsx` (16,630 rows
expected). The loader will refuse to run without it and tell you where to put it.

## Run the catalog loader

```bash
python -m scripts.load_catalog
# or, after editable install:
sanmar-load-catalog
```

## Tests

```bash
pytest -q tests/
```

Tests use synthetic in-memory data and do **not** require the XLSX or any
network access.

## Phase 2 — Product Data

Phase 2 ships a thin zeep-based SOAP client plus a typed wrapper for the
**Product Data Service v2.0.0**.

- `sanmar/services/base.py` — abstract `SanmarServiceBase` with a 30s
  timeout, tenacity-driven retry on `ConnectionError`/`Timeout` (3
  attempts, 1s/2s/4s backoff), password-masked logging via loguru, and
  `zeep.Fault → SanmarApiError` mapping so callers branch on `code`.
- `sanmar/services/product_data.py` — `ProductDataService` with
  `get_product`, `get_product_sellable` (parses
  `PC54(Black,LT,Adult)` partIds via regex), and `get_all_active_parts`.
- `sanmar/dto.py` — Pydantic v2 response DTOs decoupled from the
  SQLAlchemy ORM in `sanmar/models.py`.

### Live smoke test

Set real credentials in `.env`, then:

```bash
python -m scripts.test_product_data
```

You'll see green ✓ / red ✗ for each of `get_product('NF0A529K')`,
`get_product_sellable('PC54')`, and `get_all_active_parts()`. The
script exits 0 with a yellow "Credentials not set, skipping live test"
when `.env` still holds the placeholder values from `.env.example`, so
it's safe to run in CI.

### Unit tests

```bash
pytest -q tests/test_product_data.py
```

The unit tests fully mock the zeep client — they pass even when zeep
isn't installed locally.

## Phase 3 — Inventory + Pricing

Phase 3 ships two more typed wrappers, both sharing the same
`SanmarServiceBase` plumbing.

### Inventory v2.0.0

`sanmar/services/inventory.py` — `InventoryService.get_inventory_levels(
style_number, color=None, size=None)` returns an `InventoryResponse`
DTO with:

- `locations: list[WarehouseLevel]` — one entry per SanMar Canada
  warehouse (`1`=Vancouver, `2`=Mississauga, `4`=Calgary). Names are
  computed from the well-known ID map so callers don't carry it.
- `total: int` — `computed_field` summing `locations[*].quantity`.
- Future-stock rows are surfaced under `WarehouseLevel.future_quantities`.

The parser drills through the `<inventoryLocationQuantity><Quantity>
<value>N</value></Quantity></inventoryLocationQuantity>` envelope
explicitly — the TS layer at `supabase/functions/_shared/sanmar/
inventory.ts` had a bug here where it read the outer container's
`.value` and got `undefined`. The Python tests guard against that
regression.

### Pricing & Configuration v1.0.0

`sanmar/services/pricing.py` — `PricingService.get_pricing(
style_number, color=None, size=None)` returns a `PricingResponse`
with `breaks: list[PriceBreak]` ordered ascending by `min_quantity`.
Standing parameter set per SanMar Canada:

- `currency = CAD`
- `fobId = CUSTOMER`
- `priceType = BLANK`
- `localizationCountry = CA` / `localizationLanguage = EN`

Prices are `Decimal` end-to-end — never `float`. Round-tripping
currency through `float` corrupts cents (the canonical
`0.1 + 0.2 != 0.3` problem). `PriceBreak.max_quantity` is `None` for
the open-ended top tier (e.g. "72+").

### Live smoke test

```bash
python -m scripts.test_inventory_pricing
```

Prints two `rich`-rendered tables: an inventory snapshot for style
`117023` and a price ladder for style `411092` size `31516-1`. Same
placeholder-credentials safety as the Phase 2 script.

### Unit tests

```bash
pytest -q tests/test_inventory.py tests/test_pricing.py
```

12 tests covering single + multi-warehouse parsing, the
`Quantity.value` drill, future-stock parsing, the `total`
computed_field, multi-tier price ladders, `Decimal` precision, and
`Fault → SanmarApiError` mapping.

## Phase 4 — Media Content + Purchase Order

Phase 4 ships two more service wrappers and extracts the typed error
hierarchy into its own module.

### Media Content v1.1.0

`sanmar/services/media.py` — `MediaContentService.get_product_images(
style_number, color=None)` returns a `MediaResponse` whose `items`
list carries one `MediaItem` per `MediaContent` node SanMar returned.

Three SanMar quirks the parser handles:

- **Separate password.** Media authenticates with
  `SANMAR_MEDIA_PASSWORD`, *not* the regular EDI login. The wrapper
  overrides `auth_dict()` so callers don't have to remember.
- **Multi-URL `<url>`.** SanMar collapses every CDN URL for a given
  node into one `<url>` separated by newlines. We split on `\n` and
  surface the full list as `MediaItem.all_urls`.
- **Bilingual descriptions.** SanMar Canada writes descriptions like
  `"FR: Logo brodé / EN: Embroidered logo"`. The bilingual regex
  extracts both halves; if it doesn't match (English-only assets)
  both `description_fr` and `description_en` fall back to the raw.

### Purchase Order v1.0.0

`sanmar/services/purchase_order.py` — `PurchaseOrderService` exposes
`submit_order(order)` and `get_order_status(po_number=..., query_type=1)`.

Pre-flight validation runs before any SOAP call. All raise
`SanmarApiError` subclasses so callers can branch on `code`:

- **Forbidden chars** (`< > & " '`) in any address line, name,
  company, etc. → `ForbiddenCharError(field, char)` with code `210`,
  matching SanMar's "Invalid Character" rejection code.
- **Postal codes** validated by country: Canadian `A1A 1A1` (with or
  without space) or US `12345` / `12345-6789`. Mismatch raises
  `InvalidPostalCodeError` (code `220`).
- **Carrier allowlist**: `UPS`, `PUR` (Purolator), `FDX` (FedEx),
  `CPC` (Canada Post). Lower-case input is normalized to upper.
  Anything else raises `InvalidCarrierError` (code `230`).

Response parsing handles SanMar's wrapper-name asymmetry: the
request element is named `SubmitPOOrderRequest` but the response
comes back wrapped in `<SendPOResponse>`. We read `SendPOResponse`
first and fall back to `SubmitPOOrderResponse` so future
PromoStandards alignment doesn't silently break us. `queryType=3` is
explicitly rejected on `get_order_status` — SanMar Canada does not
support it.

### exceptions.py

`sanmar/exceptions.py` extracts the error hierarchy from `base.py`:

- `SanmarApiError` (base, re-exported by `services.base` for
  backward compat)
- `ForbiddenCharError` (code 210)
- `InvalidPostalCodeError` (code 220)
- `InvalidCarrierError` (code 230)

### Live smoke test

```bash
python -m scripts.test_media_orders
```

Read-only by design — calls `get_product_images` and `get_order_status`
but **does not** submit a real order. Instead it builds a fake
`PurchaseOrderInput` and prints the SOAP envelope that *would* be sent
via `preview_envelope()`. Submitting a bogus order to UAT pollutes
SanMar's transaction log and triggers follow-up calls from EDI.

### Unit tests

```bash
pytest -q tests/test_media.py tests/test_purchase_order.py
```

Phase 4 adds 28 tests: bilingual regex (both pattern and raw fallback),
multi-URL splitting, the media-password override, every forbidden-char
field, both postal-code formats, carrier normalization, the
`SendPOResponse` wrapper, the `SubmitPOOrderResponse` fallback,
`queryType=3` rejection, and `Fault → SanmarApiError` mapping.

## Phase 5 — Shipment + Invoice + Bulk Data + Orchestrator

Phase 5 closes out the SanMar SOAP surface area and ships a
high-level facade so cron jobs and the eventual Streamlit ops
dashboard don't have to wire eight services together themselves.

### Order Shipment Notification v2.0.0

`sanmar/services/shipment.py` —
`ShipmentService.get_shipment_notifications(po_number=..., customer_po=...,
since=...)` returns a `list[ShipmentNotification]`. Two query modes:

- `queryType=1` — by PO / customer PO (single-shipment lookup).
- `queryType=2` — by date range (catch-up after an outage).

`get_tracking_info(po_number)` is a convenience wrapper that filters
the same response down to tracking-only fields (`po_number`, `carrier`,
`tracking_number`, `ship_date`) — useful for shipping-confirmation
emails where you don't want to leak line-item details. Empty responses
yield an empty list, never a crash.

### Invoice Service v1.0.0

`sanmar/services/invoice.py` — `InvoiceService.get_invoice(
invoice_number)` and `.get_open_invoices(since=...)`. Status is
auto-derived (not trusting SanMar's `status` string, which is
occasionally absent or stale):

- `balance_due == 0`                              → `paid`
- `balance_due > 0` and `due_date < today`        → `overdue`
- `balance_due > 0` and `balance_due < total`     → `partial`
- otherwise                                        → `open`

Every monetary field is `Decimal` end-to-end. Tests assert
`line_total == unit_price * quantity` for receipt-style invoices to
catch any future float regression.

### Bulk Data Service v1.0

`sanmar/services/bulk_data.py` — for nightly catalog deltas. Walking
`getProduct()` per active style across the SanMar Canada catalog
(~16,630 styles) is wasteful when only a handful change per day; Bulk
Data ships a delta endpoint that returns just the products / inventory
snapshots that moved since the caller's checkpoint.

- `get_product_data_delta(since)` →  `BulkDataResponse` (window +
  `list[ProductResponse]`).
- `get_inventory_delta(since)` → `BulkInventoryResponse` (window +
  `list[InventoryResponse]`).

Persist `window_end` as the next checkpoint so subsequent runs only
ask SanMar for what changed since.

### SanmarOrchestrator

`sanmar/orchestrator.py` composes all eight SanMar services into one
object plus four operator-facing workflows:

- **`sync_catalog_full(session=None)`** — full walk via
  `getAllActiveParts` + per-style `getProduct`. Slow (one HTTP per
  style); use for cold starts or weekly reconciliation.
- **`sync_catalog_delta(since, session=None)`** — fast incremental
  refresh via `BulkDataService`. Returns the server-reported window
  so the cron can persist the next checkpoint.
- **`sync_inventory_for_active_skus(session)`** — pulls every distinct
  style from the local `variants` table, fetches inventory once per
  style (SanMar returns every warehouse / SKU permutation in one
  call), and writes `InventorySnapshot` rows.
- **`reconcile_open_orders(session, open_orders=[...])`** — for every
  caller-supplied `{po_number, status_id}` row, calls
  `getOrderStatus`; counts transitions and mutates the caller's dict
  in-place so they can write back without re-querying.

All four return small dataclasses with metrics (`success_count`,
`error_count`, `duration_ms`, `errors: list[dict]`) — structured
output for alerting and dashboards.

### Nightly sync — recommended wiring

```python
from datetime import datetime, timezone

from sanmar.config import get_settings
from sanmar.db import make_engine, session_scope
from sanmar.orchestrator import SanmarOrchestrator

settings = get_settings()
orch = SanmarOrchestrator(settings)
engine = make_engine(settings.db_path)

# Read last checkpoint; fall back to 24h ago.
since = datetime.now(tz=timezone.utc).replace(hour=0, minute=0, second=0)

with session_scope(engine) as session:
    catalog = orch.sync_catalog_delta(since, session=session)
    inventory = orch.sync_inventory_for_active_skus(session)
    open_orders = [...]  # SELECT po_number, status_id FROM orders WHERE status_id < 80
    recon = orch.reconcile_open_orders(session, open_orders=open_orders)

# Persist `catalog.window_end` as the next checkpoint, ship metrics.
```

### Live smoke test

```bash
python -m scripts.test_shipment_invoice_bulk
```

Read-only — pulls last 30 days of shipment notifications, last 30
days of open invoices, and yesterday's product delta (small window so
the response stays manageable). Same placeholder-credentials safety
as the earlier scripts.

### Unit tests

```bash
pytest -q tests/test_shipment.py tests/test_invoice.py \
        tests/test_bulk_data.py tests/test_orchestrator.py
```

Phase 5 adds 18 tests covering shipment parsing (single / multi /
empty / Fault), invoice status derivation (paid / open / overdue /
list), `Decimal` arithmetic preservation, bulk product + inventory
delta parsing, the eight-service composition contract, the
`sync_catalog_delta → persist_catalog` path, and order status
transition detection (60 → 80).

## Phase 6 — Operator surfaces

Phase 6 ships the CLI, sync checkpointing, and a Streamlit ops
dashboard so the integration is usable without writing Python.

### Install

```bash
pip install -e ".[dev]"
python -m sanmar --help
```

### CLI subcommands

```bash
# Catalog
python -m sanmar sync-catalog --delta --since 2026-04-28
python -m sanmar sync-catalog --full

# Inventory
python -m sanmar sync-inventory --limit 25         # smoke run
python -m sanmar sync-inventory                    # full run

# Orders
python -m sanmar reconcile-orders                  # uses OrderRow.is_open

# Lookups (single style / PO / invoice)
python -m sanmar product NF0A529K
python -m sanmar product NF0A529K --color Black --size L
python -m sanmar inventory NF0A529K
python -m sanmar pricing NF0A529K
python -m sanmar track PO-2026-100
python -m sanmar invoice INV-12345
python -m sanmar open-invoices --days 30

# Smoke / health (CI-safe — exits 0 with placeholder creds)
python -m sanmar health
```

### Streamlit dashboard

```bash
pip install -e ".[ops]"
streamlit run streamlit/ops.py
```

Three sections: last 10 sync runs (from `sync_state`), live counters
(open orders + AR balance, sourced from local SQLite), and three
manual trigger buttons (catalog delta / inventory / reconcile).

### Recommended cron entry

```
# Nightly delta + inventory + order reconcile at 02:00 server time.
0 2 * * * cd /opt/sanmar && python -m sanmar sync-catalog --delta && python -m sanmar sync-inventory && python -m sanmar reconcile-orders
```

### What Phase 6 added

- `sanmar/cli.py` — Typer CLI with 10 subcommands (rich tables / progress)
- `sanmar/__main__.py` — makes `python -m sanmar` work
- `sanmar/models.py` — `SyncState` and `OrderRow` ORM models
- `sanmar/orchestrator.py` — `reconcile_open_orders` now self-sources
  from `OrderRow.is_open`, all four sync methods write `SyncState`
  rows at start + finish in a `try/finally`
- `streamlit/ops.py` — minimal operator dashboard (optional dep)
- 11 new tests (71 → 82): `test_cli.py` (5 tests) +
  `test_models_sync_state.py` (6 tests)

## Phase 7 — operations spine

Operating model: a systemd timer fires the orchestrator nightly; each
sync writes a `SyncState` row; failures and terminal order transitions
get pushed to a Slack/Zapier webhook.

```
systemd timer (02:00 + 5min jitter)
    └─► oneshot service unit
            ├─► python -m sanmar sync-catalog --delta
            ├─► python -m sanmar sync-inventory
            └─► python -m sanmar reconcile-orders
                    └─► SyncState rows + SyncNotifier alerts
```

### systemd install

```bash
cd deploy/systemd
sudo ./install.sh
# verify
systemctl list-timers sanmar-nightly.timer
journalctl -u sanmar-nightly.service -n 200 --no-pager
```

See `deploy/systemd/README.md` for prerequisites and uninstall steps.

### GitHub Actions

`.github/workflows/sanmar-python-ci.yml` runs on every PR touching
`sanmar_integration/**`:

1. `lint-and-test` — `pip install -e ".[dev]"` + `pytest -q tests/` +
   a CLI sanity check (`from sanmar.cli import app; ...`).
2. `health-check` — runs `python -m sanmar health` against UAT *if*
   the secrets are set, otherwise logs a skip and exits clean.

Repo secrets to configure (Settings → Secrets and variables → Actions):

- `SANMAR_CUSTOMER_ID_UAT`
- `SANMAR_PASSWORD_UAT`
- `SANMAR_MEDIA_PASSWORD_UAT`

### Slack/Zapier alerting

Create an incoming webhook (Slack: *Apps → Incoming Webhooks*; Zapier:
*Webhooks by Zapier → Catch Hook*) and set the URL in `.env`:

```bash
SANMAR_ALERT_WEBHOOK_URL=https://hooks.slack.com/services/AAA/BBB/CCC
```

`SyncNotifier` posts:

- **Failure alerts** — when a sync row closes with `error_count > 0`.
  Deduped per `sync_type` for 30 minutes via
  `metadata_json['last_alert_at']` so an outage doesn't flood the channel.
- **Transition alerts** — when an order flips into status 80
  (Complete / Shipped) or 99 (Cancelled), with PO number, customer
  reference, quote id, and any tracking numbers.

Both call paths use a 3-second timeout and swallow every exception —
alerting is best-effort observability, never load-bearing for the
sync. The webhook URL is never logged.

### What Phase 7 added

- `deploy/systemd/{sanmar-nightly.service,sanmar-nightly.timer,install.sh,README.md}`
  — nightly sync chain at 02:00 + 5min jitter, journald logs
- `.github/workflows/sanmar-python-ci.yml` — pytest + CLI gate on every
  PR plus an optional UAT health check
- `sanmar/notifier.py` — `SyncNotifier` with failure + transition
  alerts, 30-min dedup, 3s timeout, never logs the URL
- `sanmar/orchestrator.py` — accepts an optional `notifier=`, fires
  `notify_failure` from `_close_sync_state` and `notify_transition`
  from `reconcile_open_orders`
- `sanmar/config.py` — new `alert_webhook_url` field on `Settings`
  (`SANMAR_ALERT_WEBHOOK_URL`)
- 13 new tests (82 → 95): `test_notifier.py` (8 tests) +
  `test_orchestrator_alerts.py` (5 tests)

## Phase 8 — Observability spine

The integration ships a Prometheus exporter that turns the SQLite
cache into scrapable metrics, plus a Grafana dashboard JSON that
visualises sync health, open orders, and inventory throughput.

### Install

```bash
pip install -e ".[ops]"
```

The `[ops]` extra pulls `prometheus_client` (and `streamlit` for the
operator dashboard).

### Run the exporter

```bash
python -m sanmar metrics              # → http://localhost:9100/metrics
python -m sanmar metrics --port 8080  # custom port
```

`EXPORTER_HOST` / `EXPORTER_PORT` env vars override the defaults.
Under systemd, install the unit at
`deploy/systemd/sanmar-exporter.service` — it runs the same command
as a long-running service with `Restart=on-failure`.

### Metrics exposed

| Metric                                  | Type      | Labels             |
|-----------------------------------------|-----------|--------------------|
| `sanmar_sync_duration_seconds`          | Histogram | sync_type, outcome |
| `sanmar_sync_errors_total`              | Counter   | sync_type          |
| `sanmar_sync_success_total`             | Counter   | sync_type          |
| `sanmar_orders_open`                    | Gauge     | —                  |
| `sanmar_orders_by_status`               | Gauge     | status_id          |
| `sanmar_inventory_snapshots_24h`        | Counter   | —                  |
| `sanmar_last_sync_timestamp_seconds`    | Gauge     | sync_type          |

Every metric is recomputed from SQLite on each scrape, so the
exporter is fully stateless and can crash/restart freely.

### Prometheus scrape config

```yaml
scrape_configs:
  - job_name: sanmar
    scrape_interval: 30s
    static_configs:
      - targets: ['sanmar-host:9100']
```

### Import the Grafana dashboard

1. Grafana → **Dashboards** → **New** → **Import**.
2. Upload `deploy/grafana/sanmar-ops.json`.
3. Set the `DS_PROMETHEUS` datasource variable to your Prometheus
   instance (UID is usually `prometheus`).

The dashboard has 6 panels: 24h sync runs, sync duration p50/p95,
open orders by status, inventory snapshots/hour, time since last
sync (red >24h), and recent error rate. A vertical annotation marks
each completed sync run.

### What Phase 8 added

- `sanmar/exporter.py` — `SanmarMetricsCollector` exposing 7 metrics
  recomputed from SQLite on each scrape
- `sanmar/exporter_app.py` — minimal `http.server`-based `/metrics`
  endpoint with SIGTERM/SIGINT graceful shutdown
- `python -m sanmar metrics` CLI subcommand
- `deploy/systemd/sanmar-exporter.service` — long-running unit
- `deploy/grafana/sanmar-ops.json` + README — 6-panel ops dashboard
- `prometheus_client>=0.19` added to the `[ops]` extra
- 10 new tests (95 → 105) in `test_exporter.py`

## Phase 9 — Alertmanager rules + recording rules

Phase 8 made the system observable. Phase 9 makes it noisy when things
go sideways — pre-computed recording rules feed seven SLO alerts that
page on stale syncs, exporter outages, error bursts, and stuck orders.

### Install

1. **Scrape config** — append `deploy/prometheus/scrape.yml` into
   `prometheus.yml` under `scrape_configs:`. Defaults to
   `localhost:9100` with `service: sanmar` label.

2. **Rule files** — copy the recording + alert rules into the
   directory listed under `rule_files:` in `prometheus.yml`:

   ```bash
   sudo mkdir -p /etc/prometheus/rules/sanmar
   sudo cp deploy/prometheus/recording_rules.yml /etc/prometheus/rules/sanmar/
   sudo cp deploy/prometheus/alerts.yml /etc/prometheus/rules/sanmar/
   curl -X POST http://localhost:9090/-/reload
   ```

3. **Alertmanager** — merge `deploy/prometheus/alertmanager-receiver.yml`
   into `alertmanager.yml`. The receiver reads `${SANMAR_ALERT_WEBHOOK_URL}`
   from the environment — same Slack webhook the Phase 7 `SyncNotifier`
   already uses, or a brand-new `#ops-sanmar` channel webhook.

4. **Validate**:

   ```bash
   promtool check rules deploy/prometheus/recording_rules.yml \
                        deploy/prometheus/alerts.yml
   pytest -q tests/test_prometheus_rules.py
   ```

### The 7 alerts

| Alert | Threshold | for | Severity |
|-------|-----------|-----|----------|
| `SanmarSyncStale` | catalog delta freshness > 24h | 30m | warning |
| `SanmarSyncStaleCritical` | catalog delta freshness > 48h | 30m | critical |
| `SanmarInventoryStale` | inventory freshness > 24h | 1h | warning |
| `SanmarSyncErrorBurst` | sync error rate > 5% over 5m | 10m | warning |
| `SanmarOpenOrdersHigh` | open orders > 500 | 1h | info |
| `SanmarOrderStuck` | > 50 orders stuck in status 60 | 24h | warning |
| `SanmarExporterDown` | `up{job="sanmar"} == 0` | 5m | critical |

`SanmarSyncStale` warns at 24h; if it goes ignored,
`SanmarSyncStaleCritical` pages at 48h. `SanmarExporterDown` fires
fast (5m) so a dead exporter doesn't silently mask the data alerts.

### The 5 recording rules

| Rule | Expression |
|------|------------|
| `sanmar:sync_freshness_seconds` | `time() - max by (sync_type) (sanmar_last_sync_timestamp_seconds)` |
| `sanmar:sync_error_rate_5m` | `rate(sanmar_sync_errors_total[5m])` |
| `sanmar:sync_success_rate_5m` | `rate(sanmar_sync_success_total[5m])` |
| `sanmar:sync_total_runs_24h` | `increase(sanmar_sync_success_total[24h]) + increase(sanmar_sync_errors_total[24h])` |
| `sanmar:open_orders_change_1h` | `deriv(sanmar_orders_open[1h])` |

Recording rules let the alerts (and the Phase 8 dashboard) reference
short, named expressions instead of inlining `rate()` / `deriv()` /
`time()` arithmetic everywhere. Cheaper to evaluate, easier to read.

### What Phase 9 added

- `deploy/prometheus/scrape.yml` — `scrape_configs` snippet
- `deploy/prometheus/recording_rules.yml` — 5 pre-computed rules
- `deploy/prometheus/alerts.yml` — 7 SLO alert rules
- `deploy/prometheus/alertmanager-receiver.yml` — Slack receiver +
  `service: sanmar` route
- `deploy/prometheus/README.md` — install / reload / validate / test
- `pyyaml>=6.0` added to the `[dev]` extra
- 13 new tests (105 → 118) in `test_prometheus_rules.py` with an
  optional `promtool` shell-out when the binary is on PATH

## Phase 10 — Read-only HTTP API

Phase 10 ships a FastAPI service that turns the SQLite cache into a
read-only HTTP surface the Vision Affichage front-end can hit instead
of round-tripping SOAP for every product render. The API is
intentionally `GET`-only and stateless beyond a 30-second in-process
LRU cache, so it scales horizontally behind a load balancer.

### Install

```bash
pip install -e ".[dev]"
```

`fastapi` and `uvicorn[standard]` are now in the main runtime
dependencies — no extra needed beyond a working install. The `[dev]`
extra pulls in `httpx` so `pytest` can drive the API via FastAPI's
`TestClient`.

### Run

```bash
python -m sanmar serve-api --port 8000
# → API serving on http://0.0.0.0:8000 — docs at /docs
```

`SANMAR_API_HOST` / `SANMAR_API_PORT` / `SANMAR_API_CORS_ORIGINS` env
vars override the CLI flags + defaults — which is what the systemd
unit at `deploy/systemd/sanmar-api.service` relies on.

### Docs

| URL | What it serves |
|-----|----------------|
| `/docs` | OpenAPI / Swagger UI |
| `/redoc` | ReDoc |
| `/openapi.json` | Raw OpenAPI 3 spec |

### Endpoints

| Method | Path | Notes |
|--------|------|-------|
| `GET`  | `/health` | 200/503 + `db` + `sync_freshness` + warnings |
| `GET`  | `/products` | List + filter (`brand`, `category`, `active`, `q`) + paginate (`limit`/`offset` or `page`/`page_size` ≤ 100) |
| `GET`  | `/products/search?q=…` | LIKE on name + style + description |
| `GET`  | `/products/{style_number}` | Single product with color/size axes; 404 on miss |
| `GET`  | `/products/{style_number}/variants` | Color × size matrix with the unique axis lists |
| `GET`  | `/products/{style_number}/inventory` | Aggregated latest snapshot per warehouse |
| `GET`  | `/products/{style_number}/pricing` | **CACHED** price ladder (CachedPricing); 404 hint when empty |
| `GET`  | `/inventory/{style_number}` | Legacy — aggregated warehouse stock; `?max_age_hours=24` |
| `GET`  | `/inventory/{style_number}/{color}/{size}` | Legacy — per-SKU snapshot |
| `GET`  | `/pricing/{style_number}` | Legacy — pricing derived from `Variant.price_cad` |
| `GET`  | `/metrics/freshness` | `{catalog_age_seconds, inventory_age_seconds, order_status_age_seconds}` |

### Examples

```bash
# Health
curl http://localhost:8000/health

# List Port Authority polos, second page of 25
curl "http://localhost:8000/products?brand=Port%20Authority&category=Polos&limit=25&offset=25"

# Single product + variants
curl http://localhost:8000/products/PC54
curl http://localhost:8000/products/PC54/variants

# Inventory (nested under products)
curl http://localhost:8000/products/PC54/inventory

# Cached pricing (Phase 10)
curl http://localhost:8000/products/PC54/pricing

# Storefront debug widget
curl http://localhost:8000/metrics/freshness
```

### Storefront integration sketch

Today the React storefront fetches `/api/sanmar/...` Edge Functions
that proxy SOAP. Phase 10 lets us replace those with direct API calls:

```ts
// supabase/functions/_shared/sanmar/products.ts
const SANMAR_API = Deno.env.get("SANMAR_API_URL") ?? "https://sanmar.internal";

export async function fetchProduct(style: string) {
  const res = await fetch(`${SANMAR_API}/products/${style}`);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`sanmar api ${res.status}`);
  return res.json();
}
```

The DTO is identical to what the SOAP client returned, so call sites
swap with no rendering changes.

### CORS

Origins are config-driven via `SANMAR_API_CORS_ORIGINS`
(comma-separated). When the env var is unset the API falls back to
`http://localhost:5173`, `https://visionaffichage.com`, and any
`*.vercel.app` preview subdomain. Set it to the storefront's origin
in production for tighter scoping.

### What Phase 10 added

- `sanmar/api/app.py` — FastAPI app + lifespan-managed engine + CORS / GZip
- `sanmar/api/routes/{products,inventory,pricing,health,metrics}.py` — route modules
- `sanmar/api/cache_pricing.py` — `CachedPricing` ORM model
- `sanmar/api/cache.py` — `@cache_response(ttl_seconds=30)` decorator
- `sanmar/api/models.py` — `ProductListResponse`, `HealthResponse`, `FreshnessResponse`
- `sanmar/api/run.py` — programmatic uvicorn entrypoint
- `sanmar/cli.py` — new `serve-api` subcommand
- `deploy/systemd/sanmar-api.service` — long-running unit
- `deploy/nginx/sanmar-api.conf` — reverse-proxy template (30s edge cache)
- `fastapi>=0.110.0` + `uvicorn[standard]>=0.27.0` in main deps;
  `httpx>=0.27.0` in `[dev]` (powers `TestClient`)
- 13 new tests in `tests/test_api.py`

### Phase 11 recommendation

Two parallel tracks:

1. **Cloudflare cache layer** in front of the API — proxy
   `/products` + `/products/search` through a Worker with a 30 s edge
   cache so a viral product page can absorb a burst without taxing
   the origin. The nginx snippet at `deploy/nginx/sanmar-api.conf`
   gives an on-prem variant.

2. **Storefront migration** — flip
   `supabase/functions/_shared/sanmar/*.ts` from SOAP to this API.
   Track via a feature flag and roll out per-route so a regression in
   one endpoint doesn't break the catalog.
