# Surgical Audit Retrospective (Waves 1-16)

A retrospective on the perpetual surgical-audit loop that ran 16+ waves
against the Vision Affichage codebase between waves 1 and 16. The loop
caught 30+ real bugs across six recurring families and reached surface
saturation by wave 16. This doc captures the bug taxonomy, what the loop
proved out, where it fell short, and where the loop should pivot next.

## Bug families caught

Findings are grouped by structural class. Each family lists the
representative bugs, the wave they were caught, and the mitigation or
recommended next step.

### Family 1: Rules-of-Hooks regressions (4 bugs)

React's Rules of Hooks were violated in components that performed an
early return before calling a hook. Once mounted, swapping the early-
return branch caused "rendered fewer hooks than expected" crashes that
took the whole tree down.

- `CapacityWidget` (wave 9): `useMemo` after early return -> "rendered
  fewer hooks" crash on capacity threshold flip.
- `CartRecommendations` (wave 13): same pattern, mounted at App-root, so
  every page transition that toggled the empty-cart branch crashed the
  shell.
- `CompareBar` (wave 14): same pattern, also App-root.
- Wave 15 sweep: 10 more instances found in `ProductCard`,
  `ColorPicker`, and `ProductCustomizer` once we ran the codebase-wide
  pattern audit.
- Mitigation: pre-commit hook + CI gate (commits `06b37a0` + `6239510`)
  that statically scans for hook calls below `return` inside component
  bodies.

### Family 2: Prototype pollution (3+ bugs)

Any time we read `MAP[userInput]` without a `hasOwn` guard, a crafted
key like `__proto__`, `constructor`, or `toString` could leak the
prototype chain or throw a `TypeError`.

- `vendor-profile` (wave 10): `VENDOR_PROFILES[id]` without `hasOwn`,
  user-controlled `id`.
- `permissions` (wave 12): `loadOverrides` keyed on user IDs straight
  from the DB without guarding.
- `search.ts` (wave 15): `SYNONYMS[t]` without `hasOwn`, user query
  passes `__proto__` -> `TypeError`.
- Pattern: any time we look up `MAP[userInput]`, a `hasOwn` guard is
  required.
- Recommendation: codify as a custom ESLint rule. No built-in rule
  covers this exactly -- `no-prototype-builtins` is adjacent but not
  the same shape. We need a rule that flags any computed member access
  on a const-declared object literal where the key is not statically
  known.

### Family 3: Date / Number validity (4+ bugs)

`new Date(x)` where `x` is unparseable produces an `Invalid Date` that
silently propagates. `Number(x)` where `x` is `Infinity`, `-Infinity`,
or `NaN` propagates non-finite values into `toFixed`, sorts, and
arithmetic.

- `accept-invite` (wave 10): unparseable `expires_at` -> Invalid Date,
  invite check passed unconditionally.
- `savedDesigns` (wave 10): non-finite `createdAt` sort -> non-
  deterministic order in the dashboard.
- `loyalty` (wave 10): `Infinity` slipped into the points balance.
- `CountUp` (wave 6 / wave 13): `toFixed` `RangeError` when the input
  was non-finite, plus a final-frame fractional snap that printed
  `99.99999` instead of `100`.
- Recommendation: defensive helper
  `parseFiniteNumber(x: unknown): number | null` and a matching
  `parseValidDate(x: unknown): Date | null`, used at every external-
  data ingestion boundary.

### Family 4: Locale-aware formatting drifts (3 bugs)

Currency and locale-aware formatting was bypassed by ad-hoc `.toFixed()`
calls that hard-coded the dollar sign or omitted thousands separators.
EN/FR drift was a recurring symptom.

- `FeaturedProducts` EN dollar sign placement (wave 13): EN locale
  printed `19.99 $` instead of `$19.99`.
- `Sparkline` aria-label (wave 7): raw number, no currency context for
  screen readers.
- `OrderSummary` `fmtMoney` bypass (wave 7): subtotal line skipped the
  formatter entirely.
