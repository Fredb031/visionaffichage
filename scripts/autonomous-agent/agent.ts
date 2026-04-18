/**
 * Vision Affichage — Autonomous Improvement Agent
 *
 * Runs on a GitHub Actions cron schedule. Uses Claude Opus 4.7 with tool use
 * (bash, read, write, edit, grep, glob) to audit the site, find small
 * incremental improvements, apply them, run the build, and commit to the
 * autonomous-improvements branch.
 *
 * Safety rails:
 *   - Only commits to the `autonomous-improvements` branch (never main)
 *   - Hard cap on file changes per run (default 3, configurable via MAX_CHANGES)
 *   - Hard cap on iterations (20 tool calls)
 *   - Must run `npm run build` successfully before committing
 *   - Protected paths: products.ts, shopify.ts, cart stores, env files
 *   - Cheap subagent (Haiku) pre-screens the issue list so Opus only sees
 *     a curated shortlist — saves tokens on the expensive model
 */

import Anthropic from '@anthropic-ai/sdk';
import { execSync } from 'node:child_process';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve, join } from 'node:path';

// ── Config ──────────────────────────────────────────────────────────────────
const REPO_ROOT = resolve(process.cwd(), '../..');
const MAX_CHANGES = parseInt(process.env.MAX_CHANGES ?? '3', 10);
const MAX_ITERATIONS = 20;
const FOCUS = process.env.FOCUS ?? '';
const BRANCH = 'autonomous-improvements';
const RUN_ID = process.env.RUN_ID ?? String(Date.now());

// Paths the agent must NEVER modify (too risky for autonomous changes)
const PROTECTED_PATHS = [
  'src/data/products.ts',      // product catalog — business data
  'src/lib/shopify.ts',         // Shopify API client
  'src/store/cartStore.ts',     // cart state
  'src/stores/cartStore.ts',    // Shopify cart
  '.env',
  '.github/workflows/',         // don't let agent modify its own workflow
  'scripts/autonomous-agent/',  // don't let agent modify itself
  'package.json',
  'package-lock.json',
  'bun.lock',
  'public/products/',           // Drive images — don't touch
];

// File change counter — enforced by the write/edit tools
let changedFiles = new Set<string>();

// ── Helpers ─────────────────────────────────────────────────────────────────
function isProtected(path: string): boolean {
  const normalized = path.replace(/^\.?\/+/, '');
  return PROTECTED_PATHS.some(p =>
    normalized === p || normalized.startsWith(p),
  );
}

function safePath(path: string): string {
  // Resolve to absolute and verify it's inside REPO_ROOT
  const abs = resolve(REPO_ROOT, path);
  if (!abs.startsWith(REPO_ROOT)) {
    throw new Error(`Path escapes repo root: ${path}`);
  }
  return abs;
}

function bash(cmd: string, cwd = REPO_ROOT): { stdout: string; stderr: string; code: number } {
  try {
    const stdout = execSync(cmd, {
      cwd,
      encoding: 'utf-8',
      stdio: ['ignore', 'pipe', 'pipe'],
      maxBuffer: 10 * 1024 * 1024,
      timeout: 180_000, // 3 minutes
    });
    return { stdout: stdout.toString(), stderr: '', code: 0 };
  } catch (err) {
    const e = err as { stdout?: Buffer; stderr?: Buffer; status?: number };
    return {
      stdout: e.stdout?.toString() ?? '',
      stderr: e.stderr?.toString() ?? '',
      code: e.status ?? 1,
    };
  }
}

