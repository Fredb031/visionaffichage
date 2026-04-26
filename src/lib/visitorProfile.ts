// Vision Affichage Volume II §06 — visitor profile.
//
// Progressive personalization signal store. Every PDP view, search,
// cart action and UTM landing nudges this profile so downstream
// surfaces (homepage hero copy, returning-visitor banner, AI chat
// context, recommendation engine) can tailor the experience without
// a server round-trip. Persisted to localStorage under
// `va_visitor_profile`; read+write paths are wrapped in try/catch via
// readLS / writeLS so a quota or private-mode failure never escapes
// into a render boundary.
//
// Shape is fixed by Volume II §6.1 — DO NOT add fields silently. Any
// new signal needs a §6 amendment first so the personalization
// engine, the AI knowledge base, and the analytics dashboard agree
// on the schema.

import { readLS, writeLS } from './storage';

export interface VisitorProfile {
  industry?: 'construction' | 'paysagement' | 'corporate' | 'autre';
  visitedCategories: string[];
  searchHistory: string[];
  viewedProducts: string[];
  cartHistory: string[];
  lastOrderCategory?: string;
  language: 'fr' | 'en';
  device: 'mobile' | 'desktop';
  sessionCount: number;
  firstVisit: string;
  utmSource?: string;
  utmIndustry?: string;
  lastViewedProduct?: string;
  lastViewedHref?: string;
}

const STORAGE_KEY = 'va_visitor_profile';

// Cap each list at 50 entries — anything older falls off the back.
// 50 is generous enough for an active session's signal trail while
// keeping the localStorage payload small (a quota-exceeded write
// would silently no-op via writeLS, so a corrupted entry is the
// realistic failure mode, not a missing one).
const LIST_CAP = 50;

const ARRAY_KEYS: ReadonlyArray<keyof VisitorProfile> = [
  'visitedCategories',
  'searchHistory',
  'viewedProducts',
  'cartHistory',
];

function detectDevice(): 'mobile' | 'desktop' {
  if (typeof window === 'undefined') return 'desktop';
  // Coarse pointer or narrow viewport ⇒ mobile. matchMedia is
  // available in every browser we ship to; the typeof guard above
  // already handled SSR.
  try {
    if (window.matchMedia('(max-width: 767px)').matches) return 'mobile';
    if (window.matchMedia('(pointer: coarse)').matches) return 'mobile';
  } catch {
    /* matchMedia threw on a malformed query — fall through to desktop */
  }
  return 'desktop';
}

function defaults(): VisitorProfile {
  return {
    visitedCategories: [],
    searchHistory: [],
    viewedProducts: [],
    cartHistory: [],
    language: 'fr',
    device: detectDevice(),
    sessionCount: 0,
    firstVisit: '',
  };
}

// Coerce whatever was on disk back into the expected shape. A blob
// authored by an older build (missing fields), a devtools edit, or a
// half-written entry from a crash mid-setItem can all yield a partial
// or malformed object — readLS already recovers from a JSON.parse
// throw, but a successful parse can still hand us nonsense. Walk every
// field and substitute the default when the value isn't the expected
// type so the rest of the app sees a well-typed profile.
function coerce(raw: Partial<VisitorProfile> | null | undefined): VisitorProfile {
  const base = defaults();
  if (!raw || typeof raw !== 'object') return base;
  const out: VisitorProfile = { ...base };
  for (const key of ARRAY_KEYS) {
    const v = (raw as Record<string, unknown>)[key];
    if (Array.isArray(v)) {
      // Filter to strings + cap; a stray non-string would otherwise
      // throw later when the UI joins / renders the list.
      const list = v.filter((x): x is string => typeof x === 'string');
      (out[key] as unknown as string[]) = list.slice(-LIST_CAP);
    }
  }
  if (raw.industry === 'construction' || raw.industry === 'paysagement' || raw.industry === 'corporate' || raw.industry === 'autre') {
    out.industry = raw.industry;
  }
  if (raw.language === 'en' || raw.language === 'fr') out.language = raw.language;
  if (raw.device === 'mobile' || raw.device === 'desktop') out.device = raw.device;
  if (typeof raw.sessionCount === 'number' && Number.isFinite(raw.sessionCount) && raw.sessionCount >= 0) {
    out.sessionCount = Math.floor(raw.sessionCount);
  }
  if (typeof raw.firstVisit === 'string') out.firstVisit = raw.firstVisit;
  if (typeof raw.utmSource === 'string') out.utmSource = raw.utmSource;
  if (typeof raw.utmIndustry === 'string') out.utmIndustry = raw.utmIndustry;
  if (typeof raw.lastOrderCategory === 'string') out.lastOrderCategory = raw.lastOrderCategory;
  if (typeof raw.lastViewedProduct === 'string') out.lastViewedProduct = raw.lastViewedProduct;
  if (typeof raw.lastViewedHref === 'string') out.lastViewedHref = raw.lastViewedHref;
  return out;
}

