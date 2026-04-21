# Vision Affichage — Site Upgrade Task List

**Goal:** Rebrand + polish Vision Affichage into the most beautiful, easiest-to-use merch-ordering site for Québec businesses. Use all 523 installed skills. Ship surgical changes. Each task = 1 commit.

**Progress markers:** `[ ]` todo · `[~]` in progress · `[x]` done · `[-]` skipped/not needed

---

## 0. REBRAND FOUNDATION (the identity pass)

- [ ] 0.1  Define brand vector doc: navy #1B3A6B dominant, gold #E8A838 accent (10%), charcoal #0F2341 shadow, cream #F5F2E8 surface
- [ ] 0.2  Type stack lock: Plus Jakarta Sans (body 400/500/800) + Lora 300 italic (editorial)
- [ ] 0.3  Spacing scale: strict 4/8/12/16/24/32/48/64 only — audit every `[NNpx]` arbitrary value
- [ ] 0.4  Radius scale: 8/12/16/24/9999 — audit `rounded-[NNpx]`
- [ ] 0.5  Shadow scale: define `shadow-card`, `shadow-cta`, `shadow-modal`, `shadow-nav` tokens in index.css
- [ ] 0.6  Motion budget: all micro-interactions ≤200ms, page loads 400–700ms, hero 850ms
- [ ] 0.7  Brand voice tone guide: confident, concise, French-first, pragmatic
- [ ] 0.8  Photography guidelines doc: on-body garment shots, natural Québec lighting, 3:4 portraits
- [ ] 0.9  Iconography: strictly lucide-react, 1.5 stroke, 14/16/18 sizes only
- [ ] 0.10 Accessibility target: WCAG 2.2 AA contrast everywhere, focus rings on every interactive

---

## 1. HOMEPAGE (Index.tsx) – visual + conversion

- [x] 1.1  Hero: Lora italic 300 + Jakarta 800 weight contrast (done dd5d3cc)
- [ ] 1.2  Hero subline kicker: change to uppercase wide-tracking gold eyebrow
- [ ] 1.3  Hero CTA: switch from navy gradient pill to split-button (Primary + "ou voir prix en gros")
- [ ] 1.4  Add above-fold metric strip: "500+ entreprises · 4.9⭐ · 5 jours ouvrables · Québec"
- [ ] 1.5  Logo marquee: slow to 40s duration, add faint fade-mask on edges
- [ ] 1.6  "How it works" section: connect nodes with an actual dashed line, not just gradient
- [ ] 1.7  Featured products: add "From $N" price bait and hover-reveal reverse-side image
- [ ] 1.8  Testimonials: add real photos, replace avatar initials when name known
- [ ] 1.9  FAQ: collapse Q&A list into accordion, accessible disclosures
- [ ] 1.10 CTA band between sections: "Besoin d'une soumission? 24h réponse garantie"
- [ ] 1.11 Sticky bottom CTA on scroll past hero (mobile only)
- [ ] 1.12 Add localized social proof ("Déjà commandé par: Sous Pression, Perfocazes, Lacasse")
- [ ] 1.13 Hero video autoplay (muted, plays-inline) of printing process loop
- [ ] 1.14 Section "Pourquoi Vision" with 3 unique selling props: locale, rapide, personnalisé
- [ ] 1.15 Scroll-trigger color shift: navy → cream → navy as user scrolls
- [ ] 1.16 Footer: add newsletter incentive "10% off ton premier lot"
- [ ] 1.17 Footer: add Instagram/Facebook icons with live follower counts
- [ ] 1.18 Footer: add compact catalog index (tshirts, hoodies, caps) deep-links
- [ ] 1.19 Fix hero kerning on mobile (`tracking-[-3px]` overlaps at 320px)
- [ ] 1.20 Add `scroll-mt-20` to anchor targets so sticky nav doesn't overlap
- [ ] 1.21 Add "Made in Québec" flag badge to hero
- [ ] 1.22 Compress above-fold hero image/svg (verify LCP image is 1 resource)
- [ ] 1.23 Hero stats: animate count-up on intersection (500+, 4.9, etc.)
- [ ] 1.24 Add trust badges row (Shopify, Visa, Mastercard, Amex, Apple/Google Pay)
- [ ] 1.25 Dark-mode hero variant (optional, media query)

