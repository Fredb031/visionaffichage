# Phase 2 — SEALED

**Date:** 2026-04-29 (Wave 5) · 2026-04-30 (Wave 6 — final-2.5) · 2026-04-29 (Wave 7)
**Tag:** `v2-phase2-sealed` (Wave 5) · `v2-phase2-final-2.5` (Wave 6) · `v2-phase2-w7` (Wave 7)
**Branch:** `v2/rebrand`
**Final SSG count:** 80 pages (78 from Wave 6 + 2 from `/{locale}/infolettre`)
**Final commit (sealer):** see `git log` after this doc lands

---

## What sealed Phase 2

Wave 5 closed the four remaining acceptance criteria so Phase 2 could be
locked behind an annotated tag.

### 1. Loi 25 cookie consent (production blocker — CLOSED)

- New client component mounts at the root of the locale layout. Banner
  appears only when no `va-cookie-consent` choice has been recorded.
- **Reject** is given equal visual weight as **Accept** — Loi 25 requires
  the refusal to be as easy as the acceptance.
- A footer **Cookie preferences** button re-opens the banner via a
  `va:cookie-consent:show` CustomEvent.
- New routes: `/{locale}/legal/confidentialite` (full Loi 25 privacy
  policy) and `/{locale}/legal/cookies` (cookie inventory + consent table).
- Sitemap updated: 4 new entries (2 routes × 2 locales).

### 2. Per-page OG overrides

A new `getOgImageUrl(title, subtitle?)` helper in `lib/seo.ts` builds a
`/api/og?title=…&subtitle=…` URL with both params URL-encoded. Applied to
8 social-shareable routes × 2 locales:

1. `/{locale}` — root layout (already shipped in Wave 4)
2. `/{locale}/produits` — PLP
3. `/{locale}/produits/[slug]` — PDP (per-product title in OG card)
4. `/{locale}/industries` — industries listing
5. `/{locale}/industries/[slug]` — per-industry hero line in OG subtitle
6. `/{locale}/avis`
7. `/{locale}/kit`
8. `/{locale}/comment-ca-marche`
9. `/{locale}/a-propos`

Verification: `view-source` on `/fr-ca/produits/atc1015-tshirt-pre-retreci`
shows `og:image` content URL containing the URL-encoded product title.

### 3. Industry SVG hero upgrade

Replaced the six gradient + label placeholders in
`/public/placeholders/industries/` with abstract scenes evoking each
industry: construction (steel beams + safety tape + hard hat),
paysagement (leaf forms + horizon), restauration (place setting + chef
hat), demenagement (stacked boxes + diagonal arrow), metiers (crossed
wrench + screwdriver + mechanical band), bureau (desk + monitor + window
grid).

### 4. Four `.fixme` tests un-fixme'd

- `account-activity` quote card — switched to `context.addInitScript()` so
  sessionStorage is seeded before page mount; corrected to the real
  `StoredQuote` shape.
- `purchase-happy-path` — uses the post-Wave-3 split CTA "Ajouter sans
  logo" to skip the customizer detour.
- `quote-form` — selectors fixed (`ul label` for product checkboxes; full
  6-step submission produces `Q-XXXX` ref).
- `kit-order` — selectors fixed (article-scoped Starter card; full kit
  order produces `K-XXXX` ref).

The fifth fixme — `customizer-flow.spec.ts` — remains skipped per its
own comment: a real raster + vector fixture under `tests/fixtures/` is
required to exercise the client-side classification pipeline. Tracked
in the Phase 3 queue.

---

## Verification gates (all PASS)

| Gate | Result |
|---|---|
| `pnpm exec tsc --noEmit` | clean (exit 0) |
| `pnpm lint` | clean (exit 0) |
| `pnpm build` | 75/75 SSG (exit 0) |
| `pnpm exec playwright test tests/` | 25 passed, 1 skipped, 0 failed |
| Smoke: `/fr-ca`, `/en-ca` | 200 |
| Smoke: `/sitemap.xml` | 200, 52 `<loc>` entries |
| Smoke: `/robots.txt` | 200, contains `/api/`, `/customiser`, `/account` in disallow |
| Smoke: `/api/og?title=Test&subtitle=Hello` | 200 image/png |
| Smoke: `/fr-ca/legal/confidentialite` | 200 |
| Smoke: `/fr-ca/legal/cookies` | 200 |
| OG override on PDP | URL contains URL-encoded product title |
| Cookie banner mount | `CookieConsent` reference in HTML; renders client-side |

---

## Wave 6 additions (final-2.5)

Wave 6 closed four operational/polish items that remained on the Phase 2
backlog after the Wave 5 seal. All four landed in parallel as separate
feature commits; this doc revision is the sealer.

### 1. Plausible analytics — gated on Loi 25 consent

