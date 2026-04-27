// Order tracking helper — Mega Blueprint Section 16.
//
// Exposes getOrderStatus(orderNumber) backed by a localStorage
// `va:orders` array. This is a stub data source that lets the
// /suivi/:orderNumber page light up before Shopify webhook sync is
// wired. The real flow (TODO, operator follow-up):
//   - Shopify webhook posts fulfillment_create / fulfillment_update
//   - backend persists stage + tracking + ETA to a customers table
//   - this helper switches to a fetch() against that endpoint
//
// Until then, the operator can seed orders by setting
// localStorage.setItem('va:orders', JSON.stringify([...])) — useful
// for support, demos, and end-to-end QA of the stepper UI without
// a live Shopify order in hand.
//
// Disk I/O is wrapped via readLS so a corrupted blob (older build,
// devtools edit, partial write from a crashed tab) returns null
// rather than throwing during the page render.

import { readLS } from './storage';

/** 4 stages from the brief's Section 16.1 stepper. */
export type OrderStage = 'received' | 'production' | 'shipped' | 'delivered';

export interface TrackedOrderItem {
  /** Product display name shown in the order summary card. */
  name: string;
  /** Total quantity across all sizes. */
  qty: number;
  /** Free-form size breakdown ("S×2, M×4, L×1") for the summary line. */
  sizes?: string;
}

export interface TrackedOrder {
  /** Order number the customer types into the lookup form (no leading #). */
  orderNumber: string;
  /** Current stage. Drives the stepper's completed/current/future split. */
  stage: OrderStage;
  /** Carrier tracking number — null until the shipment leaves the shop. */
  trackingNumber: string | null;
  /** ISO date string for the estimated delivery. */
  eta: string | null;
  /** Items shown in the order summary card. */
  items: TrackedOrderItem[];
}

const LS_KEY = 'va:orders';

/**
 * Look up an order by its order number against the localStorage
 * `va:orders` mock. Returns null when the key is unset, the parsed
 * payload is malformed, or no row matches. Matching is case-insensitive
 * and tolerates a leading "#" so a customer pasting "#1570" from a
 * receipt resolves the same as "1570".
 */
export function getOrderStatus(orderNumber: string): TrackedOrder | null {
  if (!orderNumber) return null;
  const needle = orderNumber.trim().toLowerCase().replace(/^#/, '');
  if (!needle) return null;

  const raw = readLS<unknown>(LS_KEY, null);
  if (!Array.isArray(raw)) return null;

  for (const row of raw) {
    if (!row || typeof row !== 'object') continue;
    const r = row as Record<string, unknown>;
    const num = typeof r.orderNumber === 'string' ? r.orderNumber : '';
    if (num.trim().toLowerCase().replace(/^#/, '') !== needle) continue;

    const stage = r.stage;
    if (
      stage !== 'received' &&
      stage !== 'production' &&
      stage !== 'shipped' &&
      stage !== 'delivered'
    ) continue;

    const items: TrackedOrderItem[] = Array.isArray(r.items)
      ? (r.items as unknown[]).flatMap(it => {
          if (!it || typeof it !== 'object') return [];
          const i = it as Record<string, unknown>;
          if (typeof i.name !== 'string' || typeof i.qty !== 'number') return [];
          // Reject NaN / Infinity / negatives / non-integer qty — a corrupted
          // localStorage blob (devtools edit, half-written tab) shouldn't render
          // "NaN items" or a negative count in the order summary card.
          if (!Number.isFinite(i.qty) || i.qty < 0 || !Number.isInteger(i.qty)) return [];
          return [{
            name: i.name,
            qty: i.qty,
            sizes: typeof i.sizes === 'string' ? i.sizes : undefined,
          }];
        })
      : [];

    // ETA is documented as an ISO date string. A corrupted localStorage blob
    // (devtools edit, older build with a different shape, partial write from
    // a crashed tab) can stash an unparseable value here — and the customer-
    // facing tracker would then render the raw garbage string in the
    // "Expected delivery" slot. Reject anything new Date() can't parse so the
    // UI cleanly omits the ETA row instead.
    let eta: string | null = null;
    if (typeof r.eta === 'string' && r.eta.trim() !== '') {
      const parsed = new Date(r.eta);
      if (!Number.isNaN(parsed.getTime())) eta = r.eta;
    }

    return {
      orderNumber: num,
      stage,
      trackingNumber: typeof r.trackingNumber === 'string' ? r.trackingNumber : null,
      eta,
      items,
    };
  }

  return null;
}

/**
 * Build a carrier tracking URL from a tracking number's prefix. Returns
 * null when no carrier rule matches so the caller can fall back to a
 * plain code display. Prefixes were chosen from the carriers Vision
 * Affichage actually uses (Canada Post, Purolator).
 */
export function getCarrierTrackingUrl(trackingNumber: string): { carrier: string; url: string } | null {
  if (!trackingNumber) return null;
  const t = trackingNumber.trim().toUpperCase();
  // Canada Post: 16-digit numeric, or 13-char alphanumeric ending in CA.
  if (/^[0-9]{16}$/.test(t) || /^[A-Z]{2}[0-9]{9}CA$/.test(t)) {
    return {
      carrier: 'Canada Post',
      url: `https://www.canadapost-postescanada.ca/track-reperage/en#/search?searchFor=${encodeURIComponent(t)}`,
    };
  }
  // Purolator: typically a 12-digit numeric pin.
  if (/^[0-9]{12}$/.test(t)) {
    return {
      carrier: 'Purolator',
      url: `https://www.purolator.com/en/shipping/tracker?pin=${encodeURIComponent(t)}`,
    };
  }
  return null;
}