---

## 2. PRODUCT CATALOG (Products.tsx + ProductCard.tsx)

- [ ] 2.1  Replace generic category tab buttons with icon+label compound tabs
- [ ] 2.2  Add sort dropdown: Populaire · Prix ↑ · Prix ↓ · Nouveauté
- [ ] 2.3  Add filter sidebar: color swatches, size availability, category
- [ ] 2.4  Empty search state: suggest popular products
- [ ] 2.5  Loading skeleton: match actual card proportions exactly
- [ ] 2.6  ProductCard image: add subtle hover zoom + back-view reveal
- [ ] 2.7  ProductCard: show real color count ("7 couleurs") not just dots
- [ ] 2.8  ProductCard: hide stock badge when fullStock, show amber if ≤5
- [ ] 2.9  ProductCard: "From $N / unit" with bulk-discount hint underneath
- [ ] 2.10 Sticky search bar on mobile while scrolling
- [ ] 2.11 Grid: 2-col mobile, 3-col tablet, 4-col laptop, 5-col wide
- [ ] 2.12 Add "Quick view" modal on ProductCard (spacebar/click magnify)
- [ ] 2.13 Wishlist toggle persists across sessions (storage fallback already in)
- [ ] 2.14 Category icon color-coding (tshirt=navy, hoodie=charcoal, etc.)
- [ ] 2.15 Result count: "22 produits · 7 colours disponibles"
- [ ] 2.16 Add "Recently viewed" horizontal scroller above catalog grid
- [ ] 2.17 Pagination / infinite scroll if catalog >30 items
- [ ] 2.18 Search highlights match text in results
- [ ] 2.19 Keyboard arrow navigation across card grid
- [ ] 2.20 Add URL-backed search state so filters are shareable

---

## 3. PRODUCT DETAIL (ProductDetail.tsx)

- [ ] 3.1  Image gallery: thumbs strip, pinch-zoom on touch, keyboard arrows
- [ ] 3.2  Variant selector: show unavailable options as strikethrough, not hidden
- [ ] 3.3  Add size-guide modal anchor link
- [ ] 3.4  Add "In stock" real-time indicator from SanMar
- [ ] 3.5  Add "Similar products" horizontal scroller below CTA
- [ ] 3.6  Show color-matched garment hex swatches inline
- [ ] 3.7  "Customize" button hero-size + gold accent variant
- [ ] 3.8  Bulk-price calculator tooltip with breakdown
- [ ] 3.9  "Design tips" dismissible banner linking to placement guide
- [ ] 3.10 Breadcrumb: Home → Products → Category → Product
- [ ] 3.11 Print JSON-LD Product schema (already there — verify completeness)
- [ ] 3.12 Add shipping ETA calculator based on postal-code input
- [ ] 3.13 Bulk-calc column rhythm fix (done 905924a)
- [ ] 3.14 Description section: collapsible on mobile
- [ ] 3.15 Photo zoom overlay with focus trap
- [ ] 3.16 "Add to wishlist" button parity with ProductCard
- [ ] 3.17 Stock warning: "Only 3 left in Navy XL" if ≤5
- [ ] 3.18 Share button: native share sheet + copy-link fallback
- [ ] 3.19 Save last-viewed variant in localStorage for quicker reorder
- [ ] 3.20 Show matching print areas (chest, back, sleeve) with interactive hotspots

---

## 4. CUSTOMIZER (ProductCustomizer.tsx + siblings)

