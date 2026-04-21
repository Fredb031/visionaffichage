// Salesman commission tracking — Phase D of QUOTE-ORDER-WORKFLOW.
//
// Orders in SHOPIFY_ORDERS_SNAPSHOT don't carry a salesman_id (yet —
// that will come from a future Supabase link table), so credit
// attribution is done through two mechanisms:
//
//  1. A seed map (SEED_ORDER_CREDITS) that hard-codes "who sold what"
//     for the demo data. This is deterministic and survives a cleared
//     localStorage so the vendor dashboard never boots blank.
//  2. A localStorage override (vision-commission-credits) populated by
//     a future linking UI on /admin/vendors. Overrides win over seed
//     so an admin reattributing an order immediately reflects in every
//     vendor's dashboard.
//
// Paid/pending state lives in its own localStorage key
// (vision-commission-paid) keyed by orderId → payout timestamp ISO.
// Presence of the key means "paid"; absence means "pending".
//
// The commission rate itself is stored in appSettings (commissionRate)
// so the admin Settings page can tweak it in one place; all math goes
// through computeCommission() which reads the current rate as a
// fraction.

import { readLS, writeLS } from './storage';
import { getSettings } from './appSettings';
import { SHOPIFY_ORDERS_SNAPSHOT, type ShopifyOrderSnapshot } from '@/data/shopifySnapshot';

export const DEFAULT_COMMISSION_RATE = 0.10;

const CREDITS_KEY = 'vision-commission-credits';
const PAID_KEY = 'vision-commission-paid';

// Seed credit attribution — the three seed vendors from AdminVendors
// each get a chunk of the recent orders so the dashboard has something
// real to render for demos. Keyed by the order's numeric Shopify id.
//
// These ids come from SHOPIFY_ORDERS_SNAPSHOT. When the snapshot is
// refreshed (see the comment at the top of shopifySnapshot.ts) the
// admin can rebuild attribution through the override map without
// having to edit this file.
const SEED_ORDER_CREDITS: Record<string, string> = {
  '7340967657587': '1', // Sophie Tremblay — #1570
  '7337444409459': '1', // Sophie — #1569
  '7336965210227': '2', // Marc-André — #1568
  '7336649425011': '1', // Sophie — #1567
  '7333897142387': '3', // Julie — #1566
  '7330005188723': '2', // Marc-André — #1565
  '7328741851251': '1', // Sophie — #1564
  '7324341010547': '3', // Julie — #1563
  '7319620255859': '2', // Marc-André — #1562
  '7307867848819': '1', // Sophie — #1560
  '7305456386163': '2', // Marc-André — #1559
  '7297122009203': '3', // Julie — #1558
  '7296727285875': '1', // Sophie — #1557
  '7296504922227': '2', // Marc-André — #1556
  '7295898878067': '3', // Julie — #1555
  '7295829639283': '1', // Sophie — #1554
  '7294762745971': '2', // Marc-André — #1553
  '7294322376819': '3', // Julie — #1552
  '7294205755507': '1', // Sophie — #1551
};

/** Pure commission calculation. Rounds to two decimals to avoid
 *  floating-point drift when summing many orders. */
export function computeCommission(orderTotal: number, rate: number = DEFAULT_COMMISSION_RATE): number {
  if (!Number.isFinite(orderTotal) || orderTotal <= 0) return 0;
  const r = Number.isFinite(rate) && rate >= 0 && rate <= 1 ? rate : DEFAULT_COMMISSION_RATE;
  return Math.round(orderTotal * r * 100) / 100;
}

/** Read the admin-configured commission rate, falling back to 10%. */
export function getCommissionRate(): number {
  const s = getSettings();
  const r = (s as { commissionRate?: unknown }).commissionRate;
  if (typeof r === 'number' && Number.isFinite(r) && r >= 0 && r <= 1) return r;
  return DEFAULT_COMMISSION_RATE;
}

/** localStorage override map: { [orderId]: vendorId }. Populated by a
 *  future linking UI; overrides win over the seed map. */
function readOverrides(): Record<string, string> {
  const parsed = readLS<unknown>(CREDITS_KEY, {});
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(parsed as Record<string, unknown>)) {
    if (typeof v === 'string' && v.length > 0) out[String(k)] = v;
  }
  return out;
}

export function setOrderCredit(orderId: string | number, vendorId: string | null): void {
  const key = String(orderId);
  const current = readOverrides();
  if (vendorId) current[key] = vendorId;
  else delete current[key];
  writeLS(CREDITS_KEY, current);
}

/** Resolve which vendor gets credit for an order. Override wins over
 *  seed; both fall back to `null` (uncredited). */
