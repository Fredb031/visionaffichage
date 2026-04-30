# 005 — Design tokens: custom Tailwind palette, no shadcn defaults

Status: accepted (2026-04-29)

## Context
The UX dossier (Vol III) specifies a deliberate ink/slate/sand palette with a warm canvas, a single accent ink color, and motion / typography / radius scales tuned to a Quebec-blue-collar voice. Pulling shadcn/ui's default zinc/slate radix tokens would dilute the brand.

## Decision
Custom Tailwind tokens in `tailwind.config.ts` and `app/globals.css`:
- **Ink** (text + primary buttons): `ink-950 #101114`, `ink-800 #1D2127`
- **Slate** (focus rings, accents): `slate-700 #35556D`
- **Canvas** (backgrounds): `canvas-000 #FFFFFF`, `canvas-050 #F8F7F3` (warm off-white)
- **Sand** (warm muted, borders, hover wash): `sand-100 #F0ECE4`, `sand-300 #D9D1C3`
- **Stone** (muted text on canvas backgrounds): `stone-500 #7A7368`, `stone-600 #5F594E` (added Wave 3B for AA contrast on canvas-050)
- **State** (success / warning / error): three-step ramps at 50/200/700 only

Type scale: `display-{xl,lg}` `title-{xl,lg,md}` `body-{lg,md,sm}` `meta-xs`. Each scale point has explicit line-height, letter-spacing, weight.

Radius scale: `sm 10px`, `md 14px`, `lg 18px`, `pill 9999px`. Shadow scale: `xs/sm/md/lg`. Motion durations: `fast 120ms`, `base 180ms`, `slow 240ms`. All defined in the same config.

## Rationale
- Tokens are the brand. shadcn defaults are a starter kit, not a brand system.
- Single source of truth: every component reaches into the named token, never a raw hex.
- Strict AA on the warm `canvas-050` background was the constraint that drove `stone-600`. `text-stone-500` (4.37:1) failed AA in Wave 3B Lighthouse audit; `stone-600` (~7:1) clears the bar without darkening hierarchy.
- Easy migration to Tailwind 4: tokens already live as CSS custom properties in `globals.css`.

## Consequences
- Components do not import shadcn primitives. `components/ui/*` is hand-rolled (Button, Container, Section, EmptyState, Breadcrumbs).
- No Radix dependencies. ARIA wiring is manual but auditable (see `components/pdp/ProductGallery.tsx` for the role=tablist pattern).

## Trade-offs
- More component code than shadcn would yield. Worth the brand control for a marketing-led site.
- Future contributors need a 5-minute orientation — covered in `README.md` § "Design tokens".
