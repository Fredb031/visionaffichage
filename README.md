# Vision Affichage — v2

> **Phase 2 SEALED — final tag `v2-phase2-w7`.** Seven waves of feature
> work, **80 SSG pages**, **26 / 26 Playwright tests** (zero `fixme`). Loi 25
> cookie consent + Plausible analytics gated behind it, branded 404, route
> loading skeletons, PWA manifest with dynamic VA-monogram icons, per-page OG
> overrides, abstract industry hero SVGs, sitemap + robots + dynamic OG image
> generation, **global search dialog (Cmd+K)**, **CASL-compliant
> `/infolettre` newsletter signup**, **print stylesheet for the four
> success / confirmation views**, **PDP related-products + cart upsell**.

Bilingual (fr-CA / en-CA) marketing + catalogue site for Vision Affichage, a Quebec embroidery and screen-print shop. Built with Next.js 15 App Router, statically rendered, with a guest checkout that simulates payment so the operator can demo the full shopper experience before Phase 3 wires a real PSP.

## Phase 2 — what shipped

Seven waves of feature work, sealed at 80 SSG pages and 26 passing E2E tests:

- **Wave 1** — Vol-III v2 rebrand (logo split CTA, real `/a-propos`, `/faq`, `/comment-ca-marche`)
- **Wave 2** — interactive `/contact`, `/avis`, photo-realistic product mockups
- **Wave 3** — `/account` + customizer round-trip (sessionStorage persistence)
- **Wave 4** — sitemap.xml, robots.txt, dynamic `/api/og`, industry copy + case studies
- **Wave 5** — **Loi 25 cookie consent + `/legal/{confidentialite,cookies}` legal stubs (production blocker closed)**, per-page OG overrides on 8 social-shareable routes, industry SVG heroes upgraded to abstract scenes, 4 fixme tests un-fixme'd
- **Wave 6** — **Plausible analytics gated on Loi 25 consent**, branded 404 + 6 route-specific loading skeletons, **PWA manifest + dynamic VA-monogram icons** (64×64 + 180×180), customizer E2E un-fixme'd with real PNG fixture (now **26 / 26**)
- **Wave 7** — **global search dialog (Cmd+K)**, **`/infolettre` CASL-compliant newsletter signup** (FR + EN, footer inline + dedicated landing) + double-opt-in scaffold, **print stylesheet** wired into all four success / confirmation views (`order` / `quote` / `kit` / `message`) via `data-print-region` + `data-print-header`, **PDP related products** (cross-category recommender) + **cart upsell** (`<CartUpsell>` heuristic). Now **80 SSG**.

### Phase 3 queue (operator follow-ups)

1. **Real payment gateway** — wire Stripe Checkout Session + webhook (replace mock card flow in `/checkout`)
2. **Persistent backend** — move quote/kit/order/newsletter from sessionStorage to a DB (Postgres + Drizzle, or Supabase) + auth
3. **Real photography** — replace abstract industry SVGs and product mocks with shoots
4. **Custom analytics events** — GA-style event mapping (page_view, add_to_cart, quote_submit, kit_submit, contact_submit, newsletter_subscribe, search_query) wired into the consent-gated Plausible script. Set `NEXT_PUBLIC_PLAUSIBLE_DOMAIN` to enable.
5. **Transactional email + ESP** — Resend or Postmark for quote/order/kit acknowledgments; wire `/infolettre` signup to Mailchimp / Brevo / Klaviyo with double-opt-in delivery.
6. **Recommender upgrade** — replace the hand-tuned cross-category recommender + `<CartUpsell>` heuristic with a real co-purchase model once order volume justifies it.

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
pnpm build          # production build (75 SSG + dynamic /api/og, Phase 2 SEALED)
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
  decisions/                            ADRs 001-005
  PHASE_8_AUDIT.md                      Wave 3B (Phase 1) QA report
  PHASE_2_LIGHTHOUSE_2026-04-30.md      Phase 2 Lighthouse re-baseline + verification
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

## Phase 2 routes (now live)

These routes were stubs in Phase 1 and shipped as full implementations in Phase 2 on
`v2/rebrand`. See `docs/PHASE_2_LIGHTHOUSE_2026-04-30.md` for the verification report.

| Route | Phase 2 implementation | fr-CA | en-CA |
|---|---|---|---|
| `/soumission` | Multi-step quote form (RHF + zod) with industry/quantity/decoration steps | yes | yes |
| `/kit` | Discovery kit ordering: pick mix, sample fee + waiver flow | yes | yes |
| `/avis` | Full reviews page replacing stub: industry filter, sortable cards | yes | yes |
| `/a-propos` | About page with team, atelier, history timeline | yes | yes |
| `/contact` | Interactive contact form with topic routing + validation | yes | yes |
| `/faq` | Centralized FAQ with category drilldown | yes | yes |
| `/comment-ca-marche` | Step-by-step process page | yes | yes |
| `/customiser` | Proof-first upload flow per Vol III §07 | yes | yes |
| `/account` | Client-only activity surface (sessionStorage-backed; quotes, kits, orders, messages) | yes | yes |

The catalogue/checkout core (`/`, `/produits`, `/produits/<slug>`, `/industries`,
`/industries/<slug>`, `/panier`, `/checkout`, `/confirmation`) carried over from Phase 1
unchanged. PDP CTA was split into "Personnaliser le logo" + "Ajouter sans logo"
(commit 7cf4a97). Live SanMar product/inventory/pricing wiring landed with fallback
(commit aa0910b). Cart auto-adds saved logo + thumbnail + status badge after the
customizer round-trip (commit 65407be). Photo-realistic SVG mockups replaced the simple
silhouettes (commit b7225e5).

