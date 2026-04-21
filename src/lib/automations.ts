// Automations registry — the transactional workflows Vision Affichage
// fires from Shopify (order lifecycle), from the site itself (quote
// requests, welcome emails), and from scheduled Zaps (vendor payout,
// abandoned-cart nudges). Since there's no live orchestrator UI the
// admin can pause here, and the flag ends up in localStorage under
// `vision-automation-flags` — the downstream trigger site (or a Zapier
// webhook checker) can gate on it client-side before firing.
//
// Shape: a small, stable catalog. `recentRuns` are seeded with realistic
// mock executions so the admin has something to look at before we wire
// a real run-log backend. When the backend lands, swap `recentRuns` for
// a live fetch and leave the rest of the registry alone.
//
// id naming: kebab-case, stable forever — the localStorage flag map is
// keyed by id, so renaming an id will silently resurrect a paused
// automation.
//
// To extend: append a new entry to AUTOMATIONS below. New ids get the
// default 'active' status unless overridden in localStorage.

import { readLS, writeLS } from './storage';

export type AutomationStatus = 'active' | 'paused';

export interface AutomationRun {
  /** ISO timestamp */
  at: string;
  /** Did the run succeed? */
  ok: boolean;
  /** Short human-readable note — email sent to X, webhook 200, etc. */
  msg: string;
}

export interface Automation {
  id: string;
  name: string;
  triggerEvent: string;
  action: string;
  status: AutomationStatus;
  /** ISO timestamp of the most recent run, or null if never fired. */
  lastFired: string | null;
  recentRuns: AutomationRun[];
}

// Anchor mock timestamps off a single "now" so the relative times stay
// sensible across SSR/hydration and so the test snapshot is stable.
const NOW = new Date('2026-04-20T14:00:00-04:00').getTime();
const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;

const iso = (msAgo: number) => new Date(NOW - msAgo).toISOString();