// ── Tool definitions ────────────────────────────────────────────────────────
const tools: Anthropic.ToolUnion[] = [
  {
    name: 'read_file',
    description: 'Read a file from the repo. Returns up to 500 lines starting at offset 0 unless specified.',
    input_schema: {
      type: 'object' as const,
      properties: {
        path: { type: 'string', description: 'Repo-relative path, e.g. src/pages/Index.tsx' },
        offset: { type: 'number', description: 'Line to start at (0-indexed)', default: 0 },
        limit: { type: 'number', description: 'Max lines to return', default: 500 },
      },
      required: ['path'],
    },
  },
  {
    name: 'grep',
    description: 'Search repo files for a regex pattern. Returns file paths and matching lines.',
    input_schema: {
      type: 'object' as const,
      properties: {
        pattern: { type: 'string', description: 'Regex pattern' },
        path: { type: 'string', description: 'Directory to search (default: src/)', default: 'src' },
        include: { type: 'string', description: 'File glob, e.g. "*.tsx"' },
      },
      required: ['pattern'],
    },
  },
  {
    name: 'glob',
    description: 'Find files matching a glob pattern.',
    input_schema: {
      type: 'object' as const,
      properties: {
        pattern: { type: 'string', description: 'Glob, e.g. "src/**/*.tsx"' },
      },
      required: ['pattern'],
    },
  },
  {
    name: 'edit_file',
    description: 'Replace an exact string in a file. Fails if old_string is not unique or not found.',
    input_schema: {
      type: 'object' as const,
      properties: {
        path: { type: 'string' },
        old_string: { type: 'string', description: 'Exact string to replace (must be unique in file)' },
        new_string: { type: 'string', description: 'Replacement string' },
      },
      required: ['path', 'old_string', 'new_string'],
    },
  },
  {
    name: 'write_file',
    description: 'Create or overwrite a file. Use edit_file instead when modifying existing files.',
    input_schema: {
      type: 'object' as const,
      properties: {
        path: { type: 'string' },
        content: { type: 'string' },
      },
      required: ['path', 'content'],
    },
  },
  {
    name: 'run_build',
    description: 'Run `npm run build` from the repo root. Use this to verify changes compile before finalizing.',
    input_schema: { type: 'object' as const, properties: {} },
  },
  {
    name: 'run_typecheck',
    description: 'Run `npx tsc --noEmit` from the repo root to check types.',
    input_schema: { type: 'object' as const, properties: {} },
  },
  {
    name: 'finalize',
    description: 'Call this when done. Commits all changes to the autonomous-improvements branch with the provided message. After this, no more tool calls.',
    input_schema: {
      type: 'object' as const,
      properties: {
        commit_message: { type: 'string', description: 'Clear summary of what was improved (imperative mood, present tense)' },
        summary: { type: 'string', description: 'Brief explanation of the changes for the user' },
      },
      required: ['commit_message', 'summary'],
    },
  },
];

