/**
 * Loyalty service — Mega Blueprint Section 15.
 *
 * localStorage-backed shim of what will eventually be a Supabase
 * `loyalty_accounts` + `loyalty_transactions` pair (Section 15.1).
 * This lets the customer-facing dashboard card render correct
 * values end-to-end before the server schema lands; switching to
 * Supabase is a drop-in once the operator follow-up tickets ship.
 *
 * Earn-on-purchase trigger is intentionally NOT wired here — that
 * needs a server-side Shopify-orders webhook (Section 15 follow-up).
 * For now, awardPoints() is invokable from any client surface (admin
 * tools, manual adjustments, future webhook proxy), and the rest of
 * the UI just reads via getLoyalty().
 */

export type LoyaltyTier = 'bronze' | 'silver' | 'gold';

export interface LoyaltyAccount {
  points: number;
  lifetime: number;
  tier: LoyaltyTier;
}

export interface LoyaltyTransaction {
  type: 'earn' | 'redeem';
  points: number;
  reason: string;
  at: string;
}

const KEY = 'va:loyalty';
const TX_KEY = 'va:loyalty:transactions';
const TX_MAX = 100;

/**
 * Tier thresholds — frozen lookup table mirroring the pricing.ts /
 * tax.ts / permissions.ts pattern so a stray import-time mutation
 * can't silently rewrite the loyalty ladder. Ordered highest-first
 * so tierOf() can short-circuit on the first match. Boundaries are
 * inclusive on the lower edge: `lifetime` exactly at a threshold
 * belongs to the upper tier (e.g. 1000 -> silver, 5000 -> gold).
 */
const TIER_THRESHOLDS: ReadonlyArray<Readonly<{ tier: LoyaltyTier; min: number }>> = Object.freeze([
  Object.freeze({ tier: 'gold' as const, min: 5000 }),
  Object.freeze({ tier: 'silver' as const, min: 1000 }),
  Object.freeze({ tier: 'bronze' as const, min: 0 }),
]);

const DEFAULT: Readonly<LoyaltyAccount> = Object.freeze({ points: 0, lifetime: 0, tier: 'bronze' });

/** Bronze 0-999, Silver 1000-4999, Gold 5000+. */
export function tierOf(lifetime: number): LoyaltyTier {
  // Guard against NaN/-Infinity slipping through from corrupted storage —
  // table walk would otherwise return 'bronze' for NaN by accident, but
  // being explicit makes the contract auditable.
  const safe = Number.isFinite(lifetime) && lifetime > 0 ? lifetime : 0;
  for (const row of TIER_THRESHOLDS) {
    if (safe >= row.min) return row.tier;
  }
  return 'bronze';
}

function readAccount(): LoyaltyAccount {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { ...DEFAULT };
    const parsed = JSON.parse(raw) as Partial<LoyaltyAccount>;
    // Number.isFinite rejects NaN AND ±Infinity. The bare `>= 0` guard
    // accepted Infinity (since `Infinity >= 0` is true and typeof is
    // 'number'), which would render as "Infinity pts" in LoyaltyCard
    // and then poison every subsequent awardPoints since
    // `Infinity + amount` stays Infinity. Force a finite bound here so
    // a corrupted blob falls back to 0 instead of locking the account
    // into an unfixable infinite balance.
    const points = typeof parsed.points === 'number' && Number.isFinite(parsed.points) && parsed.points >= 0 ? parsed.points : 0;
    const lifetime = typeof parsed.lifetime === 'number' && Number.isFinite(parsed.lifetime) && parsed.lifetime >= 0 ? parsed.lifetime : 0;
    // Tier is derived from lifetime; never trust a stale value on disk.
    return { points, lifetime, tier: tierOf(lifetime) };
  } catch {
    // silent
    return { ...DEFAULT };
  }
}

function writeAccount(account: LoyaltyAccount): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(account));
  } catch {
    // silent
  }
}

function pushTransaction(tx: LoyaltyTransaction): void {
  try {
    const raw = localStorage.getItem(TX_KEY);
    const existing: LoyaltyTransaction[] = raw ? JSON.parse(raw) : [];
    const list = Array.isArray(existing) ? existing : [];
    // FIFO 100 — newest first, drop the oldest tail past the cap so a
    // long-tenured visitor doesn't blow past the localStorage quota.
    const next = [tx, ...list].slice(0, TX_MAX);
    localStorage.setItem(TX_KEY, JSON.stringify(next));
  } catch {
    // silent
  }
}

export function getLoyalty(): LoyaltyAccount {
  return readAccount();
}

export function awardPoints(n: number, reason: string): LoyaltyAccount {
  if (!Number.isFinite(n) || n <= 0) return readAccount();
  // Points are whole units; floor any float input to avoid IEEE-754 drift
  // accumulating in the balance over many awards.
  const amount = Math.floor(n);
  if (amount <= 0) return readAccount();
  const current = readAccount();
  const points = current.points + amount;
  const lifetime = current.lifetime + amount;
  const next: LoyaltyAccount = { points, lifetime, tier: tierOf(lifetime) };
  writeAccount(next);
  pushTransaction({ type: 'earn', points: amount, reason, at: new Date().toISOString() });
  return next;
}

export function redeemPoints(n: number): LoyaltyAccount | null {
  if (!Number.isFinite(n) || n <= 0) return null;
  const amount = Math.floor(n);
  if (amount <= 0) return null;
  const current = readAccount();
  if (current.points < amount) return null;
  const next: LoyaltyAccount = {
    points: current.points - amount,
    lifetime: current.lifetime, // lifetime never decreases
    tier: tierOf(current.lifetime),
  };
  writeAccount(next);
  pushTransaction({ type: 'redeem', points: amount, reason: 'redeem', at: new Date().toISOString() });
  return next;
}
