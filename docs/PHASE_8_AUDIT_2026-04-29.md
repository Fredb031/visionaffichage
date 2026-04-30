# Phase 8 — Lighthouse Re-Baseline (2026-04-29)

Re-running Lighthouse mobile after waves 13-onwards perf wins (LoginModal lazy,
framer chunk split, supabase lazy, async fonts, image preloads).

## Context

Wave 13 baseline: **mobile perf 85** on the home page. Several perf-targeted
waves shipped between then and now without re-running Lighthouse, so the home
page had drifted to 80-82 by the time of this audit (cookie consent banner had
become the LCP candidate, beating the H1 hero on first paint).

## Run setup

- Build: `pnpm build` (Vite 5 production output)
- Server: `pnpm preview` on `http://localhost:4173`
- Tool: `pnpm dlx lighthouse@12 --form-factor=mobile --quiet --chrome-flags="--headless --no-sandbox"`
- Routes:
  - Home: `/`
  - PDP: `/product/atc1015` (route is `/product/:handle`, NOT `/produit/`)

## Scores — before fix

| Route | Perf | A11y | Best Practices | SEO |
|-------|------|------|----------------|-----|
| Home  | 80-82 | 92   | 100            | 100 |
| PDP   | 90   | 83   | 96             | 100 |

Top home findings:
- **LCP element was the cookie consent banner `<p id="cookie-consent-description">`** (~3.9s)
  — it's the largest text node painted in the initial mobile viewport.
- FCP 3.3s, LCP 3.9s, render-delay 89% of LCP budget.
- Render-blocking CSS: `index.css` 23.8kb (~607ms wasted).
- One responsive-image waste: ATC6606 thumbnail rendered at 172×172 from a
  400×400 source — 138kb of waste (single asset; structural fix would be
  introducing a srcset of pre-resized assets, deferred to a separate wave).
- Unused JS: framer ~34kb (animation utilities not used on home).

## Win shipped — lazy-load `CookieConsent` + extract storage primitives

The cookie banner pulled `lucide-react` icons (Cookie, X) and a full dialog
markup tree into the eager bundle, AND its bilingual `<p>` text was racing
to be the LCP element. Fix:

1. New `src/lib/cookieConsentStore.ts` exposes `getCookieConsent`,
   `persistCookieConsent`, and `ConsentState`. This is a tiny synchronous
   reader that `analytics.ts` and `useVisitorTracking.ts` import without
   pulling the React component or its icons.
2. `CookieConsent` component lazy-loaded via `React.lazy` in `App.tsx`,
   wrapped in `<Suspense fallback={null}>`. The lazy chunk fetch happens
   after the main bundle has parsed and rendered the page shell — long
   enough for the H1 hero to win the LCP race on the home page.
3. `CookieConsent.tsx` now imports the storage primitives from the new
   lib module and re-exports `getCookieConsent` for backward-compat with
   any callers we didn't migrate.

## Scores — after fix

| Route | Perf | A11y | Best Practices | SEO |
|-------|------|------|----------------|-----|
| Home  | **84-85** | 92   | 100            | 100 |
| PDP   | 90   | 83   | 96             | 100 |

Verified across 3 stability runs each.

Home LCP element flipped from `<p#cookie-consent-description>` to the
H1 hero `font-display font-black text-white text-5xl…` — exactly the
content we want users to see first. Home FCP went 3.3s → 2.4s.

PDP perf unchanged (90); LCP element on PDP is the product image, which
the cookie banner timing doesn't affect.

## Bundle deltas

- Main entry `index-*.js`: 287.61 kB → 283.61 kB (gzip 80.55 kB → 79.38 kB)
- New chunk: `CookieConsent-*.js` 4.7 kB (loaded after first paint)
- Top chunks unchanged: fabric 310.68 kB, supabase 195.79 kB, react 165.06 kB,
  ProductCustomizer 140.22 kB, framer 115.38 kB.

## Remaining open items (deferred)

- ATC6606 thumbnail responsive-image waste (138 kb saveable). Needs a
  product-grid wide srcset rollout — separate wave.
- ~~Render-blocking `index.css` (23.8 kb / 607 ms wasted). Could be split
  into critical-above-the-fold + deferred rest, but Tailwind's atomic
  output makes this non-trivial; deferred until a real CSS budget audit.~~
  **Resolved (Wave 20, this commit).** Added a Vite plugin
  (`deferNonCriticalCssPlugin`) in `vite.config.ts` that hooks
  `transformIndexHtml` post-build and rewrites the bundle's injected
  `<link rel="stylesheet">` into a preload-and-swap pattern
  (`<link rel="preload" as="style" onload="this.onload=null;this.rel='stylesheet'">`)
  with a `<noscript>` fallback for JS-disabled clients. Inlines a tiny
  ~1.2 kB critical CSS block carrying the brand HSL tokens, body
  bg/color, and font fallback so the page paints with brand colors
  before the deferred sheet attaches (avoids FOUC on home + PDP first
  paint). The 23.4 kB gzipped sheet still ships, but it no longer
  blocks FCP/LCP — it loads at preload priority alongside the JS
  bundle and attaches once it lands. Tailwind atomic output stays
  intact (no purge changes), so visual regressions are bounded to
  the brief window between FCP and stylesheet attach (mitigated by
  the inline tokens). Estimated home mobile FCP improvement: ~400-600 ms
  on 3G/4G first-paint. Lighthouse re-baseline pending next wave.
- ~~Hero H1 fade-in animation (`fadeSlideUp`, 80ms delay + 500ms duration)
  pushes home LCP to 4.0s.~~ **Resolved (Wave 19, commit pending).** The
  H1 now renders at full opacity from frame 0 — no animation on the LCP
  element itself. The trust pill, subhead, and CTAs around it still fade
  in (80/180/300 ms), so the choreography reads the same to the eye but
  the LCP candidate paints immediately. `prefers-reduced-motion: reduce`
  was already collapsing all animation durations globally to 0.01ms via
  the `@media` rule in `index.css`, so motion-sensitive users were
  already fine — this change benefits everyone else by ~500-580ms on
  LCP. Estimated home LCP 4.0s → ~3.4s (re-baseline pending).