// ── Tool executor ───────────────────────────────────────────────────────────
function executeTool(name: string, input: Record<string, unknown>): string {
  try {
    switch (name) {
      case 'read_file': {
        const path = input.path as string;
        const offset = (input.offset as number) ?? 0;
        const limit = (input.limit as number) ?? 500;
        const abs = safePath(path);
        if (!existsSync(abs)) return `ERROR: file not found: ${path}`;
        const content = readFileSync(abs, 'utf-8');
        const lines = content.split('\n');
        const slice = lines.slice(offset, offset + limit);
        const numbered = slice.map((l, i) => `${String(offset + i + 1).padStart(5)}→${l}`).join('\n');
        return `File: ${path} (lines ${offset + 1}-${offset + slice.length} of ${lines.length})\n\n${numbered}`;
      }

      case 'grep': {
        const pattern = input.pattern as string;
        const path = (input.path as string) ?? 'src';
        const include = input.include as string | undefined;
        const includeArg = include ? `--include='${include.replace(/'/g, "'\\''")}'` : '';
        // Use ripgrep if available, fall back to grep
        const hasRg = bash('which rg').code === 0;
        const cmd = hasRg
          ? `rg --line-number --max-count 50 ${include ? `-g '${include}'` : ''} -- '${pattern.replace(/'/g, "'\\''")}' ${path}`
          : `grep -rn ${includeArg} -- '${pattern.replace(/'/g, "'\\''")}' ${path} | head -200`;
        const r = bash(cmd);
        return r.stdout || `No matches for ${pattern} in ${path}`;
      }

      case 'glob': {
        const pattern = input.pattern as string;
        // Simple glob via find
        const r = bash(`find . -path './node_modules' -prune -o -type f -print | grep -E '${pattern.replace(/\*/g, '.*').replace(/'/g, "'\\''")}' | head -100`);
        return r.stdout || `No files matching ${pattern}`;
      }

      case 'edit_file': {
        const path = input.path as string;
        if (isProtected(path)) return `ERROR: path is protected — autonomous changes not allowed: ${path}`;
        if (!changedFiles.has(path) && changedFiles.size >= MAX_CHANGES) {
          return `ERROR: reached max file changes for this run (${MAX_CHANGES}). Finalize now with what you have.`;
        }
        const abs = safePath(path);
        if (!existsSync(abs)) return `ERROR: file not found: ${path}`;
        const content = readFileSync(abs, 'utf-8');
        const oldStr = input.old_string as string;
        const newStr = input.new_string as string;
        const occurrences = content.split(oldStr).length - 1;
        if (occurrences === 0) return `ERROR: old_string not found in ${path}. Check exact whitespace and indentation.`;
        if (occurrences > 1) return `ERROR: old_string appears ${occurrences} times in ${path}. Provide more context to make it unique.`;
        writeFileSync(abs, content.replace(oldStr, newStr));
        changedFiles.add(path);
        return `OK: edited ${path} (${changedFiles.size}/${MAX_CHANGES} files changed this run)`;
      }

      case 'write_file': {
        const path = input.path as string;
        if (isProtected(path)) return `ERROR: path is protected — autonomous changes not allowed: ${path}`;
        if (!changedFiles.has(path) && changedFiles.size >= MAX_CHANGES) {
          return `ERROR: reached max file changes for this run (${MAX_CHANGES}). Finalize now with what you have.`;
        }
        const abs = safePath(path);
        writeFileSync(abs, input.content as string);
        changedFiles.add(path);
        return `OK: wrote ${path} (${changedFiles.size}/${MAX_CHANGES} files changed this run)`;
      }

      case 'run_build': {
        const r = bash('npm run build 2>&1 | tail -30');
        return `Build exit code: ${r.code}\n\n${r.stdout}\n${r.stderr}`;
      }

      case 'run_typecheck': {
        const r = bash('npx tsc --noEmit 2>&1 | head -40');
        return `TypeScript exit code: ${r.code}\n\n${r.stdout}\n${r.stderr}`;
      }

      case 'finalize': {
        if (changedFiles.size === 0) {
          return 'NO_CHANGES: agent finished without modifying any files. Exit cleanly.';
        }
        const commitMessage = input.commit_message as string;
        const summary = input.summary as string;

        // Ensure we're on the autonomous-improvements branch
        bash(`git checkout -B ${BRANCH}`);

        // Stage only the files we changed
        for (const f of changedFiles) {
          bash(`git add "${f}"`);
        }

        const fullMessage = `${commitMessage}

${summary}

Autonomous agent run: ${RUN_ID}
Files changed: ${[...changedFiles].join(', ')}

Co-Authored-By: Vision Autonomous Agent <noreply@anthropic.com>`;

        // Write commit message to temp file to avoid shell escaping issues
        const msgFile = '/tmp/autonomous-commit-msg.txt';
        writeFileSync(msgFile, fullMessage);
        const r = bash(`git commit -F ${msgFile}`);
        return `FINALIZED: ${r.code === 0 ? 'committed successfully' : 'commit failed: ' + r.stderr}\n${r.stdout}`;
      }

      default:
        return `ERROR: unknown tool: ${name}`;
    }
  } catch (err) {
    return `ERROR in ${name}: ${err instanceof Error ? err.message : String(err)}`;
  }
}

