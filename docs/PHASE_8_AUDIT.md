# Phase 8 — Performance + QA Audit

Snapshot of bundle composition after the manualChunks split landed (OP-9
framer split, OP-8 supabase lazy-load, plus the existing react/fabric/ui/
tanstack chunks).

## Build summary

- `npm run build` → exits 0, no TypeScript errors, no Rollup warnings.
- `npx tsc --noEmit` → clean.
- Lighthouse mobile score: **85** (target met).

## Top 10 chunks by raw size (gzipped in parens)

| # | Chunk                              | Raw      | Gzip   |
|---|------------------------------------|----------|--------|
| 1 | `fabric-*.js`                      | 310.7 KB | 91.6 KB |
| 2 | `index-*.js` (main entry)          | 294.0 KB | 81.7 KB |
| 3 | `supabase-*.js`                    | 195.8 KB | 51.6 KB |
| 4 | `react-*.js`                       | 165.1 KB | 53.8 KB |
| 5 | `ProductCustomizer-*.js`           | 140.0 KB | 40.5 KB |
| 6 | `framer-*.js`                      | 115.4 KB | 38.3 KB |
| 7 | `ui-*.js` (sonner + lucide)        |  90.0 KB | 20.4 KB |
| 8 | `ProductDetail-*.js`               |  89.2 KB | 28.0 KB |
| 9 | `index-cM0o1mmu.js` (router shell) |  77.8 KB | 30.4 KB |
| 10| `VendorDashboard-*.js`             |  49.0 KB | 14.5 KB |

## manualChunks coverage — verified

`vite.config.ts` splits the following into named vendor chunks:

- `react`     → react, react-dom, react-router-dom
- `fabric`    → fabric (lazy, only loads when customizer opens)
- `supabase`  → @supabase/supabase-js (lazy via dynamic import)
- `framer`    → framer-motion (lazy via Cart drawer / ExitIntent)
- `ui`        → sonner, lucide-react
- `tanstack`  → @tanstack/react-query

All six confirmed present in the dist as separate files. No vendor mass
bleeds into the entry chunk.

## >500 KB-gzipped chunks?

None. Largest gzipped chunk is `fabric` at 91.6 KB — well under the
500 KB threshold. No additional split required.

## Image WebP coverage

`public/` still contains ~797 raw JPG/PNG product photos under
`public/products/`. The WebP twins are also present (the project ships
`<picture>` + `toWebp()` fallback), so the JPGs are intentionally kept
as the legacy fallback for browsers without WebP support (~3% of
traffic). Re-running `scripts/convert-images-to-webp.cjs` is a no-op
once `sharp` is installed because the script skips files where the
WebP twin is newer than the source. No action needed.

## A11y sweep — Index, ProductDetail, Cart

Findings:

- **Images** — every `<img>` either has a meaningful `alt` or is
  decorative with `alt=""` + `aria-hidden="true"`. Clean.
- **Forms** — no `<form>` elements on these three pages, so missing
  `type=` on `<button>` cannot trigger an unwanted submit. Still
  hardened defensively (5 buttons → `type="button"`).
- **Icon-only buttons** — all icon-only triggers carry `aria-label`
  and the inner icon has `aria-hidden="true"`. Clean.
- **Form inputs** — N/A on these three pages.

## No further sweep items

Nothing else flagged. Phase 8 is essentially in maintenance mode —
future wins are upstream (image CDN, route-level prefetch hints) not
bundle-shape.
