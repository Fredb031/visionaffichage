// Saved-designs persistence — Mega Blueprint Section 06.
//
// The customizer can hand a snapshot to saveDesign() and the customer
// dashboard reads them back via listSavedDesigns(). Storage is
// localStorage today; the brief's Section 6.1 schema points at a
// Supabase `saved_designs` table that should replace the local key
// once auth-scoped rows are in place. Until then the in-browser store
// is the source of truth, which is fine for the "save your draft and
// reorder later" flow on a single device.
//
// All disk I/O is wrapped in try/catch:
//   - private-mode Safari throws on getItem / setItem
//   - a partially-written entry from a crashed tab parses as garbage
//   - quota-exceeded fires when the canvas preview balloons past
//     localStorage's ~5MB origin budget
// On any failure we degrade to "no saved designs" rather than crash a
// render. listSavedDesigns also revalidates each row's shape so a
// hand-edited entry from devtools can't poison the dashboard grid.
//
// Cap: 50 entries with FIFO eviction. The oldest createdAt loses when
// a 51st save lands. We also trim canvasPreviewDataUrl over ~1MB so a
// single huge preview can't single-handedly exhaust the quota.

import { readLS, writeLS } from './storage';

export interface SavedDesign {
  id: string;
  name: string;
  productSku: string;
  colorId: string | null;
  logoUrl: string | null;
  placement: {
    x: number;
    y: number;
    width: number;
    rotation: number;
    zone: string;
  } | null;
  sizeQty: Record<string, number>;
  canvasPreviewDataUrl: string | null;
  createdAt: number;
}

const KEY = 'va:saved-designs';
const MAX = 50;
// 1MB cap on the base64 preview before we drop it. The string is
// roughly 1.37x the encoded byte count, but the comparison runs
// against the .length so we use a flat character budget — close
// enough for "stop a 4MB PNG from blowing the quota".
const PREVIEW_MAX_CHARS = 1_000_000;

// Type guard for the placement shape. Defensive against a truncated
// blob where `placement` exists but is missing a numeric field.
function isPlacement(v: unknown): v is SavedDesign['placement'] {
  if (v === null) return true;
  if (!v || typeof v !== 'object') return false;
  const p = v as Record<string, unknown>;
  return (
    typeof p.x === 'number' &&
    typeof p.y === 'number' &&
    typeof p.width === 'number' &&
    typeof p.rotation === 'number' &&
    typeof p.zone === 'string'
  );
}

function isSizeQty(v: unknown): v is Record<string, number> {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return false;
  for (const val of Object.values(v as Record<string, unknown>)) {
    if (typeof val !== 'number' || !Number.isFinite(val)) return false;
  }
  return true;
}

function isSavedDesign(v: unknown): v is SavedDesign {
  if (!v || typeof v !== 'object') return false;
  const d = v as Record<string, unknown>;
  return (
    typeof d.id === 'string' &&
    typeof d.name === 'string' &&
    typeof d.productSku === 'string' &&
    (d.colorId === null || typeof d.colorId === 'string') &&
    (d.logoUrl === null || typeof d.logoUrl === 'string') &&
    isPlacement(d.placement) &&
    isSizeQty(d.sizeQty) &&
    (d.canvasPreviewDataUrl === null || typeof d.canvasPreviewDataUrl === 'string') &&
    typeof d.createdAt === 'number'
  );
}

function readAll(): SavedDesign[] {
  // readLS already swallows JSON parse errors. The Array.isArray guard
  // covers the legitimate-but-stale case where a previous build wrote
  // the key as an object envelope instead of a bare array.
  const raw = readLS<unknown>(KEY, []);
  if (!Array.isArray(raw)) return [];
  // Strip any row that fails the shape check rather than throwing —
  // one bad entry shouldn't hide the other 49 from the dashboard.
  return raw.filter(isSavedDesign);
}

function writeAll(list: SavedDesign[]): void {
  // writeLS swallows quota errors. Best-effort persistence is the
  // right call here — the in-memory state surfaces back via the
  // returned object and the next save will retry the whole array.
  writeLS(KEY, list);
}

/** Read and return the saved-designs list, newest first. */
export function listSavedDesigns(): SavedDesign[] {
  // Sort descending by createdAt so the dashboard renders newest-up
  // without each caller doing it themselves.
  return readAll().sort((a, b) => b.createdAt - a.createdAt);
}

/**
 * Persist a new design. Returns the materialized SavedDesign so the
 * caller (typically the customizer's save button) can show a toast
 * with the assigned id or wire it into a "view in dashboard" link.
 */
export function saveDesign(
  design: Omit<SavedDesign, 'id' | 'createdAt'>,
): SavedDesign {
  // Trim an oversized preview rather than refusing to save. A saved
  // design without a thumbnail still works — the dashboard tile falls
  // back to a placeholder — whereas refusing the whole save loses the
  // customer's work.
  let preview = design.canvasPreviewDataUrl;
  if (preview && preview.length > PREVIEW_MAX_CHARS) {
    preview = null;
  }

  const entry: SavedDesign = {
    ...design,
    canvasPreviewDataUrl: preview,
    id:
      typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
        ? crypto.randomUUID()
        : `va-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
    createdAt: Date.now(),
  };

  const current = readAll();
  // FIFO eviction: keep the newest MAX-1 plus the new entry. Sort
  // descending first so the slice() drops the oldest rather than
  // whichever order the storage happened to return.
  const next = [entry, ...current]
    .sort((a, b) => b.createdAt - a.createdAt)
    .slice(0, MAX);

  writeAll(next);
  return entry;
}

/** Remove a saved design by id. No-op if the id isn't present. */
export function deleteSavedDesign(id: string): void {
  const current = readAll();
  const next = current.filter((d) => d.id !== id);
  // Skip the write if nothing changed — saves a needless localStorage
  // round-trip and avoids touching quota for a missing-id call.
  if (next.length === current.length) return;
  writeAll(next);
}

/** Look up a single saved design by id, or null if absent / corrupt. */
export function getSavedDesign(id: string): SavedDesign | null {
  return readAll().find((d) => d.id === id) ?? null;
}