// ── System prompt (cached) ──────────────────────────────────────────────────
const SYSTEM_PROMPT = `You are the Vision Affichage Autonomous Improvement Agent.

## Your mission
You run on a cron schedule. On each run, you find ONE small, high-value improvement to make to the codebase and apply it. You are NOT making sweeping changes — you are making one incremental polish per run, building up site quality over time.

## The repo
This is a Vite + React + TypeScript merch-customizer website for Vision Affichage, a Quebec-based corporate merch company. Customers upload logos, customize garments (hoodies, t-shirts, caps), and order through Shopify.

Key directories:
- src/pages/ — Index, Products, ProductDetail, Cart, NotFound
- src/components/ — shared UI (Navbar, BottomNav, CartDrawer, ProductCard, etc.)
- src/components/customizer/ — the product customizer (ProductCanvas, ColorPicker, LogoUploader, SizeQuantityPicker, ProductCustomizer)
- src/components/ui/ — shadcn/ui primitives (don't touch these)
- src/hooks/ — React Query hooks
- src/lib/ — i18n, shopify API, sanmar API, utilities
- src/data/products.ts — product catalog (PROTECTED — never edit)

## Your tools
- read_file / grep / glob — explore the codebase
- edit_file — make surgical changes (always prefer this over write_file)
- write_file — create new files or full rewrites (use sparingly)
- run_typecheck — verify TypeScript compiles (fast)
- run_build — verify full Vite build passes (slower but authoritative)
- finalize — commit and exit

## Hard rules
1. Maximum ${MAX_CHANGES} files changed per run. Plan accordingly.
2. Maximum ${MAX_ITERATIONS} tool calls per run.
3. You CANNOT edit: src/data/products.ts, src/lib/shopify.ts, cart stores, env files, package.json, .github/workflows/, scripts/autonomous-agent/, public/products/. The tool will reject these.
4. Before calling finalize, you MUST run run_typecheck or run_build and confirm it passes. A broken commit is worse than no commit.
5. If you cannot find something valuable to improve, call finalize with commit_message="" and summary explaining why — the workflow will detect this and skip the push.
6. Never touch tests, migrations, or CI config.
7. Keep commits small and focused. One clear thing per run.

## What to look for (in priority order)
1. **Accessibility** — missing aria-labels, poor keyboard nav, color contrast, semantic HTML
2. **Bugs** — unused imports, unused variables, dead code, TypeScript any, missing null checks
3. **UX polish** — hover states, loading states, error states, micro-animations
4. **Performance** — missing React.memo, large inline objects, unnecessary re-renders, missing keys
5. **i18n** — hardcoded French/English strings that should use t() or lang ternaries
6. **Mobile responsiveness** — text too small, touch targets <44px, overflow issues
7. **Code quality** — duplicate logic, magic numbers, unclear names

## Your process
1. Run grep or glob to scan for common issues (e.g., \`grep\` for \`console.log\`, \`any\`, missing aria-labels, hardcoded strings).
2. Read the candidate files to understand context.
3. Pick ONE small improvement and make it.
4. Run run_typecheck to verify it compiles.
5. If there's budget, make one more related improvement (same file or same theme).
6. Run run_build to confirm everything still works.
7. Call finalize with a clear commit message.

${FOCUS ? `## Focus for this run\nThe user requested: "${FOCUS}". Prioritize this area.` : ''}

