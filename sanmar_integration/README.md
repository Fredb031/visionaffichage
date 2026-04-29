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

**Phase 2 lands SOAP base + Product Data v2.0.0** (this commit).
Phases 3+ (Inventory, Pricing, Media Content, Order Status) follow.

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