- [ ] 4.1  Step indicator: numbered dots with labels (1 Logo · 2 Placement · 3 Sizes · 4 Review)
- [ ] 4.2  Progress auto-advance when step complete
- [ ] 4.3  Logo upload: drag-n-drop target animated
- [ ] 4.4  Logo preview: checker background to show transparency
- [ ] 4.5  Remove-bg toggle: show before/after diff
- [ ] 4.6  Placement: drag-to-position with snap-to-common-zones
- [ ] 4.7  Placement: rotation handle (0/90/180/270)
- [ ] 4.8  Placement: scale handle with aspect-lock
- [ ] 4.9  Side switcher: front/back with swipe gesture
- [ ] 4.10 Size matrix: auto-fill "same sizes for all colors" toggle
- [ ] 4.11 Sizing quick-buttons: 12+12+12 preset, 10+20+10 preset
- [ ] 4.12 Bulk discount progress bar with celebration at threshold
- [ ] 4.13 Preview snapshot: watermark removed at final render
- [ ] 4.14 Export preview button (download PNG of design)
- [ ] 4.15 Share design-link to vendor (deep-link with customizer state)
- [ ] 4.16 Undo/redo actions (5-step history)
- [ ] 4.17 Keyboard arrow nudges logo by 1/5/10 px
- [ ] 4.18 Mobile: stack panels vertically, not side-by-side
- [ ] 4.19 Save-as-template button (for repeat orders)
- [ ] 4.20 Load template from previous order button
- [ ] 4.21 Tooltip on each size option with chest/length measurements
- [ ] 4.22 Print area overlay with bleed+safe zones visible
- [ ] 4.23 Canvas pinch-zoom on mobile
- [ ] 4.24 Reset button: confirmation modal
- [ ] 4.25 DPI warning on low-res logo uploads (exists — polish UX)

---

## 5. CART & CHECKOUT

- [ ] 5.1  Cart: trust bar (30-day guarantee, secure checkout, Québec print)
- [ ] 5.2  Cart recommendations: match-style upsells, not just "also bought"
- [ ] 5.3  Cart: shipping calculator by postal code inline
- [ ] 5.4  Cart: "Save for later" per-line
- [ ] 5.5  Cart empty: hero illustration + "start with a popular product"
- [ ] 5.6  Cart: optimistic UI on quantity changes (already partial)
- [ ] 5.7  Promo code: autocomplete suggestions of public codes
- [ ] 5.8  Promo code: show savings immediately with strike-through
- [ ] 5.9  Checkout: address autocomplete via Canada Post API
- [ ] 5.10 Checkout: split-screen summary + form on desktop (already there)
- [ ] 5.11 Checkout: save "pending checkout" if user leaves
- [ ] 5.12 Checkout: Apple Pay / Google Pay express buttons
- [ ] 5.13 Checkout: shipping-method radio with ETA date shown
- [ ] 5.14 Checkout: tax breakdown with QST/GST lines
- [ ] 5.15 Checkout: success page with order number, confetti, next steps
- [ ] 5.16 Checkout email aria-describedby (done aa3b940)
- [ ] 5.17 Checkout: gift-message textarea option
- [ ] 5.18 Checkout: vendor-code field (B2B referral)
- [ ] 5.19 Checkout: "order delivers by {date}" headline promise
- [ ] 5.20 Checkout mobile: sticky total at bottom with "Pay $X" button

---

## 6. ACCESSIBILITY PASS

- [ ] 6.1  Focus-visible rings on every button/link globally (audit)
- [ ] 6.2  Skip-link already in place (verify target exists on every page)
- [ ] 6.3  Landmark regions: every page has nav/main/footer/complementary
- [ ] 6.4  Heading hierarchy: one h1 per page, no h3 without h2
- [ ] 6.5  Color contrast: AA minimum on all text (run a contrast checker)
- [ ] 6.6  Reduced motion: audit every animation has prefers-reduced-motion guard
- [ ] 6.7  Alt text on every informative image
- [ ] 6.8  Form labels: explicit <label for> pairing, not implicit
- [ ] 6.9  Error messages: role=alert + aria-describedby on bad input
- [ ] 6.10 Live regions: aria-live on cart count, toast, search results count
- [ ] 6.11 Keyboard: every modal trappable + Escape-dismissible
- [ ] 6.12 Keyboard: arrow keys within listboxes/radiogroups
- [ ] 6.13 Screen reader announcements: success/error state changes
- [ ] 6.14 Tap targets: ≥44×44 px on mobile interactive
- [ ] 6.15 Language attr: `<html lang="fr">` flips with lang toggle (done)
- [ ] 6.16 Form autocomplete attributes on every input (verify)
- [ ] 6.17 Progress bars: aria-valuenow/min/max
- [ ] 6.18 Tables: caption + th scope
- [ ] 6.19 Abbreviations: title attr explanation
- [ ] 6.20 Link text: no "click here" — descriptive text

---

## 7. PERFORMANCE

