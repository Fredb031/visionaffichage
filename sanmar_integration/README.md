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
