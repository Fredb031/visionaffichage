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

const DEFAULT: LoyaltyAccount = { points: 0, lifetime: 0, tier: 'bronze' };

/** Bronze 0-999, Silver 1000-4999, Gold 5000+. */
export function tierOf(lifetime: number): LoyaltyTier {
  if (lifetime >= 5000) return 'gold';
  if (lifetime >= 1000) return 'silver';
  return 'bronze';
}

function readAccount(): LoyaltyAccount {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { ...DEFAULT };
    const parsed = JSON.parse(raw) as Partial<LoyaltyAccount>;
    const points = typeof parsed.points === 'number' && parsed.points >= 0 ? parsed.points : 0;
    const lifetime = typeof parsed.lifetime === 'number' && parsed.lifetime >= 0 ? parsed.lifetime : 0;
    // Tier is derived from lifetime; never trust a stale value on disk.
    return { points, lifetime, tier: tierOf(lifetime) };
  } catch (e) {
    console.warn('[loyalty] Could not read account:', e);
    return { ...DEFAULT };
  }
}

function writeAccount(account: LoyaltyAccount): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(account));
  } catch (e) {
    console.warn('[loyalty] Could not persist account:', e);
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
  } catch (e) {
    console.warn('[loyalty] Could not persist transaction:', e);
  }
}

export function getLoyalty(): LoyaltyAccount {
  return readAccount();
}

export function awardPoints(n: number, reason: string): LoyaltyAccount {
  if (!Number.isFinite(n) || n <= 0) return readAccount();
  const current = readAccount();
  const points = current.points + n;
  const lifetime = current.lifetime + n;
  const next: LoyaltyAccount = { points, lifetime, tier: tierOf(lifetime) };
  writeAccount(next);
  pushTransaction({ type: 'earn', points: n, reason, at: new Date().toISOString() });
  return next;
}

export function redeemPoints(n: number): LoyaltyAccount | null {
  if (!Number.isFinite(n) || n <= 0) return null;
  const current = readAccount();
  if (current.points < n) return null;
  const next: LoyaltyAccount = {
    points: current.points - n,
    lifetime: current.lifetime, // lifetime never decreases
    tier: tierOf(current.lifetime),
  };
  writeAccount(next);
  pushTransaction({ type: 'redeem', points: n, reason: 'redeem', at: new Date().toISOString() });
  return next;
}
