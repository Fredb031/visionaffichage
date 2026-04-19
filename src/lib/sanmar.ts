/**
 * sanmar.ts — Client for the SanMar Canada PromoStandards API
 *
 * The browser cannot call SanMar directly (CORS + secret credentials), so all
 * traffic flows through the Supabase Edge Function `sanmar-product`. Set up:
 *
 *   1. supabase login
 *   2. supabase functions deploy sanmar-product
 *   3. supabase secrets set \
 *        SANMAR_CUSTOMER_ID=xxx \
 *        SANMAR_PASSWORD=you@email.com \
 *        SANMAR_MEDIA_PASSWORD=xxx
 *
 * Until the function is deployed, every call returns null and logs a warning —
 * the rest of the site keeps working with the local product data.
 */

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined;

const EDGE_URL = SUPABASE_URL ? `${SUPABASE_URL}/functions/v1/sanmar-product` : null;

export interface SanmarInventoryPart {
  partId: string | null;
  partColor: string | null;
  labelSize: string | null;
  totalQty: number;
  locations: Array<{ id: string | null; name: string | null; qty: number }>;
}

export interface SanmarProduct {
  productName: string | null;
  description: string | null;
  productBrand: string | null;
  category: string | null;
  colors: string[];
  sizes: string[];
  parts: Array<{ partId: string | null; color: string | null; size: string | null }>;
}

export interface SanmarMedia {
  urls: string[];
  description: string;
}

export interface SanmarPricingRow {
  partId: string | null;
  minQty: number;
  price: number;
}

type Action = 'product' | 'inventory' | 'media' | 'pricing';

// Hard timeout so a hung SanMar edge function doesn't leave the
// React Query inflight state stuck forever. 8s is well above the
// p99 ~1.5s inventory round-trip.
const SANMAR_TIMEOUT_MS = 8_000;

async function call<T>(action: Action, productId: string, partId?: string, lang: 'en' | 'fr' = 'en'): Promise<T | null> {
  if (!EDGE_URL || !SUPABASE_KEY) {
    console.warn('[sanmar] Supabase not configured — skipping', action);
    return null;
  }
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), SANMAR_TIMEOUT_MS);
  try {
    const res = await fetch(EDGE_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
      },
      body: JSON.stringify({ action, productId, partId, lang }),
      signal: controller.signal,
    });
    const json = await res.json();
    if (!res.ok || !json.ok) {
      console.warn('[sanmar]', action, 'failed:', json.error || json.hint);
      return null;
    }
    return json.data as T;
  } catch (err) {
    if ((err as Error)?.name === 'AbortError') {
      console.warn('[sanmar]', action, `timed out after ${SANMAR_TIMEOUT_MS}ms`);
    } else {
      console.warn('[sanmar]', action, 'error:', err);
    }
    return null;
  } finally {
    clearTimeout(timeoutId);
  }
}

export const sanmar = {
  getProduct:   (productId: string, lang?: 'en' | 'fr') => call<SanmarProduct>('product', productId, undefined, lang),
  getInventory: (productId: string) => call<SanmarInventoryPart[]>('inventory', productId),
  getMedia:     (productId: string, lang?: 'en' | 'fr') => call<SanmarMedia>('media', productId, undefined, lang),
  getPricing:   (productId: string) => call<SanmarPricingRow[]>('pricing', productId),
};

// ── Aggregate helpers ──────────────────────────────────────────────────────

export interface StockSummary {
  totalAvailable: number;
  byColor: Map<string, number>;
  bySize: Map<string, number>;
  byColorSize: Map<string, number>; // key = `${color}|${size}`
}

export function summarizeStock(parts: SanmarInventoryPart[] | null): StockSummary {
  const byColor = new Map<string, number>();
  const bySize = new Map<string, number>();
  const byColorSize = new Map<string, number>();
  let totalAvailable = 0;

  // Accept only real arrays. The edge function could theoretically
  // return an error object or null while TypeScript still narrows to
  // SanmarInventoryPart[], and iterating a non-iterable throws.
  if (!Array.isArray(parts)) return { totalAvailable, byColor, bySize, byColorSize };

  for (const p of parts) {
    if (!p || typeof p !== 'object') continue;
    // SanMar's SOAP-to-REST gateway has been known to return null /
    // undefined for totalQty on discontinued parts. Coerce to 0 so a
    // single bad row doesn't turn the whole summary into NaN and
    // render as "NaN en stock" on the PDP stock badge.
    const qty = Number.isFinite(p.totalQty) ? p.totalQty : 0;
    totalAvailable += qty;
    // Only string keys land in the Maps — a numeric partColor (has
    // happened in test data) would be truthy and pollute the map
    // with a number-keyed entry that doesn't match any UI lookup.
    if (typeof p.partColor === 'string' && p.partColor) {
      byColor.set(p.partColor, (byColor.get(p.partColor) ?? 0) + qty);
    }
    if (typeof p.labelSize === 'string' && p.labelSize) {
      bySize.set(p.labelSize, (bySize.get(p.labelSize) ?? 0) + qty);
    }
    if (typeof p.partColor === 'string' && p.partColor && typeof p.labelSize === 'string' && p.labelSize) {
      const key = `${p.partColor}|${p.labelSize}`;
      byColorSize.set(key, (byColorSize.get(key) ?? 0) + qty);
    }
  }

  return { totalAvailable, byColor, bySize, byColorSize };
}
