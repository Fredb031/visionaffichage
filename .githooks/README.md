# Git hooks

Repo-tracked git hooks for local dev convenience. Opt-in — nothing runs until
you point git at this directory.

## One-time setup

After cloning the repo, run:

```bash
git config core.hooksPath .githooks
```

This tells git to look here for hook scripts instead of the default
`.git/hooks/` directory. The setting is local to your clone and is not
committed.

To opt back out:

```bash
git config --unset core.hooksPath
```

## What the `pre-commit` hook does

Runs on every `git commit`, before the commit is recorded:

1. **`npx tsc --noEmit`** — full TypeScript type check. **Blocks the commit**
   if there are type errors. Same check CI runs.
2. **`npm run lint`** — ESLint. **Partially blocking**:
   - `react-hooks/rules-of-hooks` violations **BLOCK the commit**. These
     are real crash bugs (hooks placed after `if (...) return null`
     guards crash with "Rendered fewer hooks than expected" once the
     guard fires — see `docs/decisions/008-rules-of-hooks-regression.md`).
   - Other lint findings (unused vars, console statements, type-import
     hints, etc.) remain **advisory** — the hook prints the count and
     exits 0 so unrelated cleanup churn doesn't bury hook violations.

## Why not husky?

No new dependency, no `prepare` script, no `node_modules` surgery — just a
shell script in the repo and a one-line `git config`. If you prefer husky,
nothing here conflicts with it.

## Bypassing

For emergency commits, standard git bypass works:

```bash
git commit --no-verify -m "..."
```

Use sparingly — CI will still catch type errors on the PR.