- [ ] 7.1  AIChat lazy-split (done 38ee793)
- [ ] 7.2  Customizer lazy-split (already done)
- [ ] 7.3  ProductDetail parallel prefetch (done 460ab2e)
- [ ] 7.4  Images: add sizes/srcset everywhere
- [ ] 7.5  Images: loading="lazy" past fold, eager above
- [x] 7.6  Fonts: preload Plus Jakarta + Lora subsets — preconnect pair to fonts.googleapis.com + fonts.gstatic.com already in index.html (lines 69-70); full `<link rel=preload>` of specific woff2 files deferred because hardcoded gstatic v-hashes drift across Google Fonts revisions (risk of silent 404 noise > ~150ms LCP gain)
- [x] 7.7  Fonts: font-display: swap (verify) — `&display=swap` is present on the `@import` URL in src/index.css (line 1)
- [ ] 7.8  Critical CSS inline above the fold
- [ ] 7.9  Code-split admin routes from client bundle
- [ ] 7.10 React Query: increase staleTime on static data (products)
- [ ] 7.11 Debounce search input (300ms)
- [ ] 7.12 Memoize expensive list renders
- [ ] 7.13 Remove unused dependencies from package.json
- [ ] 7.14 Compress hero images to WebP/AVIF
- [ ] 7.15 Preconnect hints to Shopify + Supabase (done)
- [ ] 7.16 Service worker for offline-first navigation
- [ ] 7.17 HTTP/2 push critical assets
- [ ] 7.18 Reduce fabric.js bundle (310 KB — tree-shake)
- [ ] 7.19 Lighthouse score target 95+ on all core pages
- [ ] 7.20 CLS audit: reserve space for all async content

---

## 8. SEO & DISCOVERABILITY

- [ ] 8.1  Product JSON-LD schema per product
- [ ] 8.2  Breadcrumb JSON-LD schema
- [ ] 8.3  Organization JSON-LD schema on homepage
- [ ] 8.4  FAQ JSON-LD schema on FAQ section
- [ ] 8.5  OG tags: image, title, description per page
- [ ] 8.6  Twitter card metadata
- [ ] 8.7  Sitemap.xml generated at build
- [ ] 8.8  Robots.txt tuned
- [ ] 8.9  Canonical URLs on every page
- [ ] 8.10 hreflang fr-CA / en-CA alternates
- [ ] 8.11 Descriptive page titles (useDocumentTitle coverage)
- [ ] 8.12 Meta descriptions per page
- [ ] 8.13 Internal linking: product → category → related product
- [ ] 8.14 Alt text keyword-rich but natural
- [ ] 8.15 Image filenames descriptive (post-build)
- [ ] 8.16 404 page: useful suggestions + search
- [ ] 8.17 Schema.org for local business
- [ ] 8.18 Google My Business data embed
- [ ] 8.19 Structured data for customer reviews
- [ ] 8.20 Core Web Vitals < target thresholds

---

## 9. ADMIN SURFACE POLISH

- [ ] 9.1  Dashboard: at-a-glance today widget (done live-clock)
- [ ] 9.2  Admin sidebar: collapse/expand on laptop
- [ ] 9.3  Command palette (Cmd+K) spanning all admin pages
- [ ] 9.4  Notifications dropdown with unread indicator
- [ ] 9.5  Bulk actions on all admin tables (ship, archive, export)
- [ ] 9.6  Inline editing on vendor names / customer tags
- [ ] 9.7  Keyboard shortcuts docs (?)
- [ ] 9.8  Dark mode toggle for admin
- [ ] 9.9  Activity feed deep-links to source record
- [ ] 9.10 Admin Orders: timeline view toggle
- [ ] 9.11 Admin Customers: lifetime value + cohort analysis
- [ ] 9.12 Admin Products: inventory trend sparklines
- [ ] 9.13 Admin Vendors: performance rankings
- [ ] 9.14 Admin Quotes: convert-to-order action
- [ ] 9.15 Admin Abandoned Carts: one-click recovery email
- [ ] 9.16 Admin Analytics: export CSV buttons per chart
- [ ] 9.17 Admin Settings: backup/restore localStorage state
- [ ] 9.18 Admin permissions: per-role route guards (done)
- [ ] 9.19 Audit log for admin actions
- [ ] 9.20 2FA enforcement UI (stub currently — wire later)