export function getOrderCredit(orderId: string | number): string | null {
  const key = String(orderId);
  const overrides = readOverrides();
  if (overrides[key]) return overrides[key];
  if (SEED_ORDER_CREDITS[key]) return SEED_ORDER_CREDITS[key];
  return null;
}

/** Paid-state map: { [orderId]: ISO-8601 payout date }. Presence = paid. */
function readPaidMap(): Record<string, string> {
  const parsed = readLS<unknown>(PAID_KEY, {});
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(parsed as Record<string, unknown>)) {
    if (typeof v === 'string' && v.length > 0) out[String(k)] = v;
  }
  return out;
}

export function isCommissionPaid(orderId: string | number): boolean {
  return Boolean(readPaidMap()[String(orderId)]);
}

export function getCommissionPaidAt(orderId: string | number): string | null {
  return readPaidMap()[String(orderId)] ?? null;
}

/** Stamps the order as paid with the current timestamp. Idempotent —
 *  re-marking an already-paid order refreshes the payout date. */
export function markCommissionPaid(orderId: string | number): string {
  const map = readPaidMap();
  const iso = new Date().toISOString();
  map[String(orderId)] = iso;
  writeLS(PAID_KEY, map);
  if (typeof window !== 'undefined') {
    try { window.dispatchEvent(new CustomEvent('vision-commission-change')); } catch { /* ignore */ }
  }
  return iso;
}

export function unmarkCommissionPaid(orderId: string | number): void {
  const map = readPaidMap();
  delete map[String(orderId)];
  writeLS(PAID_KEY, map);
  if (typeof window !== 'undefined') {
    try { window.dispatchEvent(new CustomEvent('vision-commission-change')); } catch { /* ignore */ }
  }
}

export interface VendorCommissionLine {
  order: ShopifyOrderSnapshot;
  commission: number;
  paid: boolean;
  paidAt: string | null;
}

export interface VendorCommissionSummary {
  vendorId: string;
  rate: number;
  lines: VendorCommissionLine[];
  totalSales: number;
  totalCommission: number;
  paidCommission: number;
  pendingCommission: number;
  paidCount: number;
  pendingCount: number;
  orderCount: number;
}

/** Sums up every order credited to `vendorId`, using the resolved
 *  credit map (overrides → seed). Returns both per-line detail and
 *  month-ready aggregates so dashboards don't need to re-fold the
 *  same numbers. */