const DEFAULTS: Automation[] = [
  {
    id: 'new-order-confirmation',
    name: 'New order confirmation',
    triggerEvent: 'Shopify · orders/paid',
    action: 'Email customer payment + ETA',
    status: 'active',
    lastFired: iso(22 * MIN),
    recentRuns: [
      { at: iso(22 * MIN),  ok: true,  msg: 'Sent to marc@beauchamp.qc — order VA-1052' },
      { at: iso(2 * HOUR),  ok: true,  msg: 'Sent to anthony@souspression.ca — order VA-1051' },
      { at: iso(5 * HOUR),  ok: true,  msg: 'Sent to julie@tremblay.ca — order VA-1050' },
      { at: iso(9 * HOUR),  ok: true,  msg: 'Sent to m.roy@legault-sports.com — order VA-1049' },
      { at: iso(14 * HOUR), ok: true,  msg: 'Sent to contact@brasseriedupont.ca — order VA-1048' },
      { at: iso(20 * HOUR), ok: true,  msg: 'Sent to admin@studiolux.co — order VA-1047' },
      { at: iso(1 * DAY + 2 * HOUR), ok: false, msg: 'Resend API 429 — retried OK 30s later' },
      { at: iso(1 * DAY + 5 * HOUR), ok: true,  msg: 'Sent to alex@fortinca.com — order VA-1046' },
      { at: iso(2 * DAY),   ok: true,  msg: 'Sent to marie@leblanc-design.ca — order VA-1045' },
      { at: iso(2 * DAY + 3 * HOUR), ok: true, msg: 'Sent to info@cafevue.ca — order VA-1044' },
    ],
  },
  {
    id: 'abandoned-cart-1h',
    name: 'Abandoned cart reminder — 1h',
    triggerEvent: 'Shopify · checkout abandoned + 1h',
    action: 'Email VISION10 recovery link',
    status: 'active',
    lastFired: iso(38 * MIN),
    recentRuns: [
      { at: iso(38 * MIN), ok: true,  msg: 'Sent to sophie.g@ecolepolyvalente.ca — cart $184.50' },
      { at: iso(3 * HOUR), ok: true,  msg: 'Sent to mike@northstarhr.com — cart $340.00' },
      { at: iso(6 * HOUR), ok: true,  msg: 'Sent to admin@librairiedugrandnord.ca — cart $92.15' },
      { at: iso(11 * HOUR),ok: true,  msg: 'Sent to jessica@bistroleport.ca — cart $215.80' },
      { at: iso(18 * HOUR),ok: true,  msg: 'Sent to contact@pharmaciedufort.ca — cart $78.00' },
      { at: iso(1 * DAY),  ok: true,  msg: 'Sent to marco@rossibuild.ca — cart $512.30' },
      { at: iso(1 * DAY + 8 * HOUR), ok: false, msg: 'Bounced — mailbox full' },
      { at: iso(2 * DAY),  ok: true,  msg: 'Sent to info@claudiasalon.ca — cart $156.00' },
    ],
  },
  {
    id: 'abandoned-cart-24h',
    name: 'Abandoned cart reminder — 24h',
    triggerEvent: 'Shopify · checkout abandoned + 24h',
    action: 'Email second nudge w/ VISION15',
    status: 'active',
    lastFired: iso(4 * HOUR),
    recentRuns: [
      { at: iso(4 * HOUR),  ok: true, msg: 'Sent to mike@northstarhr.com — cart $340.00' },
      { at: iso(9 * HOUR),  ok: true, msg: 'Sent to jessica@bistroleport.ca — cart $215.80' },
      { at: iso(16 * HOUR), ok: true, msg: 'Sent to marco@rossibuild.ca — cart $512.30' },
      { at: iso(1 * DAY + 1 * HOUR),  ok: true, msg: 'Sent to info@claudiasalon.ca — cart $156.00' },
      { at: iso(1 * DAY + 8 * HOUR),  ok: true, msg: 'Sent to paul@atelierdupoil.ca — cart $88.00' },
      { at: iso(2 * DAY),             ok: true, msg: 'Sent to contact@garagegf.ca — cart $275.50' },
    ],
  },
  {
    id: 'abandoned-cart-72h',
    name: 'Abandoned cart reminder — 72h',
    triggerEvent: 'Shopify · checkout abandoned + 72h',
    action: 'Final email w/ direct vendor contact',
    status: 'paused',
    lastFired: iso(3 * DAY),
    recentRuns: [
      { at: iso(3 * DAY),              ok: true,  msg: 'Sent to contact@quincaillerierr.ca — cart $420.00' },
      { at: iso(3 * DAY + 6 * HOUR),   ok: true,  msg: 'Sent to vero@boutiqueamelie.ca — cart $135.20' },
      { at: iso(4 * DAY),              ok: false, msg: 'Paused by admin — awaiting copy review' },
    ],
  },
  {
    id: 'quote-requested-admin',
    name: 'Quote requested — admin notification',
    triggerEvent: 'Site · POST /quote-request',
    action: 'Slack #quotes + email dispatch@ + assign vendor',
    status: 'active',
    lastFired: iso(1 * HOUR + 12 * MIN),
    recentRuns: [
      { at: iso(1 * HOUR + 12 * MIN), ok: true, msg: 'Q-2026-0087 — 250 t-shirts · assigned to Sophie T.' },
      { at: iso(4 * HOUR),            ok: true, msg: 'Q-2026-0086 — 120 hoodies · assigned to Marc L.' },
      { at: iso(7 * HOUR),            ok: true, msg: 'Q-2026-0085 — 40 casquettes · assigned to Sophie T.' },
      { at: iso(1 * DAY),             ok: true, msg: 'Q-2026-0084 — 600 sacs · assigned to Marc L.' },
      { at: iso(1 * DAY + 4 * HOUR),  ok: true, msg: 'Q-2026-0083 — 80 polos · assigned to Sophie T.' },
      { at: iso(2 * DAY),             ok: true, msg: 'Q-2026-0082 — 500 stylos · assigned to Julie D.' },
    ],
  },
  {
    id: 'quote-accepted-production',
    name: 'Quote accepted — production handoff',
    triggerEvent: 'Site · POST /quote/:id/accept',
    action: 'Create Shopify draft order + notify vendor',
    status: 'active',
    lastFired: iso(3 * HOUR + 40 * MIN),
    recentRuns: [
      { at: iso(3 * HOUR + 40 * MIN), ok: true,  msg: 'Q-2026-0081 accepted — draft VA-D-2093' },
      { at: iso(8 * HOUR),            ok: true,  msg: 'Q-2026-0079 accepted — draft VA-D-2092' },
      { at: iso(1 * DAY),             ok: true,  msg: 'Q-2026-0076 accepted — draft VA-D-2091' },
      { at: iso(1 * DAY + 7 * HOUR),  ok: false, msg: 'Shopify draft 422 — variant sold out, manual fallback' },
      { at: iso(2 * DAY),             ok: true,  msg: 'Q-2026-0073 accepted — draft VA-D-2090' },
    ],
  },
  {
    id: 'low-inventory-alert',
    name: 'Low inventory alert',
    triggerEvent: 'Shopify · inventory_levels/update (≤ 12)',
    action: 'Email ops@ + Slack #inventory',
    status: 'active',
    lastFired: iso(6 * HOUR),
    recentRuns: [
      { at: iso(6 * HOUR),            ok: true, msg: 'Gildan 5000 Black L — 8 left' },
      { at: iso(1 * DAY),             ok: true, msg: 'Port Authority C112 Navy — 11 left' },
      { at: iso(2 * DAY),             ok: true, msg: 'Bella 3501 White XL — 4 left' },
      { at: iso(3 * DAY),             ok: true, msg: 'Champion S149 Charcoal M — 12 left' },
    ],
  },
  {
    id: 'vendor-monthly-payout',
    name: 'Vendor monthly payout',
    triggerEvent: 'Cron · last Friday of month 09:00 ET',
    action: 'Compute commissions + email statements',
    status: 'active',
    lastFired: iso(14 * DAY),
    recentRuns: [
      { at: iso(14 * DAY),  ok: true,  msg: 'March payouts — 6 vendors, $18,420.00 total' },
      { at: iso(45 * DAY),  ok: true,  msg: 'February payouts — 5 vendors, $14,980.00 total' },
      { at: iso(76 * DAY),  ok: false, msg: 'January payouts — Stripe timeout, resolved manually' },
      { at: iso(106 * DAY), ok: true,  msg: 'December payouts — 6 vendors, $22,100.00 total' },
    ],
  },
  {
    id: 'new-customer-welcome',
    name: 'New customer welcome',
    triggerEvent: 'Shopify · customers/create',
    action: 'Email welcome + VISION10 coupon',
    status: 'active',
    lastFired: iso(55 * MIN),
    recentRuns: [
      { at: iso(55 * MIN),            ok: true, msg: 'Sent to nadia@cliniqueoz.ca' },
      { at: iso(3 * HOUR),            ok: true, msg: 'Sent to contact@microbrasserielr.ca' },
      { at: iso(8 * HOUR),            ok: true, msg: 'Sent to adrien@fgconstruction.ca' },
      { at: iso(1 * DAY),             ok: true, msg: 'Sent to lucie@boulangerielb.ca' },
      { at: iso(1 * DAY + 6 * HOUR),  ok: true, msg: 'Sent to service@garagenordest.ca' },
      { at: iso(2 * DAY),             ok: true, msg: 'Sent to marie-eve@studiomedit.ca' },
    ],
  },
  {
    id: 'order-shipped-tracking',
    name: 'Order shipped — tracking email',
    triggerEvent: 'Shopify · fulfillments/create',
    action: 'Email customer with carrier + tracking URL',
    status: 'active',
    lastFired: iso(1 * HOUR + 45 * MIN),
    recentRuns: [
      { at: iso(1 * HOUR + 45 * MIN), ok: true, msg: 'VA-1046 — Purolator 1Z999AA10123456784' },
      { at: iso(5 * HOUR),            ok: true, msg: 'VA-1045 — Canada Post 7001 2345 6789' },
      { at: iso(10 * HOUR),           ok: true, msg: 'VA-1044 — Purolator 1Z999AA10123456791' },
      { at: iso(1 * DAY),             ok: true, msg: 'VA-1043 — UPS 1Z12345E0205271688' },
      { at: iso(2 * DAY),             ok: true, msg: 'VA-1042 — Canada Post 7001 2345 9988' },
    ],
  },
];