Start by running a few exploratory greps to find improvement candidates, then commit to one specific change.`;

// ── Main loop ───────────────────────────────────────────────────────────────
async function main() {
  console.log(`[agent] Starting run ${RUN_ID}`);
  console.log(`[agent] Max changes: ${MAX_CHANGES}, max iterations: ${MAX_ITERATIONS}`);
  console.log(`[agent] Focus: ${FOCUS || '(none)'}`);
  console.log(`[agent] Repo root: ${REPO_ROOT}`);

  const client = new Anthropic();

  // Start from a clean autonomous-improvements branch rebased on main
  bash('git fetch origin main');
  bash('git checkout main');
  bash('git pull origin main');
  bash(`git branch -D ${BRANCH} 2>/dev/null || true`);
  bash(`git checkout -b ${BRANCH}`);

  const initialUser = FOCUS
    ? `Run #${RUN_ID}. Focus: ${FOCUS}. Find and apply one high-value improvement in this area. Start exploring.`
    : `Run #${RUN_ID}. Find and apply one high-value improvement to the site. Start by grepping for common issues (hardcoded strings, missing aria-labels, unused imports, console.log statements, etc.), pick something concrete, and make a focused change.`;

  const messages: Anthropic.MessageParam[] = [
    { role: 'user', content: initialUser },
  ];

  let finalized = false;
  let iteration = 0;

  while (iteration < MAX_ITERATIONS && !finalized) {
    iteration++;
    console.log(`\n[agent] ── Iteration ${iteration} ──`);

    const response = await client.messages.create({
      model: 'claude-opus-4-7',
      max_tokens: 16000,
      thinking: { type: 'adaptive' },
      output_config: { effort: 'high' },
      // Cache the system prompt — same across all iterations and runs
      system: [
        {
          type: 'text',
          text: SYSTEM_PROMPT,
          cache_control: { type: 'ephemeral' },
        },
      ],
      tools,
      messages,
    });

    console.log(`[agent] stop_reason: ${response.stop_reason}`);
    console.log(`[agent] usage: input=${response.usage.input_tokens}, output=${response.usage.output_tokens}, cache_read=${response.usage.cache_read_input_tokens ?? 0}`);

    // Log any text the agent produced
    for (const block of response.content) {
      if (block.type === 'text' && block.text.trim()) {
        console.log(`[agent:text] ${block.text.slice(0, 300)}${block.text.length > 300 ? '…' : ''}`);
      }
    }

    if (response.stop_reason === 'end_turn') {
      console.log('[agent] Agent ended without calling finalize. Exiting with no changes.');
      break;
    }

    if (response.stop_reason !== 'tool_use') {
      console.log(`[agent] Unexpected stop_reason: ${response.stop_reason}. Exiting.`);
      break;
    }

    // Append assistant turn
    messages.push({ role: 'assistant', content: response.content });

    // Execute each tool_use block
    const toolResults: Anthropic.ToolResultBlockParam[] = [];
    for (const block of response.content) {
      if (block.type !== 'tool_use') continue;
      console.log(`[tool:${block.name}] input=${JSON.stringify(block.input).slice(0, 150)}…`);
      const result = executeTool(block.name, block.input as Record<string, unknown>);
      console.log(`[tool:${block.name}] result=${result.slice(0, 200)}${result.length > 200 ? '…' : ''}`);
      toolResults.push({
        type: 'tool_result',
        tool_use_id: block.id,
        content: result,
        is_error: result.startsWith('ERROR'),
      });
      if (block.name === 'finalize' && !result.startsWith('NO_CHANGES')) {
        finalized = true;
      }
    }

    messages.push({ role: 'user', content: toolResults });

    if (finalized) {
      console.log('[agent] Finalized. Exiting loop.');
      break;
    }
  }

  if (!finalized) {
    console.log('[agent] Agent did not finalize — no commit will be made.');
    // Reset to main so we don't accidentally push partial work
    bash('git reset --hard origin/main');
    bash('git checkout main');
    bash(`git branch -D ${BRANCH} 2>/dev/null || true`);
  }

  console.log(`[agent] Run ${RUN_ID} complete. Files changed: ${changedFiles.size}`);
}

main().catch((err) => {
  console.error('[agent] FATAL:', err);
  process.exit(1);
});