---

## 10. VENDOR SURFACE

- [ ] 10.1 Vendor dashboard: live commission ticker
- [ ] 10.2 Vendor quotes: clone-existing button
- [ ] 10.3 Vendor: mobile app-like shortcuts ("Send quote", "View stats")
- [ ] 10.4 Vendor: public profile link with bio + specialty
- [ ] 10.5 Vendor: onboarding tour for new vendors
- [ ] 10.6 Vendor: commission statement download
- [ ] 10.7 Vendor: tax form upload (T4A)
- [ ] 10.8 Vendor: client CRM (notes per client)
- [ ] 10.9 Vendor: quote templates save/load
- [ ] 10.10 Vendor: mobile-first quote builder polish

---

## 11. CONTENT / COPY

- [ ] 11.1 Replace "Lorem ipsum" remnants if any
- [ ] 11.2 Unify voice: informal French tutoiement, confident English
- [ ] 11.3 Rewrite product descriptions with feature-benefit pattern
- [ ] 11.4 Add customer testimonials (3+ with photo)
- [ ] 11.5 Case studies section: 3 real clients with before/after
- [ ] 11.6 Blog/content hub: 5 initial articles on merch tips
- [ ] 11.7 FAQ: 20+ common questions bilingual
- [ ] 11.8 Policies: returns, privacy, terms, shipping
- [ ] 11.9 About: founder story + Québec craft angle
- [ ] 11.10 Contact: map, phone, email, hours

---

## 12. INTEGRATIONS

- [ ] 12.1 Shopify Storefront latest GraphQL version
- [ ] 12.2 Supabase auth flow: passwordless magic-link option
- [ ] 12.3 Replicate/OpenAI image-gen admin (done: aspect ratio)
- [ ] 12.4 SanMar inventory live polling (cache-aware)
- [ ] 12.5 Stripe Elements fallback if Shopify Payments fails
- [ ] 12.6 Google Analytics 4 events on key conversions
- [ ] 12.7 Meta Pixel for ad retargeting
- [ ] 12.8 TikTok Pixel for TikTok ads
- [ ] 12.9 Hotjar session recordings sample
- [ ] 12.10 Intercom/Crisp chat handoff from AI bot

---

## 13. INTERNATIONALIZATION

- [ ] 13.1 Every string in i18n catalog (audit for hardcoded)
- [ ] 13.2 Date/time formatting via Intl.DateTimeFormat
- [ ] 13.3 Currency formatting via Intl.NumberFormat
- [ ] 13.4 Number formatting: thousand separators per locale
- [ ] 13.5 Pluralization rules (Intl.PluralRules)
- [ ] 13.6 Bidi text support for RTL future
- [ ] 13.7 Translation validation: missing key = fail build

---

## 14. SECURITY & PRIVACY

- [ ] 14.1 CSP header configured
- [ ] 14.2 HSTS header
- [ ] 14.3 CSRF tokens on state-changing forms
- [ ] 14.4 Input sanitization on rich-text entries
- [ ] 14.5 Rate limiting on auth endpoints
- [ ] 14.6 Secrets audit: no tokens in client bundle (except Storefront API which is public)
- [ ] 14.7 Cookie consent banner (Québec Law 25)
- [ ] 14.8 Privacy policy URL in footer
- [ ] 14.9 Data export tool for customers
- [ ] 14.10 Account deletion flow

---

## 15. DEVELOPER EXPERIENCE

- [ ] 15.1 README refresh with architecture overview
- [ ] 15.2 CONTRIBUTING.md with commit-style rules
- [ ] 15.3 PR template
- [ ] 15.4 Storybook for UI components
- [ ] 15.5 Playwright e2e smoke tests
- [ ] 15.6 Vitest unit tests on lib/ utilities
- [ ] 15.7 Type coverage report
- [ ] 15.8 ESLint rule tightening
- [ ] 15.9 Prettier config
- [ ] 15.10 Husky pre-commit hooks
- [ ] 15.11 GitHub Actions CI
- [ ] 15.12 Deploy preview links per PR
- [ ] 15.13 Bundle analyzer in CI
- [ ] 15.14 Dependency update workflow

