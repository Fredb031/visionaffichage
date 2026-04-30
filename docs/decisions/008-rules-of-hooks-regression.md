# 008 — Rules-of-Hooks regression family

## Context

Three production-impacting `react-hooks/rules-of-hooks` bugs shipped in
quick succession during the perpetual surgical-audit loop:

- Wave 9 — `CapacityWidget.tsx` — `useMemo` placed after `return null` guard
- Wave 13 — `CartRecommendations.tsx` — `useMemo` after `items.length === 0` /
  `recs.length === 0` early returns
- Wave 14 — `CompareBar.tsx` — `useMemo` after `items.length < 2` /
  `pathname === '/comparer'` early returns

All three crash the page with "Rendered fewer hooks than previous render"
the moment the guard flips between renders.

## Why it slipped

1. The defensive cleanup waves added early-return guards (good) but moved
   them ABOVE existing `useMemo` / `useState` / `useEffect` calls (bad).
   React's hook tracking is positional — early-returning before a hook
   changes call order between renders.
2. The ESLint config DOES enable `react-hooks/rules-of-hooks: 'error'` and
   the rule fires correctly (verified via synthetic snippet test).
3. The repo's `.githooks/pre-commit` ran `npm run lint` but treated lint
   output as advisory, always exiting 0. Operators committing locally never
   saw a block.
4. CI does run lint and would have failed the PR — but the auto-merge
   path used by the autonomous loop pushes directly to `main`, sidestepping
   that gate.

## Mitigation (this commit)

- Sweep: 3 additional unfixed instances found and fixed
  (`ProductCard.tsx`, `customizer/ColorPicker.tsx`,
  `customizer/ProductCustomizer.tsx`). Pattern: hoist hooks above early
  returns or move the early return below the hooks.
- Pre-commit: rewrote `.githooks/pre-commit` to BLOCK on
  `react-hooks/rules-of-hooks` while keeping other lint findings advisory.
  Tested with a synthetic violation — hook exits 1 as expected.

## Open question

Should we add a custom ESLint rule that flags `useMemo`/`useState`/`useEffect`
calls within N lines of an `if (...) return null`? Probably overkill — the
official `react-hooks/rules-of-hooks` rule already catches every case we've
seen, and a custom heuristic risks false positives (a hook can legitimately
follow an early return *if the early return itself is below all hooks*).
The real lever is making sure the rule's output is enforced, not adding more
rules.

## Related

- `eslint.config.js` — rule level confirmed `'error'` via
  `reactHooks.configs.recommended.rules`.
- `.githooks/pre-commit` — the new rules-of-hooks block.
- `.github/workflows/ci.yml` — CI step `npm run lint` already enforces.