Legal pages (`/confidentialite`, `/conditions`) still render PhaseTwoStub awaiting
operator-approved final copy.

## Phase 2 acceptance criteria

| # | Criterion | Status |
|---|---|---|
| 1 | Bilingual fr-CA / en-CA routing with hreflang + canonical | PASS |
| 2 | 21 SKUs with full PDP info ladder + split logo/no-logo CTA | PASS |
| 3 | PLP with filter + sort + URL-driven state | PASS |
| 4 | 6 industry landing pages | PASS |
| 5 | Cart with persistent state across reloads | PASS |
| 6 | 5-step guest checkout with zod validation | PASS |
| 7 | Order confirmation with summary + sessionStorage round-trip | PASS |
| 8 | Customizer (`/customiser`) — proof-first upload flow | PASS |
| 9 | Multi-step quote form (`/soumission`) | PASS |
| 10 | Discovery kit ordering (`/kit`) | PASS |
| 11 | Full reviews page (`/avis`) with filter | PASS |
| 12 | Interactive contact form (`/contact`) | PASS |
| 13 | About / FAQ / Process content (`/a-propos`, `/faq`, `/comment-ca-marche`) | PASS |
| 14 | SanMar live product/inventory/pricing with fallback | PASS |
| 15 | Account page (`/account`) — client-only sessionStorage activity surface | PASS |
| 16 | Cart customizer round-trip — auto-add saved logo + thumbnail + badge | PASS |
| 17 | Lighthouse mobile Performance >= 85 | PASS (95-98) |
| 18 | Lighthouse mobile Accessibility >= 95 | PASS (100) |
| 19 | Lighthouse mobile Best Practices >= 95 | PASS (100) |
| 20 | Lighthouse mobile SEO >= 95 (indexable routes) | 90-92 — localhost canonical artifact, see docs/PHASE_2_LIGHTHOUSE_2026-04-30.md (production expected to clear); /soumission + /account intentionally noindex |
| 21 | JSON-LD (Organization, Product, BreadcrumbList, FAQPage) | PASS |
| 22 | Console-clean on critical routes | PASS |
| 23 | Playwright a11y suite — 0 violations on 11 routes | PASS |
| 24 | 17-route smoke (fr-CA + en-CA, 32 total) — 100% 200 OK | PASS |
| 25 | sitemap.xml (auto-generated from products + industries + statics) | PASS |
| 26 | robots.txt (allow all marketing, disallow account/checkout/api) | PASS |
| 27 | Dynamic OG image at `/api/og?title=...&subtitle=...` (1200x630 PNG) | PASS |
| 28 | Wave-4 E2E spec coverage (5 new flow specs landed) | PASS (1 ready, 4 fixme tracked) |
| 29 | Industry-specific case study + pain-point copy on all 6 verticals | PASS |
| 30 | Bundle audit — First Load JS shared 102 kB, no route over 169 kB | PASS |

## Phase 2 final — verification

See `docs/PHASE_2_COMPLETE_2026-04-30.md` for the comprehensive Wave 1-4
retrospective, final commit SHA + tag, full route smoke evidence, and the
Phase 3 operator handoff queue.

## What's left for Phase 3 (operator queue)

Phase 2 completes the front-of-house experience: every customer-facing route renders real
content with interactive forms backed by zod schemas and client-side validation. Phase 3
must wire the back-of-house plumbing the simulated flows currently stand in for.

1. **Real photography** — replace SVG product/atelier/team placeholders with
   photographer-shot assets. Filename mapping is stable, so this is asset-only.
2. **Real auth backend** — `/account` is currently client-only (reads sessionStorage).
   Phase 3 needs a persistent customer DB + session layer (NextAuth or Clerk) to
   replace the sessionStorage surface with real login, order history, saved logos,
   and address book.
3. **Payment gateway** — wire Stripe Elements + Payment Intents per ADR 004 to replace
   the simulated checkout. PCI-DSS SAQ A scope.
4. **Persistent customer database** — quote submissions, contact messages, kit orders
   currently fire client-side only. Phase 3 needs server actions / API routes writing to
   Postgres (Supabase or Neon recommended) plus an operator dashboard.
5. **Email + CRM integration** — `/soumission`, `/contact`, `/kit` should trigger
   transactional email (Resend/Postmark) and create CRM records (HubSpot or built-in).
6. **Real client logos** — operator to supply 8-12 vetted client logos with permission;
   update `lib/clients.ts`.
7. **Final legal copy** — `/confidentialite`, `/conditions` still on PhaseTwoStub awaiting
   operator-approved policy text.
8. **Customer logo storage** — `/customiser` uploads currently held client-side; Phase 3
   should persist to S3/R2 with virus scan + the operator review queue.

## Architecture decisions

See `docs/decisions/`:
- 001 — Stack: Next.js 15 + next-intl + Tailwind 3.4
- 002 — Routing: flat /fr-ca + /en-ca with shared path slugs
- 003 — Fixtures: TS catalog files instead of CMS for Phase 1
- 004 — Payment: simulated checkout for Phase 1
- 005 — Design tokens: custom Tailwind palette, no shadcn defaults