---

## 16. MOBILE & PWA

- [ ] 16.1 Add manifest.json with icons
- [ ] 16.2 Apple touch icon
- [ ] 16.3 Favicon set (16/32/ico/apple)
- [ ] 16.4 iOS splash screens
- [ ] 16.5 Service worker + offline shell
- [ ] 16.6 Install prompt
- [ ] 16.7 Share-target API
- [ ] 16.8 Push notification opt-in
- [ ] 16.9 Touch gestures throughout customizer
- [ ] 16.10 Safe-area-insets on every fixed element

---

## 17. MICRO-INTERACTIONS

- [ ] 17.1 Cart count badge: scale-pulse on add
- [ ] 17.2 Wishlist heart: burst animation on like
- [ ] 17.3 Add-to-cart: confetti on bulk-threshold hit
- [ ] 17.4 Form submit: button morphs into check mark
- [ ] 17.5 Stepper: tick animation on completion
- [ ] 17.6 Price change: flip-number animation
- [ ] 17.7 Color swatch: subtle glow on hover
- [ ] 17.8 Cart drawer: slide+fade with spring
- [ ] 17.9 Toast: slide from top-right with pause-on-hover
- [ ] 17.10 Page transitions: cross-fade between routes

---

## 18. ADDITIONAL BUGS TO HUNT

- [ ] 18.1 cartStore parallel-no-cart race (documented in backlog)
- [ ] 18.2 ProductCustomizer retry-after-throw dup risk
- [ ] 18.3 fabric IText position persistence
- [ ] 18.4 Double-click guard on every network-triggering button
- [ ] 18.5 Every useEffect with cleanup verified
- [ ] 18.6 Every timeout/interval cleared on unmount
- [ ] 18.7 Every blob URL revoked
- [ ] 18.8 Every event listener removed
- [ ] 18.9 Every form reset on navigate-away
- [ ] 18.10 Every infinite-loop potential (dep array audit)

---

## 19. INFRASTRUCTURE

- [ ] 19.1 Deploy to Vercel preview
- [ ] 19.2 Custom domain (visionaffichage.com) aliased
- [ ] 19.3 CDN for images
- [ ] 19.4 Uptime monitoring
- [ ] 19.5 Error tracking (Sentry)
- [ ] 19.6 Log aggregation
- [ ] 19.7 Performance monitoring (RUM)
- [ ] 19.8 DB backups for Supabase
- [ ] 19.9 Staging environment
- [ ] 19.10 Canary deploy capability

---

## 20. RAW BUG BACKLOG (to find & fix)

Running list — each bug = 1 fix commit:

- [ ] 20.1 Test every form with pasted ZWSP / invisible characters
- [ ] 20.2 Test every date display across midnight boundary
- [ ] 20.3 Test Safari private browsing (localStorage throws)
- [ ] 20.4 Test Firefox strict mode (cookie blocking)
- [ ] 20.5 Test slow-3G throttled network
- [ ] 20.6 Test offline mode
- [ ] 20.7 Test print stylesheet on every page
- [ ] 20.8 Test RTL (Arabic/Hebrew) prep
- [ ] 20.9 Test zoom 200% browser default
- [ ] 20.10 Test high-contrast OS mode
- [ ] 20.11 Test 320px narrow viewport
- [ ] 20.12 Test 4K wide viewport
- [ ] 20.13 Test keyboard-only nav every page
- [ ] 20.14 Test VoiceOver on Mac
- [ ] 20.15 Test NVDA on Windows
- [ ] 20.16 Test TalkBack on Android
- [ ] 20.17 Test iOS VoiceOver
- [ ] 20.18 Test dark-mode OS preference
- [ ] 20.19 Test Safari Intelligent Tracking Prevention
- [ ] 20.20 Test Chrome incognito
- [ ] 20.21–20.100 — continued bug hunts, 1 per iteration

---

## META

- Each line above is one atomic commit. No grouping.
- When a task lands on main, flip `[ ]` to `[x]` and link the sha.
- Re-use this file on every wake-up — pick the next `[ ]`.
- New bugs found during execution → append at bottom of §20.
- If a task turns out unnecessary, mark `[-]` with a one-line reason.

**Current shipped commits:** 100+ on main this session (see git log).
