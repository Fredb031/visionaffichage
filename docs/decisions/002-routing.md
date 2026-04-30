# 002 — Routing: flat /fr-ca + /en-ca with shared path slugs

Status: accepted (2026-04-29)

## Context
Vision Affichage v2 is bilingual (fr-CA / en-CA). next-intl supports two URL strategies: shared path segments under a locale prefix (`/fr-ca/produits` and `/en-ca/produits`) or fully localized URLs via the `pathnames` config (`/fr-ca/produits` and `/en-ca/products`).

## Decision
Phase 1 ships shared path slugs. Both locales reuse the French path segments (`/produits`, `/industries`, `/panier`, `/checkout`, `/confirmation`, `/soumission`, `/comment-ca-marche`, `/a-propos`, `/avis`, `/kit`, `/faq`, `/contact`, `/confidentialite`, `/conditions`).

## Rationale
- One canonical path tree to think about during a high-velocity Phase 1 — slugs reach the right pages in either locale, hreflang/canonical does the SEO work.
- The Quebec audience is overwhelmingly bilingual; prefix is the load-bearing signal, not the slug.
- Avoids a 2x maintenance tax on routing tables and translated path constants while we still ship daily.
- All operational tools (sitemaps, JSON-LD URLs, Hreflang alternates) operate on a single path string.

## Consequences
- en-CA URLs read in French (`/en-ca/produits` rather than `/en-ca/products`). Acceptable trade-off for Phase 1; revisit when EN traffic exceeds 25% of sessions.
- Migration to `pathnames` config is purely additive: add a slug map in `i18n/routing.ts`, regenerate sitemap, add 301s from old paths to new in `middleware.ts`.

## Future plan
Phase 2 will introduce localized slugs (`/en-ca/products`, `/en-ca/cart`, etc.) once the team can absorb the corresponding QA and SEO migration. The redirect map will be one-shot and reversible.