export function getVendorCommissions(vendorId: string): VendorCommissionSummary {
  const rate = getCommissionRate();
  const paidMap = readPaidMap();
  const overrides = readOverrides();

  const lines: VendorCommissionLine[] = [];
  for (const order of SHOPIFY_ORDERS_SNAPSHOT) {
    const key = String(order.id);
    const credit = overrides[key] ?? SEED_ORDER_CREDITS[key] ?? null;
    if (credit !== vendorId) continue;
    const commission = computeCommission(order.total, rate);
    const paidAt = paidMap[key] ?? null;
    lines.push({ order, commission, paid: Boolean(paidAt), paidAt });
  }

  const totalSales = round2(lines.reduce((s, l) => s + l.order.total, 0));
  const totalCommission = round2(lines.reduce((s, l) => s + l.commission, 0));
  const paidCommission = round2(lines.filter(l => l.paid).reduce((s, l) => s + l.commission, 0));
  const pendingCommission = round2(totalCommission - paidCommission);

  return {
    vendorId,
    rate,
    lines,
    totalSales,
    totalCommission,
    paidCommission,
    pendingCommission,
    paidCount: lines.filter(l => l.paid).length,
    pendingCount: lines.filter(l => !l.paid).length,
    orderCount: lines.length,
  };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Filter a summary down to orders whose createdAt falls inside
 *  [yearMonth] (format 'YYYY-MM'). Returns a fresh summary with
 *  aggregates recomputed over the filtered lines. */
export function filterSummaryByMonth(
  summary: VendorCommissionSummary,
  yearMonth: string,
): VendorCommissionSummary {
  const [ys, ms] = yearMonth.split('-');
  const year = Number(ys);
  const month = Number(ms); // 1-12
  if (!Number.isFinite(year) || !Number.isFinite(month)) return summary;
  const lines = summary.lines.filter(l => {
    const d = new Date(l.order.createdAt);
    return d.getFullYear() === year && d.getMonth() + 1 === month;
  });
  const totalSales = round2(lines.reduce((s, l) => s + l.order.total, 0));
  const totalCommission = round2(lines.reduce((s, l) => s + l.commission, 0));
  const paidCommission = round2(lines.filter(l => l.paid).reduce((s, l) => s + l.commission, 0));
  const pendingCommission = round2(totalCommission - paidCommission);
  return {
    ...summary,
    lines,
    totalSales,
    totalCommission,
    paidCommission,
    pendingCommission,
    paidCount: lines.filter(l => l.paid).length,
    pendingCount: lines.filter(l => !l.paid).length,
    orderCount: lines.length,
  };
}

/** Build the 'YYYY-MM' key for today (local time). */
export function currentYearMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

/** Unique months present in this vendor's orders, newest first.
 *  Always includes currentYearMonth so the month-picker can default
 *  to "this month" even when no orders have landed yet. */
export function listVendorMonths(summary: VendorCommissionSummary): string[] {
  const set = new Set<string>();
  set.add(currentYearMonth());
  for (const l of summary.lines) {
    const d = new Date(l.order.createdAt);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    set.add(key);
  }
  return Array.from(set).sort((a, b) => b.localeCompare(a));
}

/** Escape a single CSV field. Wraps in double quotes and doubles any
 *  embedded double quotes; also wraps when the value contains a comma,
 *  quote, or newline. Empty/nullish → empty string. This mirrors RFC 4180
 *  so Excel + Numbers + Google Sheets all open the file cleanly. */
function csvField(value: unknown): string {
  if (value === null || value === undefined) return '';
  const s = String(value);
  if (s === '') return '';
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function csvRow(cells: unknown[]): string {
  return cells.map(csvField).join(',');
}

function toYmd(iso: string | null): string {
  if (!iso) return '';
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '';
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  } catch { return ''; }
}

/** Build a CSV string for a vendor's commissions in a given month.
 *  Headers: Order #, Customer, Order Date, Order Total, Commission Rate,
 *  Commission Amount, Status, Paid Date. Designed for accountants who
 *  open the file in Excel/Numbers without any post-processing. */
export function exportCommissionsCsv(vendorId: string, month: string): string {
  const summary = filterSummaryByMonth(getVendorCommissions(vendorId), month);
  const ratePct = `${(summary.rate * 100).toFixed(2)}%`;
  const headers = [
    'Order #', 'Customer', 'Order Date', 'Order Total',
    'Commission Rate', 'Commission Amount', 'Status', 'Paid Date',
  ];
  const rows = summary.lines.map(({ order, commission, paid, paidAt }) => csvRow([
    order.name,
    order.customerName || order.email || '',
    toYmd(order.createdAt),
    order.total.toFixed(2),
    ratePct,
    commission.toFixed(2),
    paid ? 'Paid' : 'Pending',
    toYmd(paidAt),
  ]));
  return [csvRow(headers), ...rows].join('\r\n') + '\r\n';
}

/** Build a CSV string with every seed vendor's commissions for the
 *  given month, prefixed with a Vendor column. Used by the admin
 *  "Export all vendors" button. Accepts the vendor list so the caller
 *  controls which rows (seed + custom-invited) land in the file. */
export function exportAllVendorsCommissionsCsv(
  vendors: Array<{ id: string; name: string }>,
  month: string,
): string {
  const headers = [
    'Vendor', 'Order #', 'Customer', 'Order Date', 'Order Total',
    'Commission Rate', 'Commission Amount', 'Status', 'Paid Date',
  ];
  const rows: string[] = [];
  for (const v of vendors) {
    const summary = filterSummaryByMonth(getVendorCommissions(v.id), month);
    const ratePct = `${(summary.rate * 100).toFixed(2)}%`;
    for (const { order, commission, paid, paidAt } of summary.lines) {
      rows.push(csvRow([
        v.name,
        order.name,
        order.customerName || order.email || '',
        toYmd(order.createdAt),
        order.total.toFixed(2),
        ratePct,
        commission.toFixed(2),
        paid ? 'Paid' : 'Pending',
        toYmd(paidAt),
      ]));
    }
  }
  return [csvRow(headers), ...rows].join('\r\n') + '\r\n';
}

/** Map an auth user's identity to a vendorId from the seed vendor
 *  list. Exported so the vendor dashboard can resolve "who am I"
 *  without duplicating the mapping. Matches by email first, then
 *  falls back to the user id (in case a future DB schema stores the
 *  vendor row id on the profile). */
export function resolveVendorIdForUser(user: { id?: string; email?: string } | null | undefined): string | null {
  if (!user) return null;
  const email = (user.email ?? '').toLowerCase();
  // Email → vendorId for the three seed vendors. Must stay in sync
  // with SEED_VENDORS in AdminVendors.tsx; duplicating the map here
  // avoids a circular import with the pages/ tree.
  const byEmail: Record<string, string> = {
    'sophie@visionaffichage.com': '1',
    'marc@visionaffichage.com': '2',
    'julie@visionaffichage.com': '3',
  };
  if (email && byEmail[email]) return byEmail[email];
  if (user.id && (user.id === '1' || user.id === '2' || user.id === '3')) return user.id;
  return null;
}
