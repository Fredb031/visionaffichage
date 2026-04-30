# Vision Affichage — v2

Bilingual (fr-CA / en-CA) marketing + catalogue site for Vision Affichage, a Quebec embroidery and screen-print shop. Built with Next.js 15 App Router, statically rendered, with a guest checkout that simulates payment so the operator can demo the full shopper experience before Phase 2 wires a real PSP.

## Tech stack

| Tool | Version | Why |
|---|---|---|
| Next.js | 15.5.15 | App Router, RSC, statically rendered marketing pages |
| React | 18.3.1 | Stable LTS line; React 19 deferred to Phase 2 |
| TypeScript | 5.6 | Strict + `noUncheckedIndexedAccess` |
| Tailwind CSS | 3.4 | Token-driven design system, no shadcn defaults (see ADR 005) |
| next-intl | 3.25 | First-class App Router i18n, locale-prefixed routing |
| react-hook-form | 7.74 | Checkout form state |
| zod | 4.4 | Form schemas + runtime validation |
| zustand | 5.0 | Cart store, persisted to localStorage |
| lucide-react | 0.453 | Icon set |
| @playwright/test | 1.59 | E2E + a11y testing |
| @axe-core/playwright | 4.11 | Automated WCAG 2.1 AA checks |
| pnpm | 9 | Deterministic install |

## Quick start

```bash
git clone https://github.com/Fredb031/visionaffichage.git
cd visionaffichage
pnpm install
pnpm dev            # http://localhost:3000
```

The site auto-redirects `/` to `/fr-ca` (default locale).

## Commands

```bash
pnpm dev            # dev server (http://localhost:3000)
pnpm build          # production build (61 statically-rendered pages)
pnpm start          # serve the production build
pnpm lint           # next lint
pnpm typecheck      # tsc --noEmit
pnpm placeholders   # regenerate /public/placeholders/*.svg

# Tests
pnpm exec playwright test                              # all suites
pnpm exec playwright test tests/a11y.spec.ts           # axe-core a11y on 11 routes
pnpm exec playwright test tests/purchase-happy-path.spec.ts  # E2E happy path
pnpm exec playwright test tests/console-clean.spec.ts  # console error sweep

# JSON-LD
node scripts/validate-jsonld.cjs                       # PDP schema check (Product/Breadcrumb/FAQ)
```

## Project structure

```
app/
  layout.tsx                 root passthrough (next-intl pattern)
  globals.css                Tailwind layers + CSS tokens
  [locale]/
    layout.tsx               html/body, header/footer, generated metadata + hreflang
    page.tsx                 home — 11 sections (hero, trust, route cards, featured, industries, how-it-works, clients, reviews, kit teaser, FAQ, final CTA)
    produits/                PLP + PDP (with full info ladder, JSON-LD, FAQs, reviews)
    industries/              industry index + per-industry landing
    panier/                  cart
    checkout/                5-step guest checkout (contact, shipping, billing, payment, review)
    confirmation/            order confirmation
    soumission, kit, avis,   Phase 2 stubs (PhaseTwoStub component)
      a-propos, contact,
      faq, comment-ca-marche,
      confidentialite,
      conditions

components/
  Header, Footer, Container, Section, Button, SkipLink, LanguageSwitcher
  product/    ProductCard, ProductGrid, StarRating, ColorSwatch[Row], BadgeRow, SizePicker
  pdp/        ProductGallery, StickyActionBar, LeadTimeEstimator
  filters/    PlpFilters, AppliedFilters, SortSelect
  sections/   HeroBlock, TrustStrip, IndustryRouteCards, IndustryGrid, IndustryCard,
              HowItWorks, ClientLogoMarquee, ReviewGrid, ReviewCard, DiscoveryKitTeaser, FaqAccordion
  checkout/   FormField, OrderStepper, OrderSummary, LogoStatusBadge
  seo/        OrganizationJsonLd, ProductJsonLd, BreadcrumbJsonLd, FaqJsonLd
  ui/         Breadcrumbs, EmptyState, PhaseTwoStub

i18n/
  routing.ts                 locales, defaultLocale, navigation helpers
  request.ts                 RSC message loader

lib/
  types.ts                   Bilingual<T>, Product, Industry, ClientLogo, Review, Locale
  products.ts                21 product fixtures
  industries.ts              6 industries
  reviews.ts                 8 reviews + helpers
  clients.ts                 8 client logos
  cart.ts                    zustand cart store (persisted)
  filters.ts                 PLP filter + sort logic (URL-state-driven)
  format.ts                  formatCAD, locale helpers
  delivery.ts                lead time computation
  orderForm.ts               zod schemas for checkout (contact/shipping/billing/payment)
  seo.ts                     getAlternates(), getCanonicalUrl(), BASE_URL
  site.ts                    siteConfig (org info, social, addresses)

messages/
  fr-ca.json                 source-of-truth strings
  en-ca.json                 mirror

public/
  favicon.svg
  placeholders/              SVG-generated mocks (run `pnpm placeholders` to regenerate)

scripts/
  generate-placeholders.cjs  pure-Node SVG generator (no extra deps)
  validate-jsonld.cjs        PDP JSON-LD schema validator

tests/
  a11y.spec.ts               axe-core on 11 routes
  purchase-happy-path.spec.ts  home -> PDP -> cart -> checkout -> confirmation
  console-clean.spec.ts      0 console errors on 8 routes

docs/
  decisions/                 ADRs 001-005
  PHASE_8_AUDIT.md           Wave 3B QA report
```