/**
 * Read the persisted profile (with defaults). Always returns a
 * well-typed object — corrupted / missing storage falls through to
 * the default shape rather than throwing into a render boundary.
 */
export function getProfile(): VisitorProfile {
  const raw = readLS<Partial<VisitorProfile> | null>(STORAGE_KEY, null);
  return coerce(raw);
}

/**
 * Merge `patch` into the persisted profile and write back. Array
 * fields (visitedCategories, searchHistory, viewedProducts,
 * cartHistory) are deduped and capped at 50 entries — most recent
 * wins. Non-array fields are last-write-wins. Returns the merged
 * profile so callers can read the post-merge state without an extra
 * getProfile() round-trip.
 */
export function updateProfile(patch: Partial<VisitorProfile>): VisitorProfile {
  const current = getProfile();
  const next: VisitorProfile = { ...current };
  for (const rawKey of Object.keys(patch) as Array<keyof VisitorProfile>) {
    const value = patch[rawKey];
    if (value === undefined) continue;
    if ((ARRAY_KEYS as ReadonlyArray<keyof VisitorProfile>).includes(rawKey)) {
      // Treat the patch as an append set — the caller passes a new
      // list (typically [...prev, item]) and we dedupe + cap. Keeping
      // the dedupe order "most recent at the end" matches how the
      // returning-visitor banner uses lastViewedProduct semantics.
      const incoming = Array.isArray(value) ? (value as string[]) : [];
      const seen = new Set<string>();
      const merged: string[] = [];
      for (const item of incoming) {
        if (typeof item !== 'string' || !item) continue;
        if (seen.has(item)) continue;
        seen.add(item);
        merged.push(item);
      }
      // Cap from the end — recent entries win when the list overflows.
      const capped = merged.slice(-LIST_CAP);
      (next[rawKey] as unknown as string[]) = capped;
    } else {
      // Non-array scalar: last-write-wins.
      (next as Record<string, unknown>)[rawKey] = value as unknown;
    }
  }
  writeLS(STORAGE_KEY, next);
  return next;
}

/**
 * Infer industry from the accumulated signal trail. Volume II §6.1:
 *   - utmIndustry takes priority (Meta Ads landing already told us).
 *   - 2+ casquette views → construction.
 *   - polo views → corporate.
 *   - default → general (returned as 'autre').
 * Pure function; does not write back. Caller decides whether to
 * persist (e.g. updateProfile({ industry: inferred })).
 */
export function inferIndustry(profile: VisitorProfile): VisitorProfile['industry'] {
  const utm = profile.utmIndustry?.toLowerCase().trim();
  if (utm === 'construction' || utm === 'paysagement' || utm === 'corporate' || utm === 'autre') {
    return utm;
  }
  // Map common UTM aliases used in Meta Ads creatives to the four
  // canonical buckets — keeps the priority rule meaningful even when
  // the creative used a near-synonym.
  if (utm === 'paysage' || utm === 'landscape' || utm === 'landscaping') return 'paysagement';
  if (utm === 'corp' || utm === 'b2b' || utm === 'office') return 'corporate';
  if (utm === 'construction-site' || utm === 'chantier') return 'construction';

  const visited = profile.visitedCategories ?? [];
  const casquetteViews = visited.filter(c => /casquette/i.test(c)).length;
  if (casquetteViews >= 2) return 'construction';
  const poloViews = visited.filter(c => /polo/i.test(c)).length;
  if (poloViews >= 1) return 'corporate';
  return 'autre';
}

/**
 * Increment sessionCount and stamp firstVisit if missing. Call once
 * per app mount (useVisitorTracking does this from App.tsx). Idempotent
 * across remounts within the same session in the sense that we don't
 * have a "session" concept beyond "the SPA mounted" — every full page
 * load counts as a session, which matches how GA4 / Meta Pixel define
 * the term for an SPA.
 */
export function bumpSession(): VisitorProfile {
  const current = getProfile();
  const patch: Partial<VisitorProfile> = {
    sessionCount: (current.sessionCount ?? 0) + 1,
  };
  if (!current.firstVisit) {
    patch.firstVisit = new Date().toISOString();
  }
  // Also refresh device — a desktop visitor who returns on mobile
  // should personalize off the current form factor, not the original.
  patch.device = detectDevice();
  return updateProfile(patch);
}