export const AUTOMATIONS: ReadonlyArray<Automation> = DEFAULTS;

// ───────────────── localStorage flag overrides ─────────────────
//
// Admin toggles on /admin/automations write `{ [id]: 'active' | 'paused' }`
// here. Default status from AUTOMATIONS is used when no override exists.
// Stored separately from the registry so the overrides survive a
// registry shape change and so clearing the override (removing the key)
// reverts to the ship-default.

export const AUTOMATION_FLAGS_KEY = 'vision-automation-flags';

export type AutomationFlagMap = Record<string, AutomationStatus>;

export function readAutomationFlags(): AutomationFlagMap {
  const parsed = readLS<unknown>(AUTOMATION_FLAGS_KEY, {});
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
  const out: AutomationFlagMap = {};
  for (const [k, v] of Object.entries(parsed as Record<string, unknown>)) {
    if (v === 'active' || v === 'paused') out[k] = v;
  }
  return out;
}

export function writeAutomationFlags(flags: AutomationFlagMap): void {
  // writeLS handles the quota/private-mode guard + the SSR-safe early
  // return. Overrides just won't persist on failure — callers don't
  // branch on the return value.
  writeLS(AUTOMATION_FLAGS_KEY, flags);
}

/** Merge stored overrides on top of the seed defaults. */
export function getAutomationsWithFlags(): Automation[] {
  const flags = readAutomationFlags();
  return AUTOMATIONS.map(a => ({
    ...a,
    status: flags[a.id] ?? a.status,
  }));
}
