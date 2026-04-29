# E2E tests (Playwright)

End-to-end tests for the Vision Affichage purchase happy path. These run
against a real Vite dev (or preview) server using a headless Chromium
browser.

## How to run

Playwright is already in `devDependencies` (`@playwright/test`), but the
Chromium binary is NOT bundled with `npm ci` to keep CI fast.

First time on a fresh checkout:

```bash
npx playwright install chromium
```

Run the suite (auto-starts `npm run dev` on port 5173 via `webServer`):

```bash
npx playwright test
```

Run only the purchase happy path:

```bash
npx playwright test tests/e2e/purchase-happy-path.spec.ts
```

Point the suite at an already-running server (skips the auto-spawned
`webServer`):

```bash
E2E_BASE_URL=http://localhost:4173 npx playwright test
```

Useful flags:

- `--headed` — show the browser window
- `--debug` — step through interactively
- `--ui` — open the Playwright UI runner
- `--trace on` — always record traces (default is on-first-retry)

Reports and traces land in `playwright-report/` and `test-results/` (both
gitignored).

## Status

**Scaffold only.** `purchase-happy-path.spec.ts` will FAIL on a real run
until the `data-*` selector hooks it depends on are added to source
components in a follow-up commit:

| Selector                  | Lives on                                              |
| ------------------------- | ----------------------------------------------------- |
| `[data-product-card]`     | Product card root in the catalogue grid               |
| `[data-color-swatch]`     | Each color option button on PDP                       |
| `[data-size-button]`      | Each size option button on PDP                        |
| `[data-customizer-canvas]`| The customizer canvas wrapper (after Personnaliser)   |
| `[data-cart-item]`        | Each cart line in the drawer and on the cart page     |

The test file marks each missing hook with a `TODO(data-attr):` comment
so the follow-up PR knows exactly where to wire them in. Adding those
attributes was deliberately kept OUT OF SCOPE for the scaffold commit —
it touches a handful of components and deserves its own review.

## Why scaffolded vs. fully wired

Playwright + the Chromium browser binary together weigh ~250 MB. The
test author shipped the scaffold (config + spec + this README) without
running the suite or pre-installing Chromium so the operator can decide
when to pay that cost (CI cache, local disk). Once you run
`npx playwright install chromium` once, subsequent runs are fast.

## Existing tests

The original `tests/smoke.spec.ts` (route smoke checks against
`vite preview` on :4173) still lives in `tests/`. It is excluded from
this E2E suite because `playwright.config.ts` sets `testDir: './tests/e2e'`.
Run it explicitly if needed:

```bash
npx playwright test tests/smoke.spec.ts --config=/dev/null
```

(or restore the previous Lovable config locally to run both suites.)