`components/Analytics.tsx` (Plausible.io) is mounted inside the locale
layout. The `<Script>` is rendered only when **both** of these hold:

1. `NEXT_PUBLIC_PLAUSIBLE_DOMAIN` env var is set (operator opt-in).
   Optional `NEXT_PUBLIC_PLAUSIBLE_SCRIPT_URL` for proxied/self-hosted.
2. The visitor has granted `analytics` consent via the existing cookie
   banner (`hasConsent('analytics')` from `lib/cookieConsent.ts`).

The component listens for the `va:consent-changed` CustomEvent
dispatched by `setConsent()`, so toggling consent flips the script
mount/unmount without a page reload. With no env var, the network
payload is unchanged from Wave 5 (zero analytics requests by default).
A defense-in-depth `lib/analytics.ts` helper refuses to fire events
without consent even if a script somehow loads.

### 2. Customizer E2E — un-fixme'd

`tests/customizer-flow.spec.ts` now uses a real PNG fixture under
`tests/fixtures/test-logo.png` (with a sibling `README.md` documenting
how to regenerate). The synthetic 1×1 buffer that previously broke
headless raster classification is gone, the `test.fixme(...)` is
replaced with `test(...)`, and the Playwright run is **26 / 26** with
zero `fixme`.

### 3. Branded 404 + route-specific loading skeletons

- `app/not-found.tsx` — bilingual (FR) error page styled with brand
  tokens (Inter, sand canvas, ink hover), CTA back to `/fr-ca` and a
  shop-the-uniforms secondary action. Renders for any unmatched path
  (root level — middleware does not catch unprefixed paths).
- `loading.tsx` shells for six routes:
  `[locale]/`, `[locale]/produits/`, `[locale]/customiser/`,
  `[locale]/soumission/`, `[locale]/kit/`, `[locale]/panier/`,
  `[locale]/account/`. Each matches its route's grid skeleton so
  cumulative-layout-shift stays ~0 during streaming.

### 4. PWA manifest + dynamic icons

- `app/manifest.ts` — emits `/manifest.webmanifest` with name,
  description, scope, `theme_color: #101114`, `background_color: #F8F7F3`,
  `start_url: /fr-ca`, `display: standalone`, `lang: fr-CA`.
- `app/icon.tsx` (64×64) and `app/apple-icon.tsx` (180×180) — dynamic
  `ImageResponse` PNGs with the **VA** monogram on the brand-ink
  background. Referenced from the manifest and via the standard
  Next.js metadata pipeline.
- `next.config.mjs` — `rewrites()` so `/icon.png` and `/apple-icon.png`
  resolve to the extension-less Next routes (PWA validators expect
  explicit `.png`).
- `middleware.ts` matcher — excludes `icon`, `apple-icon`, and
  `manifest.webmanifest` (plus dotted assets) so next-intl no longer
  redirects them through the locale prefix.
- `viewport.themeColor = '#101114'` exported from the locale layout;
  `appleWebApp` metadata for iOS standalone behavior.

### Wave 6 verification gates

| Gate | Result |
|---|---|
| `pnpm exec tsc --noEmit` | clean (exit 0) |
| `pnpm lint` | clean (exit 0) |
| `pnpm build` | **78 / 78** SSG (exit 0) |
| `pnpm exec playwright test tests/` | **26 / 26** passed, **0 fixme** |
| Smoke: 19 wave-5 routes | all 200 |
| Smoke: `/manifest.webmanifest` | 200 `application/manifest+json` |
| Smoke: `/icon` and `/icon.png` | 200 `image/png` |
| Smoke: `/apple-icon` and `/apple-icon.png` | 200 `image/png` |
| Smoke: `/this-route-doesnt-exist` (followed) | 404 with branded page |
| HTML source: `<link rel="manifest" href="/manifest.webmanifest">` | present |
| HTML source: `<meta name="theme-color" content="#101114">` | present |
| Plausible script when no env var set | not loaded (default state) |

## Wave 7 additions (`v2-phase2-w7`)

Wave 7 layered on four discovery / retention surfaces. All four landed
in parallel as separate feature commits on top of `v2-phase2-final-2.5`;
this doc revision is the sealer. Brings totals to **80 SSG** and **26 / 26**
Playwright tests (zero fixme).

### 1. Global search dialog (Cmd+K)

- `components/search/SearchDialog.tsx` (the search agent landed in
  `feat(v2/search)`). Header now mounts a `Search`-icon trigger button
  with `aria-keyshortcuts="Control+K Meta+K"`. Cmd+K / Ctrl+K from
  anywhere toggles the combobox dialog. The trigger is named via
  `nav.search.trigger.label` / `search.*` keys.
- Index: products, industries, and curated static pages, grouped in
  the dialog with keyboard navigation and click-to-route.