- Recommendation: ESLint rule banning raw `.toFixed()` in any file
  imported by a currency-context module; force routing through
  `formatCAD()`.

### Family 5: Object.freeze pattern alignment (10+ commits)

Module-level constant data was sometimes frozen and sometimes left
mutable, leading to drift where one module accidentally mutated shared
state.

- 10+ files had freeze patterns aligned across waves 4-10.
- Recommendation: codify the project pattern in `CONTRIBUTING.md` (or
  similar). A custom ESLint rule could warn when a module-level object
  literal containing only string/number/boolean/array values lacks
  `Object.freeze`.

### Family 6: Real customer-facing bugs (high blast radius)

These were not pattern-class bugs -- they were single-instance flow
breaks with very high blast radius.

- `ThankYou` -> `/compte/commandes` 404 (wave 11): every customer who
  completed a purchase saw a 404 on the post-checkout redirect. Pattern
  audit alone would not catch this -- the route just did not exist.
- `AIChat` prefill timing race (wave 12): proactive triggers fired
  before the prefill state was ready, so the first auto-message landed
  empty and silently failed.
- `LangToggle` missing `type="button"` (wave 5): inside a parent form,
  the toggle would submit the form on click.
- Recommendation: Playwright E2E coverage of checkout + the top critical
  flows. Pattern audits will not catch missing routes or timing races.

## Surface saturation timeline

| Wave range | Bugs / wave | Note |
|------------|-------------|------|
| 1-7        | ~5          | Highest yield, structural patterns |
| 8-12       | ~3          | Pattern audit catching variants |
| 13-15      | 1-2         | Plus one wave-15 sweep that found 10 |
| 16         | 0           | Surface saturated |

Diagnosis: the surgical pattern-based audit has reached diminishing
returns. The patterns we know how to look for have been swept. Further
yield from this exact loop will be incidental, not systemic.

## What worked

1. **Atomic single-file commits.** Easy review, easy rollback. Every
   commit could stand alone.
2. **Pattern recognition.** Once a class was identified, the codebase-
   wide sweep caught more (see wave 15: 10 more rules-of-hooks).
3. **Multi-agent fan-out.** Five parallel agents per wave covered more
   surface area than any single agent could.
4. **Pre-commit hook + CI gate** (added wave 15-16): closed the
   structural gap that allowed direct-to-main pushes to bypass lint for
   14 waves.

## What did not work

1. **Direct-to-main pushes** bypassed the PR-only CI lint for 14 waves.
   The lint existed; nothing required PRs to run it.
2. **The initial pre-commit hook was advisory-only** -- silent until
   wave 15 when we made it blocking. It was running and finding
   problems the whole time, just not stopping anything.
3. **Hot-list maintenance was manual.** Each wave had to be primed
   with the recent-bug hot-list by hand. Should be auto-derived from
   `git log` of the last N waves.

## Recommended next steps for the loop

1. **Codify the bug families as ESLint rules where possible.** Concrete
   rules to write:
   - `vision/require-hasown-guard` -- flag `MAP[userInput]` reads.
   - `vision/freeze-const-data` -- warn on module-level const objects of
     constant data without `Object.freeze`.
   - `vision/no-raw-tofixed-currency` -- ban `.toFixed()` in currency
     contexts; force `formatCAD()`.
2. **Add a CodeRabbit / Sourcegraph batch-change pattern** for cross-
   cutting reviews so the next wave-15-style sweep can run as a single
   batch change instead of 10 separate commits.
3. **Pivot the loop from audit to feature shipping** once the surface is
   saturated. Phase 16+ Python work, more product features. The audit
   loop has done its job; now ship.
4. **Add a wave-completion summary tracker.** Each wave bot writes a
   JSON entry to `loops/wave-NN.json` capturing what was shipped, what
   zones were audited, and the bug count. This auto-feeds the hot-list
   for the next wave and gives us a real time series.

## Bugs that were NOT prevented

None. The ship/regression cycle has not produced new bugs reintroducing
fixed patterns post-pre-commit landing. The structural gate is holding.
