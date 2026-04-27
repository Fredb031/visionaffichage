import { useEffect, useState } from 'react';
import { Eye } from 'lucide-react';
import { useLang } from '@/lib/langContext';

// ──────────────────────────────────────────────────────────────────────
// Small social-proof ticker that sits under the PDP Personnaliser CTA:
//   "3 personnes consultent ce produit en ce moment".
//
// Intentionally dumb — there is no live viewer-count back end and we
// don't want one on a B2B merch site (the real traffic shape would
// read as "0 viewers" most of the day, which is the opposite of the
// nudge we want). Instead we pick a pseudo-random 2–6 once per
// product-handle per browser session and stash it in sessionStorage
// so that:
//   • refreshes + in-session tab switches keep the SAME number
//     (the number wiggling on every render would scream "fake")
//   • a fresh tab / new session picks a fresh number
//   • switching between products in the same session gives each
//     product its own stable value
//
// No analytics ping on mount — this is pure UX polish, and we avoid
// the consent-banner blast radius of wiring up another event.
// Never rendered when the variant is sold out; a viewer count on a
// greyed-out button actively hurts trust.
// ──────────────────────────────────────────────────────────────────────

const VIEWERS_MIN = 2;
const VIEWERS_MAX = 6;
const STORAGE_PREFIX = 'vision-pdp-viewers:';

function pickViewerCount(): number {
  // Skew slightly toward the middle so 2 and 6 aren't over-represented
  // vs the integers in between — a simple average of two dice-style
  // rolls is plenty without pulling in a stats helper.
  const range = VIEWERS_MAX - VIEWERS_MIN + 1;
  const a = Math.floor(Math.random() * range);
  const b = Math.floor(Math.random() * range);
  return VIEWERS_MIN + Math.floor((a + b) / 2);
}

function readSessionViewers(handle: string): number | null {
  try {
    if (typeof sessionStorage === 'undefined') return null;
    const raw = sessionStorage.getItem(`${STORAGE_PREFIX}${handle}`);
    if (!raw) return null;
    const n = Number.parseInt(raw, 10);
    if (!Number.isFinite(n)) return null;
    if (n < VIEWERS_MIN || n > VIEWERS_MAX) return null;
    return n;
  } catch {
    return null;
  }
}

function writeSessionViewers(handle: string, count: number): void {
  try {
    if (typeof sessionStorage === 'undefined') return;
    sessionStorage.setItem(`${STORAGE_PREFIX}${handle}`, String(count));
  } catch {
    /* private-mode Safari / quota — silently skip, next mount re-picks */
  }
}

export interface ProductViewersNudgeProps {
  /** Shopify product handle — used as the sessionStorage key so each
   * product gets its own stable count. When undefined (loading state)
   * the component renders nothing to avoid flashing a number that
   * will immediately be overwritten. */
  handle: string | undefined;
  /** When false (variant sold out / totalInventory === 0) the nudge
   * is hidden entirely. */
  inStock: boolean;
  className?: string;
}

function resolveViewers(handle: string | undefined): number | null {
  if (!handle) return null;
  const stored = readSessionViewers(handle);
  if (stored !== null) return stored;
  const picked = pickViewerCount();
  writeSessionViewers(handle, picked);
  return picked;
}

export function ProductViewersNudge({ handle, inStock, className = '' }: ProductViewersNudgeProps) {
  const { lang } = useLang();
  // Lazy initializer resolves the count synchronously on first render so
  // the badge appears in the same paint as the rest of the PDP CTA stack
  // — without it we'd flash a layout-shifting empty slot for one frame
  // between mount and the post-effect setState. Vite is CSR-only here,
  // so reading sessionStorage during initial render is safe.
  const [viewers, setViewers] = useState<number | null>(() => resolveViewers(handle));

  // On handle change (navigating from product A to product B in the same
  // session), re-resolve so B's stored value wins or B gets its own fresh
  // pick. The lazy init above has already covered the first-mount case.
  useEffect(() => {
    setViewers(resolveViewers(handle));
  }, [handle]);

  if (!inStock) return null;
  if (!handle) return null;
  if (viewers === null) return null;

  const label = lang === 'en'
    ? `${viewers} people are viewing this product right now`
    : `${viewers} personnes consultent ce produit en ce moment`;

  // Intentionally NOT a live region: the count is pseudo-random UX polish,
  // not real-time data, so announcing it (or its silent updates on product
  // navigation) would be misleading to assistive-tech users. role="status"
  // implies aria-live="polite", so we omit both and surface a plain label
  // via aria-label on the wrapper.
  return (
    <div
      className={`flex items-center justify-center gap-1.5 text-[11px] font-medium text-muted-foreground ${className}`}
      aria-label={label}
    >
      <span className="relative flex h-2 w-2" aria-hidden="true">
        <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75 motion-safe:animate-ping" />
        <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
      </span>
      <Eye size={12} aria-hidden="true" className="opacity-70" />
      <span aria-hidden="true">{label}</span>
    </div>
  );
}