### 2. `/infolettre` newsletter signup (CASL Bill C-28 compliant)

- New SSG pages under `app/[locale]/infolettre/` (FR + EN) plus an
  inline `<NewsletterSignup variant="inline">` block in the footer.
  Form collects optional first name, mandatory email, and an explicit
  consent checkbox; CASL line surfaces under the form; consent
  timestamp + locale captured in the stored payload (sessionStorage stub
  until Phase 3 wires a real ESP).
- Newsletter agent `feat(v2/newsletter)` shipped a double-opt-in
  scaffold (`newsletter.success.heading` "Confirmation envoyée à ton
  courriel") so Phase 3 just needs to wire the confirmation email.
- Sitemap entry added at priority 0.4 (this sealer adds the entry to
  `STATIC_PATHS` — agent's PR didn't touch sitemap).

### 3. Print stylesheet for receipts

- `@media print` block in `app/globals.css`:
  - `[data-print-region]` reveals only the receipt subtree (everything
    else is `visibility: hidden`).
  - `[data-print-header]` is `display: none` on screen and
    `display: block` when printing — surfaces the wordmark, address,
    document type, date, and ref. Keys live under `print.header.*`.
  - `[data-print-hide]` and `button` are stripped from the printout.
  - `@page { margin: 16mm 14mm }` for a sensible paper layout.
- Wired into all four success / confirmation views:
  1. `/[locale]/confirmation` — `ConfirmationClient` (`title.order`)
  2. `/[locale]/soumission` — `QuoteSubmittedClient` (`title.quote`)
  3. `/[locale]/kit` — `KitSubmittedClient` (`title.kit`)
  4. `/[locale]/contact` — `ContactClient` success view (`title.message`)

### 4. PDP related products + cart upsell

- **PDP — related products**: new `<RelatedProducts>` component sourced
  from a dedicated `lib/recommendations.ts` (`getRelatedProducts`)
  cross-category recommender. Replaces the previous in-line
  same-category slice.
- **Cart upsell**: new `<CartUpsell>` component mounted in
  `panier/CartClient`. Heuristic surfaces up to 3 products from
  categories the cart doesn't already cover, deep-linked to PDP and
  copy-driven by `cart.upsell.*` keys.

### Wave 7 verification gates

| Gate | Result |
|---|---|
| `pnpm exec tsc --noEmit` | clean (exit 0) |
| `pnpm lint` | clean (exit 0) |
| `pnpm build` | **80 / 80** SSG (exit 0) |
| `pnpm exec playwright test tests/` | **26 / 26** passed, **0 fixme** |
| Smoke: 17 wave-6 routes | all 200 |
| Smoke: `/fr-ca/infolettre`, `/en-ca/infolettre` | 200 |
| Smoke: header search trigger (`aria-keyshortcuts="Control+K Meta+K"`) | present |
| Smoke: PDP related products section | rendered |
| Smoke: footer newsletter inline form | rendered |
| Smoke: `@media print` rules in shipped CSS | present |
| Smoke: `data-print-region` on all 4 success views | present |
| Sitemap: `/infolettre` entries | both locales present |

### Wave 7 surgical fix at the seal

Three E2E specs (`contact-form`, `quote-form`, `kit-order`) used
`getByText(/T-/).first()` etc. The Wave-7 print agent introduced a
`[data-print-header]` block that's `display: none` on screen but still
in the DOM and contains the same reference text (`Référence: T-…`).
`getByText` returns hidden nodes too, so `.first()` was hitting the
hidden header instead of the visible body line. Fixed by filtering to
visible-only DOM nodes in the three specs (no source-code change to
the agents' work).

## Phase 3 queue

1. **Real backend** — Stripe Checkout Session + webhook (real PSP); persistent
   DB for quotes/kits/orders/newsletter (Drizzle + Postgres / Supabase); auth.
2. **Real photography** — replace abstract industry SVGs and product mocks.
3. **GA-style custom event mapping** — wire `lib/analytics.ts` calls into the
   key journey points (`page_view`, `add_to_cart`, `quote_submit`,
   `kit_submit`, `contact_submit`, `newsletter_subscribe`, `search_query`).
   Provider switch already abstracted.
4. **Transactional email + ESP integration** — Resend or Postmark for
   quote/order/kit acknowledgments; wire `/infolettre` signup to
   Mailchimp / Brevo / Klaviyo with double-opt-in confirmation email.
5. **Recommender upgrade** — swap the hand-tuned cross-category
   recommender (`lib/recommendations.ts`) and `<CartUpsell>` heuristic
   for a real co-purchase model once order volume justifies it.
6. Optional: marketing-consent-gated remarketing pixels (Meta / Google),
   reusing the same `va:consent-changed` event infrastructure.