## Adding a product

1. Open `lib/products.ts` and append a `Product` entry. Required fields: `styleCode`, unique `slug`, `category`, bilingual `title` / `identityHook` / `description` / `bestFor`, `badges`, `colors`, `sizes`, `brand`, `decorationDefault`, `priceFromCents`, `minQuantity`, `leadTimeDays`.
2. To get a placeholder image, add an entry to the `products` array in `scripts/generate-placeholders.cjs` then run `pnpm placeholders`. Real photography goes in `/public/products/<slug>.jpg` in Phase 2.
3. If the product belongs to an industry's curated set, add its `styleCode` to that industry's `keyProducts` in `lib/industries.ts`.
4. Restart `pnpm dev` (Next 15 doesn't HMR fixture files).
5. The PDP at `/fr-ca/produits/<slug>` is generated automatically from `generateStaticParams`.

## Adding a locale

1. Add the BCP-47 tag (e.g. `'es-mx'`) to `routing.locales` in `i18n/routing.ts`. Update `localeToHtmlLang`.
2. Create `messages/<locale>.json`, mirroring every key in `messages/fr-ca.json`.
3. Update every `Bilingual` literal in `lib/types.ts` and the fixtures in `lib/*.ts`.
4. Extend `getAlternates()` and the `LanguageSwitcher` for the new tag.
5. `pnpm typecheck` will list every fixture line that's missing the new locale.

## Phase 1 routes

| Route | Status | fr-CA | en-CA |
|---|---|---|---|
| `/` | full | yes | yes |
| `/produits` | full (PLP w/ filters + sort) | yes | yes |
| `/produits/<slug>` | full (PDP) | 21 SKUs | 21 SKUs |
| `/industries` | full | yes | yes |
| `/industries/<slug>` | full | 6 industries | 6 industries |
| `/panier` | full | yes | yes |
| `/checkout` | full (5-step, simulated payment) | yes | yes |
| `/confirmation` | full | yes | yes |

## Phase 2 stubs

These routes render `PhaseTwoStub` with on-brand interim copy plus contact CTAs:

| Route | Planned Phase 2 implementation |
|---|---|
| `/soumission` | Multi-step quote form (RHF + zod) -> CRM webhook + email |
| `/kit` | Discovery kit catalog (3 SKUs, sample-fee waiver) -> dedicated checkout flow |
| `/avis` | Full reviews page with industry filter, video testimonials, Google rating embed |
| `/a-propos` | About page with team, atelier photos, history timeline |
| `/contact` | Interactive form -> email + ticket creation |
| `/faq` | Centralized FAQ with search + per-category drilldown |
| `/comment-ca-marche` | Step-by-step process page with diagrams + video |
| `/confidentialite` | Final privacy policy with consent management |
| `/conditions` | Final terms of service with returns policy |

## Phase 1 acceptance criteria

| # | Criterion | Status |
|---|---|---|
| 1 | Bilingual fr-CA / en-CA routing with hreflang + canonical | PASS |
| 2 | 21 SKUs with full PDP info ladder (gallery, identity, badges, color/size/qty, lead time, decoration, fabric, fit, FAQ, reviews) | PASS |
| 3 | PLP with filter (category/badge/color) + sort + URL-driven state | PASS |
| 4 | 6 industry landing pages with case-study quote, recommended products, FAQ | PASS |
| 5 | Cart with persistent state across reloads | PASS |
| 6 | 5-step guest checkout with field validation (zod) | PASS |
| 7 | Order confirmation with summary + sessionStorage round-trip | PASS |
| 8 | Lighthouse mobile Performance >= 85 | PASS (96-99) |
| 9 | Lighthouse mobile Accessibility >= 95 | PASS (100) |
| 10 | Lighthouse mobile SEO >= 95 | 92 — localhost canonical artifact, see docs/PHASE_8_AUDIT.md (production expected to clear) |
| 11 | JSON-LD (Organization, Product, BreadcrumbList, FAQPage) | PASS |
| 12 | Console-clean on critical routes | PASS |
| 13 | Playwright a11y suite zero violations on 11 routes | PASS |

## Operator follow-ups (Phase 2 kickoff)

1. **Real photography** — replace the SVG-generated `/public/placeholders/products/*.svg` with photographer-shot product images and on-job-site context shots. Keep the same filename mapping; no code changes needed.
2. **Real client logos** — operator to supply 8-12 vetted client logos (with permission) to replace the SVG placeholders in `/public/placeholders/clients/*.svg`. Update `lib/clients.ts` once delivered.
3. **Payment gateway** — wire Stripe Elements + Payment Intents per ADR 004. PCI-DSS SAQ A scope.
4. **Discovery kit content** — operator to define the 3-SKU mix, sample fee, and waiver terms before `/kit` is implemented.
5. **Phase 2 implementations** — `/soumission`, `/kit`, `/avis`, `/contact`, plus the legal pages (`/confidentialite`, `/conditions`) need final operator-approved copy and any required form actions.

## Architecture decisions

See `docs/decisions/`:
- 001 — Stack: Next.js 15 + next-intl + Tailwind 3.4
- 002 — Routing: flat /fr-ca + /en-ca with shared path slugs
- 003 — Fixtures: TS catalog files instead of CMS for Phase 1
- 004 — Payment: simulated checkout for Phase 1
- 005 — Design tokens: custom Tailwind palette, no shadcn defaults
