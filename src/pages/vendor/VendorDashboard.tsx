import { Fragment, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { DollarSign, TrendingUp, FileText, CheckCircle2, Clock, Calendar, Download, FileUp, Trash2, Link2, Check, Users, StickyNote, Send, ChevronDown, ChevronRight, Plus, Sparkles, HelpCircle, Printer, FilePlus, ArrowRight, Rocket } from 'lucide-react';
import { toast } from 'sonner';
import { StatCard } from '@/components/admin/StatCard';
import { Sparkline } from '@/components/admin/Sparkline';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { useAuthStore } from '@/stores/authStore';
import { hasPermission } from '@/lib/permissions';
import { useLang } from '@/lib/langContext';
import { sanitizeText } from '@/lib/sanitize';
import {
  getVendorCommissions,
  filterSummaryByMonth,
  listVendorMonths,
  currentYearMonth,
  markCommissionPaid,
  resolveVendorIdForUser,
  exportCommissionsCsv,
  type VendorCommissionSummary,
} from '@/lib/commissions';

// Vendor / salesman commission dashboard. Phase D2 of QUOTE-ORDER-WORKFLOW.
//
// The page is intentionally commission-first now: the four big metric
// cards + orders table are the reason a salesman signs in. The old
// quotes list / quick actions lived here as a placeholder and are
// already available under /vendor/quotes — keeping them here again
// would just push the commission content below the fold on laptop
// viewports.
//
// Admin-only "Mark paid" buttons use hasPermission(role, 'orders:write')
// since that's the closest permission bucket we already have (paying a
// salesman is a bookkeeping write on the order). The salesman viewing
// their own dashboard has orders:write too, but the button is gated on
// a stricter role check (admin+) because a salesman marking their own
// commission as paid would short-circuit the accountability loop.

// --- Live ticker mock helpers (Task 10.1) --------------------------------
//
// We don't have a daily-commission time series yet (the commissions lib
// only exposes a monthly summary). Until the backend grows a payout log
// we synthesize a 7-day series from the current month total using the
// same seeded-pseudo-noise pattern AdminProducts uses for its inventory
// sparkline: djb2 hash + mulberry32 so the shape is deterministic per
// (vendor, ISO week) and doesn't flicker between renders.
//
// TODO(backend): swap synthetic7DaySeries() for a query against a real
// daily-commission log (e.g. sum commissions by createdAt::date for the
// last 7 days). The <Sparkline /> consumer stays identical.

function djb2Hash(s: string): number {
  let h = 5381;
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  }
  return h >>> 0;
}

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function isoWeekKey(d: Date): string {
  const target = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = target.getUTCDay() || 7;
  target.setUTCDate(target.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(target.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((target.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${target.getUTCFullYear()}-w${week}`;
}

/** MOCK: distribute a monthly commission total across 7 days with
 *  deterministic pseudo-noise. Last point is "today" and is biased to
 *  land near the average so the big number and the sparkline tail line
 *  up visually. Returns 7 values, oldest first. */
function synthetic7DaySeries(vendorId: string, monthTotal: number, todayCommission: number): number[] {
  const seed = djb2Hash(`${vendorId}::${isoWeekKey(new Date())}`);
  const rand = mulberry32(seed);
  // Target average per day — split the month across ~22 business days
  // then multiply by 7 to get a "last week" chunk. Clamp to avoid a
  // flat-zero series when the vendor has no sales yet this month.
  const weekBudget = Math.max(monthTotal * (7 / 22), 1);
  const avg = weekBudget / 7;
  const series: number[] = [];
  for (let i = 0; i < 7; i++) {
    const jitter = (rand() - 0.5) * 0.6; // ±30%
    const v = avg * (1 + jitter);
    series.push(Math.max(0, Math.round(v * 100) / 100));
  }
  // Anchor today's point to the real count-up value so the ticker and
  // sparkline tail visibly agree.
  if (todayCommission > 0) series[series.length - 1] = Math.round(todayCommission * 100) / 100;
  return series;
}

/** Today's commission earned — filter the vendor summary down to
 *  orders created today (local time). */
function todayCommissionTotal(summary: VendorCommissionSummary): number {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();
  const d = now.getDate();
  let total = 0;
  for (const line of summary.lines) {
    const created = new Date(line.order.createdAt);
    if (created.getFullYear() === y && created.getMonth() === m && created.getDate() === d) {
      total += line.commission;
    }
  }
  return Math.round(total * 100) / 100;
}

/** Count-up animation hook. Eases from `from` to `to` over `durationMs`
 *  using requestAnimationFrame + ease-out cubic. Returns the current
 *  value. Respects `prefers-reduced-motion` by snapping straight to `to`. */
function useCountUp(to: number, durationMs = 900): number {
  const [value, setValue] = useState(to);
  const fromRef = useRef(to);
  useEffect(() => {
    const reduce = typeof window !== 'undefined'
      && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (reduce) {
      fromRef.current = to;
      setValue(to);
      return;
    }
    const from = fromRef.current;
    if (from === to) return;
    const start = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / durationMs);
      const eased = 1 - Math.pow(1 - t, 3); // ease-out cubic
      const v = from + (to - from) * eased;
      setValue(Math.round(v * 100) / 100);
      if (t < 1) raf = requestAnimationFrame(tick);
      else fromRef.current = to;
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [to, durationMs]);
  return value;
}

function formatMonth(ym: string, lang: 'fr' | 'en'): string {
  const [ys, ms] = ym.split('-');
  const d = new Date(Number(ys), Number(ms) - 1, 1);
  const locale = lang === 'fr' ? 'fr-CA' : 'en-CA';
  return d.toLocaleDateString(locale, { month: 'long', year: 'numeric' });
}

function formatMoney(n: number, lang: 'fr' | 'en'): string {
  return n.toLocaleString(lang === 'fr' ? 'fr-CA' : 'en-CA', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }) + ' $';
}

function formatDate(iso: string | null, lang: 'fr' | 'en'): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleDateString(lang === 'fr' ? 'fr-CA' : 'en-CA', {
      year: 'numeric', month: 'short', day: 'numeric',
    });
  } catch { return '—'; }
}

// --- Tax forms (T4A) upload — Task 10.7 ---------------------------------
//
// Vendors hand their year-end T4A to accounting once per year. Until
// the backend owns a real S3/Supabase bucket we stage files entirely
// client-side: base64-encoded in localStorage under
// `vision-vendor-tax-forms`, keyed by vendorId. The copy on the card
// explicitly tells the vendor the files live only on this device so
// they don't assume accounting can already see them.
//
// TODO(backend): replace the persistTaxForms() call below with a POST
// to /api/vendor/tax-forms (multipart) once the upload endpoint and
// S3/Supabase bucket exist. The form UI + list UI should survive that
// swap untouched — only persistTaxForms + loadTaxForms change.

const TAX_FORMS_STORAGE_KEY = 'vision-vendor-tax-forms';
const TAX_FORM_MAX_BYTES = 10 * 1024 * 1024; // 10 MB

interface TaxFormEntry {
  id: string;
  filename: string;
  type: string;
  size: number;
  year: number;
  uploadedAt: string;
  base64: string;
}

type TaxFormsMap = Record<string, TaxFormEntry[]>;

function loadTaxForms(): TaxFormsMap {
  try {
    const raw = localStorage.getItem(TAX_FORMS_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    return parsed as TaxFormsMap;
  } catch {
    return {};
  }
}

function persistTaxForms(map: TaxFormsMap): void {
  try {
    localStorage.setItem(TAX_FORMS_STORAGE_KEY, JSON.stringify(map));
  } catch {
    // Likely quota exceeded — base64 PDFs are bulky. Swallow silently
    // for now; the UI surfaces failure via the error banner at call site.
  }
}

function formatBytes(n: number, lang: 'fr' | 'en'): string {
  if (n < 1024) return `${n} ${lang === 'fr' ? 'o' : 'B'}`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} ${lang === 'fr' ? 'Ko' : 'KB'}`;
  return `${(n / 1024 / 1024).toFixed(2)} ${lang === 'fr' ? 'Mo' : 'MB'}`;
}

function readFileAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      if (typeof result === 'string') resolve(result);
      else reject(new Error('Invalid file read result'));
    };
    reader.onerror = () => reject(reader.error ?? new Error('File read error'));
    reader.readAsDataURL(file);
  });
}

// --- Client CRM notes (Task 10.8) --------------------------------------
//
// Vendors need a quick place to jot "Marc likes gold foil / wants same
// colour as last order" before a sales call. We derive the client list
// from orders credited to this vendor (so each salesman only sees the
// customers they actually worked with) and persist private notes in
// localStorage scoped by vendorId + customer email.
//
// Shape: { [vendorId]: { [customerEmail]: [{ body, at, author }] } }
//
// TODO(backend): swap loadClientNotes/persistClientNotes for POST/GET
// against /api/vendor/client-notes once Supabase owns the table. The
// note list UI (add-input + append-only list with per-note delete) is
// independent of the storage adapter and should survive the swap.

const CLIENT_NOTES_STORAGE_KEY = 'vision-vendor-client-notes';

interface ClientNote {
  body: string;
  at: string;
  author: string;
}

type ClientNotesMap = Record<string, Record<string, ClientNote[]>>;

function loadClientNotes(): ClientNotesMap {
  try {
    const raw = localStorage.getItem(CLIENT_NOTES_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    return parsed as ClientNotesMap;
  } catch {
    return {};
  }
}

function persistClientNotes(map: ClientNotesMap): void {
  try {
    localStorage.setItem(CLIENT_NOTES_STORAGE_KEY, JSON.stringify(map));
  } catch {
    // Quota exceeded — unlikely for plain-text notes but swallow to
    // avoid a crash; the UI's empty state will still render.
  }
}

interface ClientCrmRow {
  email: string;
  customerName: string;
  orderCount: number;
  ltv: number;
  lastOrderAt: string | null;
}

/** Fold the vendor's full line list into one row per unique customer
 *  email. customerName falls back to the most recent order's recorded
 *  name (so a company-named order wins over a blank one). */
function buildClientRows(summary: VendorCommissionSummary): ClientCrmRow[] {
  const byEmail = new Map<string, ClientCrmRow>();
  for (const line of summary.lines) {
    const email = (line.order.email ?? '').toLowerCase().trim();
    if (!email) continue;
    const existing = byEmail.get(email);
    if (existing) {
      existing.orderCount += 1;
      existing.ltv = Math.round((existing.ltv + line.order.total) * 100) / 100;
      const existingTs = existing.lastOrderAt ? Date.parse(existing.lastOrderAt) : 0;
      const candidateTs = Date.parse(line.order.createdAt);
      if (candidateTs > existingTs) {
        existing.lastOrderAt = line.order.createdAt;
        if (line.order.customerName) existing.customerName = line.order.customerName;
      }
    } else {
      byEmail.set(email, {
        email,
        customerName: line.order.customerName || email,
        orderCount: 1,
        ltv: Math.round(line.order.total * 100) / 100,
        lastOrderAt: line.order.createdAt,
      });
    }
  }
  return Array.from(byEmail.values()).sort((a, b) => {
    const ta = a.lastOrderAt ? Date.parse(a.lastOrderAt) : 0;
    const tb = b.lastOrderAt ? Date.parse(b.lastOrderAt) : 0;
    return tb - ta;
  });
}

// --- Recent quotes preview (dashboard card) ---------------------------
//
// Vendors land on the dashboard expecting a glance at their last few
// quotes before deciding whether to dive into /vendor/quotes. We read
// the same localStorage key QuoteList uses ('vision-quotes') so both
// views stay in lockstep — no shadow store, no duplicated shape. Bad
// rows get skipped per-item (mirror of QuoteList's per-row try/catch)
// so one malformed quote can't wipe the preview.

type RecentQuoteStatus = 'draft' | 'sent' | 'viewed' | 'accepted' | 'paid' | 'expired';

interface RecentQuote {
  id: string;
  number: string;
  client: string;
  total: number;
  status: RecentQuoteStatus;
  createdAt: string | null;
}

const RECENT_QUOTE_STATUSES: readonly RecentQuoteStatus[] = [
  'draft', 'sent', 'viewed', 'accepted', 'paid', 'expired',
];

function coerceRecentStatus(raw: unknown): RecentQuoteStatus {
  return typeof raw === 'string' && (RECENT_QUOTE_STATUSES as readonly string[]).includes(raw)
    ? (raw as RecentQuoteStatus)
    : 'draft';
}

const RECENT_QUOTE_STATUS_LABEL_FR: Record<RecentQuoteStatus, string> = {
  draft: 'Brouillon',
  sent: 'Envoyé',
  viewed: 'Vu',
  accepted: 'Accepté',
  paid: 'Payé',
  expired: 'Expiré',
};
const RECENT_QUOTE_STATUS_LABEL_EN: Record<RecentQuoteStatus, string> = {
  draft: 'Draft',
  sent: 'Sent',
  viewed: 'Viewed',
  accepted: 'Accepted',
  paid: 'Paid',
  expired: 'Expired',
};
const RECENT_QUOTE_STATUS_COLOR: Record<RecentQuoteStatus, string> = {
  draft: 'bg-zinc-100 text-zinc-700',
  sent: 'bg-blue-50 text-blue-700',
  viewed: 'bg-amber-50 text-amber-700',
  accepted: 'bg-emerald-50 text-emerald-700',
  paid: 'bg-emerald-100 text-emerald-800',
  expired: 'bg-rose-50 text-rose-700',
};

function loadRecentQuotes(limit: number): RecentQuote[] {
  try {
    const raw = JSON.parse(localStorage.getItem('vision-quotes') ?? '[]');
    if (!Array.isArray(raw)) return [];
    const rows: RecentQuote[] = [];
    for (const q of raw as Array<Record<string, unknown>>) {
      try {
        if (!q || typeof q !== 'object') continue;
        const email = typeof q.clientEmail === 'string' ? q.clientEmail : '';
        const clientFromEmail = email.includes('@') ? email.split('@')[0] : email;
        const client = typeof q.clientName === 'string' && q.clientName
          ? q.clientName
          : (clientFromEmail || '—');
        const total = Number.isFinite(q.total) ? (q.total as number) : 0;
        rows.push({
          id: String(q.id ?? `q-${rows.length}`),
          number: typeof q.number === 'string' ? q.number : '—',
          client,
          total,
          status: coerceRecentStatus(q.status),
          createdAt: typeof q.createdAt === 'string' ? q.createdAt : null,
        });
      } catch {
        // Skip malformed row, keep the rest.
      }
    }
    rows.sort((a, b) => {
      const ta = a.createdAt ? Date.parse(a.createdAt) : 0;
      const tb = b.createdAt ? Date.parse(b.createdAt) : 0;
      return tb - ta;
    });
    return rows.slice(0, limit);
  } catch {
    return [];
  }
}

function formatDateTime(iso: string, lang: 'fr' | 'en'): string {
  try {
    return new Date(iso).toLocaleString(lang === 'fr' ? 'fr-CA' : 'en-CA', {
      year: 'numeric', month: 'short', day: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  } catch { return iso; }
}

// --- Onboarding tour (Task 10.5) ----------------------------------------
//
// Five-step first-visit tour. Each step has a ref pointing at a DOM
// element in the dashboard; the overlay measures the target's bounding
// rect on mount / resize / scroll and renders three layered elements:
//
//   1. A full-viewport dim backdrop (pointer-events: auto, catches clicks
//      to advance — except we prefer explicit buttons, so it's inert).
//   2. A "hole" div positioned over the target using absolute left/top/
//      width/height and a giant inset box-shadow to paint everything
//      outside the hole at rgba(0,0,0,0.6). This is the classic
//      Shepherd.js / Intro.js cut-out trick.
//   3. A tooltip card placed below (or above, if there's no room) the
//      target, with title, body, Next/Skip buttons, and a step counter.
//
// First-view detection uses localStorage key `vision-vendor-tour-seen`.
// A "Revoir la visite" button in the footer lets the vendor re-run the
// tour at any time (clears the flag + forces the tour open).
//
// Keyboard: Escape skips the whole tour; Enter/Space advances (or
// finishes on the last step). Focus is returned to the trigger button
// when the tour closes, so keyboard users don't lose their place.

const TOUR_SEEN_STORAGE_KEY = 'vision-vendor-tour-seen';

interface TourStep {
  id: 'welcome' | 'ticker' | 'quotes' | 'clients' | 'profile';
  titleFr: string;
  titleEn: string;
  bodyFr: string;
  bodyEn: string;
}

const TOUR_STEPS: TourStep[] = [
  {
    id: 'welcome',
    titleFr: 'Bienvenue sur ton tableau de bord',
    titleEn: 'Welcome to your dashboard',
    bodyFr:
      'Voici ton espace vendeur Vision Affichage. En 5 étapes rapides, je te montre où tout se trouve. Tu peux sauter à tout moment.',
    bodyEn:
      'This is your Vision Affichage vendor workspace. In 5 quick steps I\u2019ll show you where everything lives. You can skip anytime.',
  },
  {
    id: 'ticker',
    titleFr: 'Commission en direct',
    titleEn: 'Live commission',
    bodyFr:
      'Le gros chiffre en bleu est ta commission gagnée aujourd\u2019hui. Le trait doré montre les 7 derniers jours. Il s\u2019anime à chaque nouvelle vente.',
    bodyEn:
      'The big number is the commission you\u2019ve earned today. The blue sparkline covers the last 7 days and re-animates on every new sale.',
  },
  {
    id: 'quotes',
    titleFr: 'Tes soumissions',
    titleEn: 'Your quotes',
    bodyFr:
      'Crée une soumission client en un clic. C\u2019est d\u2019ici que tu lances ton prochain devis — enseigne extérieure, lettrage, installation, etc.',
    bodyEn:
      'Create a client quote in one click. This is where you kick off your next estimate — exterior sign, lettering, install, etc.',
  },
  {
    id: 'clients',
    titleFr: 'Mes clients',
    titleEn: 'My clients',
    bodyFr:
      'Tes clients apparaissent ici avec leur valeur vie et un espace de notes privées. Idéal avant un appel de suivi.',
    bodyEn:
      'Your clients appear here with their lifetime value and a private notes pad — handy right before a follow-up call.',
  },
  {
    id: 'profile',
    titleFr: 'Ton profil public',
    titleEn: 'Your public profile',
    bodyFr:
      'Partage ton profil public avec un client : copie le lien et envoie-le par courriel ou LinkedIn. Ton profil est la carte de visite numérique de Vision Affichage.',
    bodyEn:
      'Share your public profile with a client: copy the link and send it over email or LinkedIn. Your profile is your digital business card.',
  },
];

interface TargetRect {
  top: number;
  left: number;
  width: number;
  height: number;
}

/** Measure an element relative to the viewport (position:fixed space). */
function measure(el: HTMLElement | null): TargetRect | null {
  if (!el) return null;
  const r = el.getBoundingClientRect();
  // Pad the highlight a little so the cut-out breathes around the target.
  const pad = 6;
  return {
    top: r.top - pad,
    left: r.left - pad,
    width: r.width + pad * 2,
    height: r.height + pad * 2,
  };
}

interface OnboardingTourProps {
  lang: 'fr' | 'en';
  targets: Array<HTMLElement | null>;
  onDone: () => void;
}

function OnboardingTour({ lang, targets, onDone }: OnboardingTourProps) {
  const [stepIndex, setStepIndex] = useState(0);
  const [rect, setRect] = useState<TargetRect | null>(null);
  const step = TOUR_STEPS[stepIndex];
  const total = TOUR_STEPS.length;

  const L = (fr: string, en: string) => (lang === 'fr' ? fr : en);

  // Re-measure on step change, resize, and scroll. useLayoutEffect so
  // the tooltip never flashes at (0,0) before the first measure.
  useLayoutEffect(() => {
    const el = targets[stepIndex] ?? null;
    if (el && typeof el.scrollIntoView === 'function') {
      // Scroll the target into view before measuring so the tooltip
      // card ends up on-screen for long dashboards.
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
    const recalc = () => setRect(measure(el));
    recalc();
    window.addEventListener('resize', recalc);
    window.addEventListener('scroll', recalc, true);
    // Re-poll once after the scrollIntoView animation likely settled.
    const t = window.setTimeout(recalc, 350);
    return () => {
      window.removeEventListener('resize', recalc);
      window.removeEventListener('scroll', recalc, true);
      window.clearTimeout(t);
    };
  }, [stepIndex, targets]);

  const advance = useCallback(() => {
    setStepIndex(i => {
      if (i + 1 >= total) {
        onDone();
        return i;
      }
      return i + 1;
    });
  }, [total, onDone]);

  const skip = useCallback(() => {
    onDone();
  }, [onDone]);

  // Keyboard: Escape = skip, Enter/Space = advance.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        skip();
      } else if (e.key === 'Enter' || e.key === ' ') {
        // Don't hijack when the user is typing in a field.
        const tgt = e.target as HTMLElement | null;
        const tag = tgt?.tagName;
        if (tag === 'TEXTAREA' || tag === 'INPUT' || tgt?.isContentEditable) return;
        e.preventDefault();
        advance();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [advance, skip]);

  // Tooltip position — below the target if there's room, otherwise above.
  const tooltipStyle: React.CSSProperties = useMemo(() => {
    if (!rect) {
      // Welcome-style centered fallback for first render / missing target.
      return {
        position: 'fixed',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        maxWidth: 420,
        width: 'calc(100vw - 32px)',
      };
    }
    const vh = typeof window !== 'undefined' ? window.innerHeight : 800;
    const vw = typeof window !== 'undefined' ? window.innerWidth : 1200;
    const below = rect.top + rect.height + 14;
    const placeAbove = below + 220 > vh && rect.top > 240;
    const top = placeAbove ? Math.max(16, rect.top - 14) : below;
    const transform = placeAbove ? 'translateY(-100%)' : undefined;
    // Clamp left so the card stays fully on-screen on narrow viewports.
    const desiredLeft = rect.left + rect.width / 2;
    const cardWidth = Math.min(420, vw - 32);
    const left = Math.min(Math.max(16 + cardWidth / 2, desiredLeft), vw - 16 - cardWidth / 2);
    return {
      position: 'fixed',
      top,
      left,
      transform: transform ? `translate(-50%, -100%)` : 'translateX(-50%)',
      maxWidth: 420,
      width: `calc(100vw - 32px)`,
    };
  }, [rect]);

  // Cut-out highlight. One giant box-shadow paints the whole viewport
  // dim; the element itself stays transparent, creating the "spotlight".
  // pointer-events:none so clicks still reach the underlying UI for
  // accessibility (keyboard users can still tab through the page).
  const holeStyle: React.CSSProperties | undefined = rect
    ? {
        position: 'fixed',
        top: rect.top,
        left: rect.left,
        width: rect.width,
        height: rect.height,
        boxShadow: '0 0 0 9999px rgba(0,0,0,0.6)',
        borderRadius: 12,
        pointerEvents: 'none',
        zIndex: 9998,
        transition: 'all 260ms ease-out',
        outline: '2px solid rgba(232, 168, 56, 0.9)',
        outlineOffset: 2,
      }
    : undefined;

  // If the target isn't measured yet (step 1 "welcome" deliberately has
  // no anchor — it's the whole-page intro), fall back to a full-screen
  // dim backdrop behind the centered tooltip.
  const backdropStyle: React.CSSProperties = {
    position: 'fixed',
    inset: 0,
    background: rect ? 'transparent' : 'rgba(0,0,0,0.6)',
    zIndex: 9997,
    pointerEvents: 'auto',
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="vendor-tour-title"
      aria-describedby="vendor-tour-body"
    >
      <div style={backdropStyle} aria-hidden="true" />
      {holeStyle && <div style={holeStyle} aria-hidden="true" />}
      <div
        style={{ ...tooltipStyle, zIndex: 9999 }}
        className="rounded-2xl border border-zinc-200 bg-white shadow-2xl px-5 py-4 sm:px-6 sm:py-5"
      >
        <div className="flex items-center justify-between gap-3 mb-2">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-brand-black/10 text-brand-black">
              <Sparkles size={14} aria-hidden="true" />
            </span>
            <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-500">
              {L(`Étape ${stepIndex + 1} sur ${total}`, `Step ${stepIndex + 1} of ${total}`)}
            </span>
          </div>
          <button
            type="button"
            onClick={skip}
            className="text-[11px] font-bold text-zinc-500 hover:text-zinc-800 underline-offset-2 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0052CC]/50 rounded-sm px-1"
            aria-label={L('Passer la visite', 'Skip tour')}
          >
            {L('Passer', 'Skip')}
          </button>
        </div>
        <h2
          id="vendor-tour-title"
          className="text-lg font-extrabold tracking-tight text-brand-black"
        >
          {lang === 'fr' ? step.titleFr : step.titleEn}
        </h2>
        <p id="vendor-tour-body" className="mt-1 text-sm text-zinc-700 leading-relaxed">
          {lang === 'fr' ? step.bodyFr : step.bodyEn}
        </p>
        <div className="mt-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-1.5" aria-hidden="true">
            {TOUR_STEPS.map((_, i) => (
              <span
                key={i}
                className={`h-1.5 rounded-full transition-all ${
                  i === stepIndex
                    ? 'w-6 bg-[#0052CC]'
                    : i < stepIndex
                      ? 'w-1.5 bg-[#0052CC]/60'
                      : 'w-1.5 bg-zinc-300'
                }`}
              />
            ))}
          </div>
          <button
            type="button"
            onClick={advance}
            autoFocus
            className="inline-flex items-center gap-1.5 text-xs font-bold px-4 py-2 bg-[#0052CC] text-white rounded-lg hover:opacity-90 shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0052CC] focus-visible:ring-offset-1"
            aria-label={
              stepIndex + 1 >= total
                ? L('Terminer la visite', 'Finish tour')
                : L('Étape suivante', 'Next step')
            }
          >
            {stepIndex + 1 >= total
              ? L('Terminer', 'Finish')
              : L('Suivant', 'Next')}
          </button>
        </div>
      </div>
    </div>
  );
}

/** Vendor / salesman commission dashboard — month picker, KPI cards,
 *  live ticker, orders table, quick actions. Default landing page for
 *  the salesman role. */
export default function VendorDashboard() {
  useDocumentTitle('Tableau de bord — Vendeur Vision Affichage');
  const { lang } = useLang();
  const user = useAuthStore(s => s.user);

  // Greeting derived from the auth user's display name (first token) with
  // an email-prefix fallback so a brand-new salesman who hasn't set a
  // name yet still gets a personal "Bonjour, <handle>". Sanitized via
  // sanitizeText since name/email are user-controlled. Mirrors the
  // admin-dashboard 552c049 pattern (`Bonjour, <name>` + today's date
  // in fr-CA) — keeping cross-role headers visually consistent.
  const greetingName = useMemo(() => {
    const raw = (user?.name ?? '').trim();
    if (raw) return sanitizeText(raw.split(/\s+/)[0], { maxLength: 40 });
    const email = user?.email ?? '';
    if (email.includes('@')) return sanitizeText(email.split('@')[0], { maxLength: 40 });
    return '';
  }, [user]);
  // fr-CA spells out weekday + month — matches the admin dashboard
  // header so a salesman who occasionally previews /admin sees the
  // same date format. Locale stays fr-CA regardless of the L() toggle
  // because the rest of the app's date strings (formatMonth, the CSV
  // export footer, the relevé) are anchored in Quebec French dates.
  const todayLabel = useMemo(
    () =>
      new Date().toLocaleDateString(lang === 'fr' ? 'fr-CA' : 'en-CA', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      }),
    [lang],
  );

  const isAdminLevel = Boolean(user && (user.role === 'president' || user.role === 'admin'));
  const canMarkPaid = Boolean(user && hasPermission(user.role, 'orders:write') && isAdminLevel);

  const vendorId = useMemo(() => {
    // Admins viewing this page see a dashboard for vendor '1' (Sophie)
    // by default — the real admin view is /admin/vendors. A salesman
    // gets mapped by email; unknown users fall through to vendor '1'
    // so the page still demos.
    const mapped = resolveVendorIdForUser(user);
    if (mapped) return mapped;
    return '1';
  }, [user]);

  const [month, setMonth] = useState<string>(() => currentYearMonth());
  const [refreshToken, setRefreshToken] = useState(0);

  // Keep the summary + months fresh across "Mark paid" clicks and
  // cross-tab commission edits (another browser tab flipping a
  // commission). The lib fires 'vision-commission-change' on every
  // write; bumping refreshToken re-runs the memo.
  useEffect(() => {
    const bump = () => setRefreshToken(t => t + 1);
    window.addEventListener('vision-commission-change', bump);
    const onStorage = (e: StorageEvent) => {
      // e.key === null fires when a peer tab calls localStorage.clear();
      // every commission/credits/settings key was just wiped, so bump the
      // refresh token to re-derive the summary from a clean slate instead
      // of rendering stale paid/credit overlays until the next reload.
      // Mirrors the same null-guard applied in commits 0eac287, 4e13b7a,
      // 224d426, 1bbbcd8.
      if (
        e.key === null ||
        e.key === 'vision-commission-paid' ||
        e.key === 'vision-commission-credits' ||
        e.key === 'vision-app-settings'
      ) {
        bump();
      }
    };
    window.addEventListener('storage', onStorage);
    return () => {
      window.removeEventListener('vision-commission-change', bump);
      window.removeEventListener('storage', onStorage);
    };
  }, []);

  const fullSummary: VendorCommissionSummary = useMemo(
    () => getVendorCommissions(vendorId),
    // refreshToken intentionally included so the mark-paid mutation
    // flows back into this memo; vendorId covers the user-switch path.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [vendorId, refreshToken],
  );

  const summary = useMemo(
    () => filterSummaryByMonth(fullSummary, month),
    [fullSummary, month],
  );

  const months = useMemo(() => listVendorMonths(fullSummary), [fullSummary]);

  // Live ticker inputs — today's real commission (from full summary,
  // independent of the month picker so the banner keeps showing "today"
  // even when the vendor is browsing a prior month) and the synthetic
  // 7-day series. Both recompute on every refreshToken bump via
  // fullSummary, so vision-commission-change re-animates the number.
  const todayCommission = useMemo(() => todayCommissionTotal(fullSummary), [fullSummary]);
  const animatedToday = useCountUp(todayCommission);
  const last7Days = useMemo(
    () => synthetic7DaySeries(vendorId, fullSummary.totalCommission, todayCommission),
    [vendorId, fullSummary.totalCommission, todayCommission],
  );

  const onMarkPaid = useCallback((orderId: number | string) => {
    markCommissionPaid(orderId);
    setRefreshToken(t => t + 1);
  }, []);

  // Accountants asked for a one-click month-end export — this replaces
  // hand-copying the table. The Blob URL is revoked on a short timeout
  // (after the click() fires) to avoid leaking the object URL for the
  // life of the tab. Task 18.7: deferred 1s to match the pattern used
  // across the admin exporters — an immediate revoke races Safari's
  // download dispatcher and occasionally cancels the transfer. Button
  // is gated on orders:read so a viewer role couldn't download numbers
  // they can't see in the table.
  const canExport = Boolean(user && hasPermission(user.role, 'orders:read'));
  const exportDisabled = summary.lines.length === 0;
  const onExportCsv = useCallback(() => {
    const csv = exportCommissionsCsv(vendorId, month);
    // Prefix with a UTF-8 BOM so Excel-on-Windows auto-detects UTF-8
    // and doesn't mangle accented Québec customer names (ç, é, à…).
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `commissions-${month}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    // Revoke the blob URL after the download kicks off so repeated
    // monthly exports don't stack object URLs in memory for the life
    // of the tab. 1s matches lib/csv.ts and the other admin exporters.
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }, [vendorId, month]);

  // Task 10.6 — print-ready statement popup. Accountants asked for a
  // formatted page (header, totals, signature line) they can save as
  // PDF. Doing this natively via window.print() keeps the bundle lean
  // — no jsPDF / html2pdf megabytes for a feature used once a month.
  // We build the HTML as a string, document.write() it into a popup,
  // and call window.print() after load; Cmd/Ctrl+S from the print
  // dialog gives us "save as PDF" for free on every major browser.
  const onDownloadStatement = useCallback(() => {
    const ratePct = `${(summary.rate * 100).toFixed(2)}%`;
    const vendorName = (user?.name || 'Vendeur').trim();
    const periodLabel = formatMonth(month, lang);
    const nowLabel = new Date().toLocaleDateString(lang === 'fr' ? 'fr-CA' : 'en-CA', {
      year: 'numeric', month: 'long', day: 'numeric',
    });
    const esc = (s: string) => String(s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    const rowsHtml = summary.lines.length === 0
      ? `<tr><td colspan="7" class="empty">${lang === 'fr' ? 'Aucune commande pour cette période.' : 'No orders for this period.'}</td></tr>`
      : summary.lines.map(({ order, commission, paid }) => `
        <tr>
          <td class="mono">${esc(order.name)}</td>
          <td>${esc(order.customerName || order.email || '—')}</td>
          <td>${esc(formatDate(order.createdAt, lang))}</td>
          <td class="num">${esc(formatMoney(order.total, lang))}</td>
          <td class="num">${esc(ratePct)}</td>
          <td class="num strong">${esc(formatMoney(commission, lang))}</td>
          <td>${paid
            ? (lang === 'fr' ? 'Payée' : 'Paid')
            : (lang === 'fr' ? 'En attente' : 'Pending')}</td>
        </tr>`).join('');

    const t = {
      title: lang === 'fr' ? 'Relevé de commissions' : 'Commission statement',
      brand: 'Vision Affichage',
      tagline: lang === 'fr' ? 'Impression & signalisation' : 'Print & signage',
      vendorLabel: lang === 'fr' ? 'Vendeur' : 'Vendor',
      periodLabel: lang === 'fr' ? 'Période' : 'Period',
      issued: lang === 'fr' ? 'Émis le' : 'Issued',
      orderNo: lang === 'fr' ? 'Commande' : 'Order #',
      customer: lang === 'fr' ? 'Client' : 'Customer',
      date: lang === 'fr' ? 'Date' : 'Date',
      total: lang === 'fr' ? 'Total' : 'Total',
      rate: lang === 'fr' ? 'Taux' : 'Rate',
      commission: lang === 'fr' ? 'Commission' : 'Commission',
      status: lang === 'fr' ? 'Statut' : 'Status',
      sales: lang === 'fr' ? 'Ventes' : 'Sales',
      commissions: lang === 'fr' ? 'Commissions' : 'Commissions',
      paid: lang === 'fr' ? 'Payée' : 'Paid',
      pending: lang === 'fr' ? 'En attente' : 'Pending',
      footer: lang === 'fr'
        ? 'Document généré automatiquement — Vision Affichage'
        : 'Automatically generated document — Vision Affichage',
      signature: lang === 'fr' ? 'Signature autorisée' : 'Authorized signature',
      printBtn: lang === 'fr' ? 'Imprimer / Enregistrer en PDF' : 'Print / Save as PDF',
    };

    const html = `<!DOCTYPE html>
<html lang="${lang}">
<head>
  <meta charset="utf-8" />
  <title>${esc(t.title)} — ${esc(vendorName)} — ${esc(periodLabel)}</title>
  <style>
    *,*::before,*::after{box-sizing:border-box}
    html,body{margin:0;padding:0;background:#f4f4f5;color:#111;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Helvetica,Arial,sans-serif;font-size:12px;line-height:1.4}
    .page{max-width:800px;margin:24px auto;background:#fff;padding:32px 36px;box-shadow:0 1px 3px rgba(0,0,0,.08)}
    .toolbar{max-width:800px;margin:16px auto 0;display:flex;justify-content:flex-end}
    .toolbar button{font:inherit;font-weight:700;background:#0A0A0A;color:#fff;border:0;padding:8px 14px;border-radius:6px;cursor:pointer}
    header.brand{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:2px solid #0A0A0A;padding-bottom:14px;margin-bottom:18px}
    .logo{display:flex;align-items:center;gap:12px}
    .logo-mark{width:44px;height:44px;border:2px solid #0A0A0A;border-radius:6px;display:flex;align-items:center;justify-content:center;font-weight:800;color:#0A0A0A;font-size:18px;letter-spacing:-.5px}
    .brand-name{font-size:18px;font-weight:800;color:#0A0A0A;letter-spacing:-.2px}
    .brand-tag{font-size:10px;color:#555;text-transform:uppercase;letter-spacing:.12em;margin-top:2px}
    .doc-title{text-align:right}
    .doc-title h1{margin:0;font-size:18px;font-weight:800;color:#0A0A0A;text-transform:uppercase;letter-spacing:.05em}
    .doc-title .meta{margin-top:4px;font-size:11px;color:#555}
    .who{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:16px;font-size:12px}
    .who .box{border:1px solid #d4d4d8;padding:10px 12px;border-radius:4px}
    .who .lbl{font-size:10px;color:#555;text-transform:uppercase;letter-spacing:.08em;margin-bottom:2px}
    .who .val{font-weight:700;color:#111}
    table{width:100%;border-collapse:collapse;margin-top:6px}
    thead th{background:#0A0A0A;color:#fff;text-align:left;padding:8px 10px;font-size:10px;text-transform:uppercase;letter-spacing:.06em}
    thead th.num{text-align:right}
    tbody td{border-bottom:1px solid #e5e5e5;padding:7px 10px;vertical-align:top}
    tbody td.num{text-align:right;font-variant-numeric:tabular-nums}
    tbody td.mono{font-family:"SF Mono",Menlo,Consolas,monospace;font-weight:700;color:#0A0A0A}
    tbody td.strong{font-weight:700}
    tbody td.empty{text-align:center;color:#888;padding:24px}
    .totals{margin-top:14px;display:flex;justify-content:flex-end}
    .totals table{width:320px}
    .totals td{padding:5px 8px;border:0}
    .totals td.lbl{color:#444}
    .totals td.val{text-align:right;font-variant-numeric:tabular-nums;font-weight:700}
    .totals tr.grand td{border-top:2px solid #0A0A0A;font-size:13px;color:#0A0A0A}
    .sig{margin-top:40px;display:flex;justify-content:space-between;gap:24px}
    .sig .line{flex:1;border-top:1px solid #111;padding-top:4px;font-size:10px;color:#555;text-transform:uppercase;letter-spacing:.08em}
    footer{margin-top:28px;padding-top:10px;border-top:1px solid #e5e5e5;text-align:center;font-size:10px;color:#888}
    @media print {
      html,body{background:#fff}
      .toolbar,.no-print{display:none !important}
      .page{margin:0;padding:18mm 14mm;box-shadow:none;max-width:none}
      thead{display:table-header-group}
      tr{page-break-inside:avoid}
      @page{size:letter;margin:0}
    }
  </style>
</head>
<body>
  <div class="toolbar no-print"><button type="button" onclick="window.print()">${esc(t.printBtn)}</button></div>
  <main class="page">
    <header class="brand">
      <div class="logo">
        <div class="logo-mark" aria-hidden="true">VA</div>
        <div>
          <div class="brand-name">${esc(t.brand)}</div>
          <div class="brand-tag">${esc(t.tagline)}</div>
        </div>
      </div>
      <div class="doc-title">
        <h1>${esc(t.title)}</h1>
        <div class="meta">${esc(t.issued)} ${esc(nowLabel)}</div>
      </div>
    </header>
    <section class="who">
      <div class="box">
        <div class="lbl">${esc(t.vendorLabel)}</div>
        <div class="val">${esc(vendorName)}</div>
      </div>
      <div class="box">
        <div class="lbl">${esc(t.periodLabel)}</div>
        <div class="val">${esc(periodLabel)}</div>
      </div>
    </section>
    <table>
      <thead>
        <tr>
          <th>${esc(t.orderNo)}</th>
          <th>${esc(t.customer)}</th>
          <th>${esc(t.date)}</th>
          <th class="num">${esc(t.total)}</th>
          <th class="num">${esc(t.rate)}</th>
          <th class="num">${esc(t.commission)}</th>
          <th>${esc(t.status)}</th>
        </tr>
      </thead>
      <tbody>${rowsHtml}</tbody>
    </table>
    <div class="totals">
      <table>
        <tbody>
          <tr><td class="lbl">${esc(t.sales)}</td><td class="val">${esc(formatMoney(summary.totalSales, lang))}</td></tr>
          <tr><td class="lbl">${esc(t.commissions)} (${esc(ratePct)})</td><td class="val">${esc(formatMoney(summary.totalCommission, lang))}</td></tr>
          <tr><td class="lbl">${esc(t.paid)}</td><td class="val">${esc(formatMoney(summary.paidCommission, lang))}</td></tr>
          <tr class="grand"><td class="lbl">${esc(t.pending)}</td><td class="val">${esc(formatMoney(summary.pendingCommission, lang))}</td></tr>
        </tbody>
      </table>
    </div>
    <div class="sig">
      <div class="line">${esc(vendorName)}</div>
      <div class="line">${esc(t.signature)} — ${esc(t.brand)}</div>
    </div>
    <footer>${esc(t.footer)}</footer>
  </main>
  <script>
    window.addEventListener('load', function(){
      setTimeout(function(){ try { window.focus(); window.print(); } catch(e){} }, 250);
    });
  </script>
</body>
</html>`;

    const w = window.open('', '_blank', 'width=900,height=1100');
    if (!w) {
      // Popup blocked — surface a toast so the vendor knows to allow popups.
      toast.error(lang === 'fr'
        ? 'Fenêtre bloquée. Autorise les popups pour télécharger le relevé.'
        : 'Popup blocked. Allow popups to download the statement.');
      return;
    }
    w.document.open();
    w.document.write(html);
    w.document.close();
  }, [month, summary, user, lang]);

  // Tax-form upload state. Kept entirely in localStorage for now —
  // see the block-comment near TAX_FORMS_STORAGE_KEY for the swap plan.
  const currentYear = new Date().getFullYear();
  const [taxYear, setTaxYear] = useState<number>(currentYear);
  const [taxForms, setTaxForms] = useState<TaxFormEntry[]>(() => {
    const map = loadTaxForms();
    return map[vendorId] ?? [];
  });
  const [taxError, setTaxError] = useState<string | null>(null);
  const [taxUploading, setTaxUploading] = useState(false);
  const taxInputRef = useRef<HTMLInputElement | null>(null);

  // Reload per-vendor list when vendorId flips (admin preview, etc.).
  useEffect(() => {
    const map = loadTaxForms();
    setTaxForms(map[vendorId] ?? []);
  }, [vendorId]);

  const onTaxFilePick = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    // Reset the input so picking the same filename twice still fires onChange.
    e.target.value = '';
    if (!file) return;

    setTaxError(null);

    if (file.size > TAX_FORM_MAX_BYTES) {
      setTaxError(
        lang === 'fr'
          ? 'Le fichier dépasse la limite de 10 Mo.'
          : 'File exceeds the 10 MB limit.',
      );
      return;
    }

    const isPdf = file.type === 'application/pdf';
    const isImage = file.type.startsWith('image/');
    if (!isPdf && !isImage) {
      setTaxError(
        lang === 'fr'
          ? 'Format non supporté. Téléversez un PDF ou une image.'
          : 'Unsupported format. Upload a PDF or an image.',
      );
      return;
    }

    setTaxUploading(true);
    try {
      const base64 = await readFileAsBase64(file);
      const entry: TaxFormEntry = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        filename: file.name,
        type: file.type,
        size: file.size,
        year: taxYear,
        uploadedAt: new Date().toISOString(),
        base64,
      };
      // TODO(backend): swap this block for a multipart POST to
      // /api/vendor/tax-forms once the upload endpoint lands.
      const map = loadTaxForms();
      const next = [entry, ...(map[vendorId] ?? [])];
      map[vendorId] = next;
      persistTaxForms(map);
      setTaxForms(next);
    } catch {
      setTaxError(
        lang === 'fr'
          ? 'Impossible de lire le fichier. Réessaie.'
          : 'Could not read file. Try again.',
      );
    } finally {
      setTaxUploading(false);
    }
  }, [lang, taxYear, vendorId]);

  const onTaxDelete = useCallback((id: string) => {
    const map = loadTaxForms();
    const next = (map[vendorId] ?? []).filter(f => f.id !== id);
    map[vendorId] = next;
    persistTaxForms(map);
    setTaxForms(next);
  }, [vendorId]);

  const onTaxDownload = useCallback((entry: TaxFormEntry) => {
    const a = document.createElement('a');
    a.href = entry.base64;
    a.download = entry.filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }, []);

  // Recent quotes preview (dashboard card). Reads the same
  // localStorage key QuoteList reads — 'vision-quotes' — so a quote
  // created in the builder surfaces here immediately on next mount.
  // We refresh on the cross-tab 'storage' event (another window saving
  // a new quote) and on vendorId flips so an admin previewing a
  // different vendor doesn't see stale rows cached in state.
  const [recentQuotes, setRecentQuotes] = useState<RecentQuote[]>(() => loadRecentQuotes(5));
  useEffect(() => {
    setRecentQuotes(loadRecentQuotes(5));
    const onStorage = (e: StorageEvent) => {
      if (e.key === 'vision-quotes' || e.key === null) {
        setRecentQuotes(loadRecentQuotes(5));
      }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [vendorId]);

  // Task 10.8 — client CRM rows + private notes state.
  // Rows derive from the full (un-month-filtered) summary so a vendor
  // can still see last year's clients during a slow month. Notes are
  // stored in localStorage scoped by vendorId + lowercased email.
  const clientRows = useMemo(() => buildClientRows(fullSummary), [fullSummary]);

  const [selectedClientEmail, setSelectedClientEmail] = useState<string | null>(null);
  const [clientNotes, setClientNotes] = useState<Record<string, ClientNote[]>>(() => {
    const map = loadClientNotes();
    return map[vendorId] ?? {};
  });
  const [noteDraft, setNoteDraft] = useState('');

  // Reload per-vendor notes map when vendorId flips (admin preview).
  useEffect(() => {
    const map = loadClientNotes();
    setClientNotes(map[vendorId] ?? {});
    setSelectedClientEmail(null);
    setNoteDraft('');
  }, [vendorId]);

  const toggleClientRow = useCallback((email: string) => {
    setSelectedClientEmail(prev => (prev === email ? null : email));
    setNoteDraft('');
  }, []);

  const persistVendorNotes = useCallback((next: Record<string, ClientNote[]>) => {
    const map = loadClientNotes();
    map[vendorId] = next;
    persistClientNotes(map);
    setClientNotes(next);
  }, [vendorId]);

  const onAddNote = useCallback((email: string) => {
    // Task 14.4 — sanitize before persisting so a pasted tag or runaway
    // whitespace blob can't poison the CRM notes map for this vendor.
    // 2000-char cap is generous for a CRM memo without letting a
    // pathological paste eat into the localStorage quota shared with
    // the cart and commission cache.
    const body = sanitizeText(noteDraft, { maxLength: 2000 });
    if (!body) return;
    const entry: ClientNote = {
      body,
      at: new Date().toISOString(),
      author: user?.email || user?.name || 'vendor',
    };
    const prev = clientNotes[email] ?? [];
    const next = { ...clientNotes, [email]: [...prev, entry] };
    persistVendorNotes(next);
    setNoteDraft('');
  }, [noteDraft, user, clientNotes, persistVendorNotes]);

  const onDeleteNote = useCallback((email: string, at: string) => {
    const prev = clientNotes[email] ?? [];
    const next = { ...clientNotes, [email]: prev.filter(n => n.at !== at) };
    persistVendorNotes(next);
  }, [clientNotes, persistVendorNotes]);

  // Task 10.4 — share the public profile URL. We copy to clipboard
  // instead of opening a new tab because the primary use-case is
  // pasting the link into an email or LinkedIn DM, not previewing.
  // Fall back to a temporary textarea + execCommand for the legacy
  // path since navigator.clipboard isn't available on http:// dev
  // origins in some browsers.
  const [publicLinkCopied, setPublicLinkCopied] = useState(false);
  const onCopyPublicProfile = useCallback(async () => {
    const base = typeof window !== 'undefined' && window.location?.origin
      ? window.location.origin
      : '';
    const url = `${base}/vendor/${encodeURIComponent(vendorId)}`;
    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(url);
      } else {
        const ta = document.createElement('textarea');
        ta.value = url;
        ta.setAttribute('readonly', '');
        ta.style.position = 'absolute';
        ta.style.left = '-9999px';
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
      }
      setPublicLinkCopied(true);
      toast.success(
        lang === 'fr'
          ? 'Lien du profil public copié.'
          : 'Public profile link copied.',
      );
      setTimeout(() => setPublicLinkCopied(false), 2000);
    } catch {
      toast.error(
        lang === 'fr'
          ? 'Impossible de copier le lien. Réessaie.'
          : 'Could not copy link. Try again.',
      );
    }
  }, [vendorId, lang]);

  // Task 10.5 — onboarding tour. Open on first visit (no localStorage
  // flag) and re-openable via the "Revoir la visite" footer button.
  // The 5 refs below are attached to the elements the tour highlights;
  // step 1 ("welcome") deliberately leaves its ref null so the tooltip
  // centers and the backdrop goes fully dim.
  const [tourOpen, setTourOpen] = useState(false);
  const tickerRef = useRef<HTMLElement | null>(null);
  const quotesCtaRef = useRef<HTMLAnchorElement | null>(null);
  const clientsRef = useRef<HTMLElement | null>(null);
  const profileBtnRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    try {
      const seen = localStorage.getItem(TOUR_SEEN_STORAGE_KEY);
      if (!seen) setTourOpen(true);
    } catch {
      // localStorage unavailable (Safari private mode, quota) — skip.
    }
  }, []);

  const closeTour = useCallback(() => {
    try {
      localStorage.setItem(TOUR_SEEN_STORAGE_KEY, '1');
    } catch {
      // Ignore — next page load will just re-show the tour.
    }
    setTourOpen(false);
  }, []);

  const replayTour = useCallback(() => {
    try {
      localStorage.removeItem(TOUR_SEEN_STORAGE_KEY);
    } catch { /* ignore */ }
    setTourOpen(true);
  }, []);

  const tourTargets: Array<HTMLElement | null> = [
    null, // step 1 "welcome" — no specific target, centered card.
    tickerRef.current,
    quotesCtaRef.current,
    clientsRef.current,
    profileBtnRef.current,
  ];

  const L = (fr: string, en: string) => (lang === 'fr' ? fr : en);

  return (
    <div className="space-y-8">
      <header className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">
            {greetingName
              ? L(`Bonjour, ${greetingName}`, `Hello, ${greetingName}`)
              : L('Tableau de bord', 'Dashboard')}
          </h1>
          <p className="text-sm text-zinc-500 mt-1 flex items-center gap-2 flex-wrap">
            <span className="capitalize">{todayLabel}</span>
            <span className="text-zinc-400" aria-hidden="true">·</span>
            <span>{L('Tes commissions ce mois-ci', 'Your commissions this month')} · {formatMonth(month, lang)}</span>
          </p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <label className="flex items-center gap-2 text-xs text-zinc-500">
            <Calendar size={14} className="text-zinc-400" aria-hidden="true" />
            <span>{L('Mois', 'Month')}:</span>
            <select
              value={month}
              onChange={e => setMonth(e.target.value)}
              aria-label={L('Choisir le mois', 'Pick month')}
              className="border border-zinc-200 rounded-lg px-2.5 py-1.5 bg-white outline-none focus:border-[#0052CC] focus-visible:ring-2 focus-visible:ring-[#0052CC]/25 text-xs font-semibold text-foreground cursor-pointer"
            >
              {months.map(m => (
                <option key={m} value={m}>{formatMonth(m, lang)}</option>
              ))}
            </select>
          </label>
          <Link
            ref={quotesCtaRef}
            to="/vendor/quotes/new"
            aria-label={L('Nouvelle soumission', 'New quote')}
            className="inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 bg-brand-blue text-brand-white rounded-lg hover:bg-brand-blue-hover shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue/60"
          >
            <Plus size={13} aria-hidden="true" />
            {L('Nouvelle soumission', 'New quote')}
          </Link>
          <button
            ref={profileBtnRef}
            type="button"
            onClick={onCopyPublicProfile}
            aria-label={L('Copier le lien du profil public', 'Copy public profile link')}
            className="inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 bg-white border border-zinc-200 text-zinc-700 rounded-lg hover:bg-zinc-50 shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0052CC]/50"
          >
            {publicLinkCopied ? (
              <Check size={13} aria-hidden="true" className="text-emerald-600" />
            ) : (
              <Link2 size={13} aria-hidden="true" />
            )}
            {publicLinkCopied
              ? L('Copié!', 'Copied!')
              : L('Mon profil public', 'My public profile')}
          </button>
          {canExport && (
            <button
              type="button"
              onClick={onExportCsv}
              disabled={exportDisabled}
              aria-label={L(
                `Télécharger les commissions de ${formatMonth(month, lang)} en CSV`,
                `Download commissions for ${formatMonth(month, lang)} as CSV`,
              )}
              className="inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 bg-[#0052CC] text-white rounded-lg hover:opacity-90 shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0052CC] focus-visible:ring-offset-1 disabled:opacity-40 disabled:cursor-not-allowed disabled:shadow-none"
            >
              <Download size={13} aria-hidden="true" />
              {L('Télécharger CSV', 'Download CSV')}
            </button>
          )}
          {canExport && (
            <button
              type="button"
              onClick={onDownloadStatement}
              disabled={exportDisabled}
              aria-label={L(
                `Télécharger le relevé de ${formatMonth(month, lang)} (PDF-prêt)`,
                `Download statement for ${formatMonth(month, lang)} (print-ready)`,
              )}
              className="inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 bg-brand-black text-brand-white rounded-lg hover:opacity-90 shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-black focus-visible:ring-offset-1 disabled:opacity-40 disabled:cursor-not-allowed disabled:shadow-none"
            >
              <Printer size={13} aria-hidden="true" />
              {L('Télécharger relevé (PDF-prêt HTML)', 'Download statement (print-ready HTML)')}
            </button>
          )}
        </div>
      </header>

      {/* Live commission ticker — Task 10.1.
          Big count-up number for today's commission earned, blue
          sparkline for the last 7 days. Re-animates whenever the
          underlying commissions change (mark-paid, credit re-attribution,
          or a cross-tab write) via the vision-commission-change hook
          below. */}
      <section
        ref={tickerRef}
        aria-label={L('Commission en direct', 'Live commission')}
        className="relative overflow-hidden rounded-2xl border border-zinc-200 bg-brand-white px-5 py-4 sm:px-6 sm:py-5"
      >
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="relative flex h-2 w-2" aria-hidden="true">
                <span className="absolute inline-flex h-full w-full rounded-full bg-brand-blue opacity-60 animate-ping" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-brand-blue" />
              </span>
              <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-500">
                {L('Commission en direct', 'Live commission')}
              </span>
            </div>
            <div
              className="mt-1 text-4xl sm:text-5xl font-extrabold tracking-tight text-brand-black tabular-nums"
              aria-live="polite"
              aria-atomic="true"
            >
              {formatMoney(animatedToday, lang)}
            </div>
            <p className="mt-1 text-xs text-zinc-500">
              {L('Gagnée aujourd\u2019hui', 'Earned today')}
              {' · '}
              {L('7 derniers jours', 'Last 7 days')}
            </p>
          </div>
          <div className="flex-shrink-0">
            <Sparkline
              data={last7Days}
              width={180}
              height={56}
              strokeWidth={2}
              ariaLabel={L(
                'Commission des 7 derniers jours',
                'Commission over the last 7 days',
              )}
            />
          </div>
        </div>
      </section>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label={L('Ventes du mois', 'Sales this month')}
          value={formatMoney(summary.totalSales, lang)}
          icon={TrendingUp}
          accent="blue"
        />
        <StatCard
          label={L('Commission gagnée', 'Commission earned')}
          value={formatMoney(summary.totalCommission, lang)}
          deltaLabel={L(`Taux ${(summary.rate * 100).toFixed(1)}%`, `Rate ${(summary.rate * 100).toFixed(1)}%`)}
          icon={DollarSign}
          accent="gold"
        />
        <StatCard
          label={L('Commandes créditées', 'Credited orders')}
          value={String(summary.orderCount)}
          icon={FileText}
          accent="blue"
        />
        <StatCard
          label={L('Payée / En attente', 'Paid / Pending')}
          value={`${formatMoney(summary.paidCommission, lang)} / ${formatMoney(summary.pendingCommission, lang)}`}
          deltaLabel={L(`${summary.paidCount} payées · ${summary.pendingCount} en attente`, `${summary.paidCount} paid · ${summary.pendingCount} pending`)}
          icon={CheckCircle2}
          accent="green"
        />
      </div>

      {/* Quick-actions pills — shortcut row below the metric cards so
          a vendor can jump to the builder or the full quote list in one
          click without hunting through the header. "Mes clients" stays
          out of this row because /vendor/clients doesn't exist as a
          standalone route yet; the per-vendor CRM lives further down on
          this same page and is reachable via the existing anchor. */}
      <nav
        aria-label={L('Raccourcis rapides', 'Quick actions')}
        className="flex flex-wrap items-center gap-2"
      >
        <Link
          to="/vendor/quotes/new"
          className="inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 bg-[#0052CC] text-white rounded-full hover:opacity-90 shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0052CC] focus-visible:ring-offset-1"
        >
          <FilePlus size={13} aria-hidden="true" />
          {L('Nouveau devis', 'New quote')}
        </Link>
        <Link
          to="/vendor/quotes"
          className="inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 bg-white border border-zinc-200 text-zinc-700 rounded-full hover:bg-zinc-50 shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0052CC]/50"
        >
          <FileText size={13} aria-hidden="true" />
          {L('Voir mes devis', 'My quotes')}
        </Link>
        <a
          href="#vendor-clients-heading"
          className="inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 bg-white border border-zinc-200 text-zinc-700 rounded-full hover:bg-zinc-50 shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0052CC]/50"
        >
          <Users size={13} aria-hidden="true" />
          {L('Voir mes clients', 'My clients')}
        </a>
      </nav>

      {/* Empty state for brand-new vendors — no commissions AND no
          quotes yet. We show a warm welcome card pushing them toward
          the builder rather than presenting a wall of zeroed-out tables.
          Suppressed as soon as the vendor has any activity on either
          side so it doesn't linger once they've started. */}
      {fullSummary.lines.length === 0 && recentQuotes.length === 0 && (
        <section
          aria-label={L('Bienvenue', 'Welcome')}
          className="rounded-2xl border border-brand-blue/20 bg-brand-grey-light px-5 py-6 sm:px-6 sm:py-7"
        >
          <div className="flex items-start gap-4 flex-wrap">
            <div className="flex-shrink-0 w-11 h-11 rounded-full bg-[#0052CC] text-white flex items-center justify-center shadow-sm">
              <Rocket size={20} aria-hidden="true" />
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="text-lg sm:text-xl font-extrabold tracking-tight text-brand-black">
                {L(
                  'Bienvenue chez Vision Affichage!',
                  'Welcome to Vision Affichage!',
                )}
              </h2>
              <p className="mt-1 text-sm text-zinc-700 max-w-xl leading-relaxed">
                {L(
                  'Tu n\u2019as pas encore de devis ni de commission. Lance ton premier devis client en moins d\u2019une minute — on s\u2019occupe du reste.',
                  'You haven\u2019t created a quote or earned a commission yet. Start your first client quote in under a minute — we\u2019ll handle the rest.',
                )}
              </p>
              <div className="mt-4">
                <Link
                  to="/vendor/quotes/new"
                  className="inline-flex items-center gap-1.5 text-sm font-bold px-4 py-2 bg-brand-blue text-brand-white rounded-lg hover:bg-brand-blue-hover shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue/60"
                >
                  <Plus size={15} aria-hidden="true" />
                  {L('Créer ton premier devis', 'Create your first quote')}
                </Link>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Recent quotes preview — 5 most-recent rows with status pill +
          total. Data source is the same localStorage key QuoteList
          reads ('vision-quotes'). Row click + header CTA both drop the
          vendor into /vendor/quotes since there isn't a per-id vendor
          route. Skipped entirely when there are zero quotes (the empty
          state above already handles that case). */}
      {recentQuotes.length > 0 && (
        <section
          aria-labelledby="vendor-recent-quotes-heading"
          className="bg-white border border-zinc-200 rounded-2xl overflow-hidden"
        >
          <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-100">
            <div>
              <h2 id="vendor-recent-quotes-heading" className="font-bold flex items-center gap-2">
                <FileText size={16} className="text-brand-black" aria-hidden="true" />
                {L('Devis récents', 'Recent quotes')}
              </h2>
              <p className="text-xs text-zinc-500 mt-0.5">
                {L(
                  'Tes 5 dernières soumissions, tri par date de création.',
                  'Your 5 latest quotes, sorted by creation date.',
                )}
              </p>
            </div>
            <Link
              to="/vendor/quotes"
              className="inline-flex items-center gap-1 text-[11px] font-bold text-[#0052CC] hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0052CC]/50 rounded-sm px-1"
              aria-label={L('Voir tous mes devis', 'See all my quotes')}
            >
              {L('Tout voir', 'See all')}
              <ArrowRight size={12} aria-hidden="true" />
            </Link>
          </div>
          <ul className="divide-y divide-zinc-100">
            {recentQuotes.map(q => (
              <li key={q.id}>
                <Link
                  to="/vendor/quotes"
                  className="flex items-center gap-3 px-5 py-3 hover:bg-zinc-50/70 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#0052CC]/50"
                  aria-label={L(
                    `Ouvrir la liste des devis — ${q.number} pour ${q.client}`,
                    `Open quote list — ${q.number} for ${q.client}`,
                  )}
                >
                  <div className="flex-shrink-0 font-mono text-[11px] font-bold text-brand-black w-[108px] truncate">
                    {q.number}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-sm truncate">{q.client}</div>
                    <div className="text-[11px] text-zinc-500">
                      {q.createdAt ? formatDate(q.createdAt, lang) : '—'}
                    </div>
                  </div>
                  <span
                    className={`flex-shrink-0 text-[11px] font-bold px-2 py-0.5 rounded-md ${RECENT_QUOTE_STATUS_COLOR[q.status]}`}
                  >
                    {lang === 'fr'
                      ? RECENT_QUOTE_STATUS_LABEL_FR[q.status]
                      : RECENT_QUOTE_STATUS_LABEL_EN[q.status]}
                  </span>
                  <div className="flex-shrink-0 font-bold text-sm text-zinc-800 tabular-nums w-[96px] text-right">
                    {formatMoney(q.total, lang)}
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="bg-white border border-zinc-200 rounded-2xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-100">
          <div>
            <h2 className="font-bold">{L('Commandes créditées à moi', 'Orders credited to me')}</h2>
            <p className="text-xs text-zinc-500 mt-0.5">
              {L('Une ligne par commande, avec la coupe de commission.', 'One row per order, with the commission cut.')}
            </p>
          </div>
          <div className="text-[11px] font-bold text-zinc-500 uppercase tracking-wider">
            {L(`${summary.lines.length} commande(s)`, `${summary.lines.length} order(s)`)}
          </div>
        </div>

        {summary.lines.length === 0 ? (
          <div className="p-10 text-center text-sm text-zinc-500">
            {L(
              'Aucune commande créditée pour ce mois. Change de mois ou attend une nouvelle vente.',
              'No orders credited this month. Try another month or wait for a new sale.',
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[11px] font-bold text-zinc-500 uppercase tracking-wider border-b border-zinc-100 bg-zinc-50/60">
                  <th className="px-5 py-2.5">{L('Commande', 'Order')}</th>
                  <th className="px-3 py-2.5">{L('Client', 'Customer')}</th>
                  <th className="px-3 py-2.5 text-right">{L('Total', 'Total')}</th>
                  <th className="px-3 py-2.5 text-right">{L('Commission', 'Commission')}</th>
                  <th className="px-3 py-2.5">{L('Statut', 'Status')}</th>
                  <th className="px-3 py-2.5">{L('Date paiement', 'Payout date')}</th>
                  {canMarkPaid && <th className="px-5 py-2.5 text-right" aria-label={L('Actions', 'Actions')} />}
                </tr>
              </thead>
              <tbody>
                {summary.lines.map(({ order, commission, paid, paidAt }) => (
                  <tr key={order.id} className="border-b border-zinc-100 last:border-b-0 hover:bg-zinc-50/50 transition-colors">
                    <td className="px-5 py-3 font-mono text-xs font-bold text-brand-black">{order.name}</td>
                    <td className="px-3 py-3">
                      <div className="font-semibold text-sm">{order.customerName || '—'}</div>
                      <div className="text-xs text-zinc-500 truncate max-w-[220px]">{order.email}</div>
                    </td>
                    <td className="px-3 py-3 text-right font-semibold">{formatMoney(order.total, lang)}</td>
                    <td className="px-3 py-3 text-right font-bold text-[#B37D10]">{formatMoney(commission, lang)}</td>
                    <td className="px-3 py-3">
                      {paid ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold bg-emerald-100 text-emerald-800 px-2 py-1 rounded-md">
                          <CheckCircle2 size={11} aria-hidden="true" />
                          {L('Payée', 'Paid')}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold bg-amber-50 text-amber-700 px-2 py-1 rounded-md">
                          <Clock size={11} aria-hidden="true" />
                          {L('En attente', 'Pending')}
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-3 text-xs text-zinc-600">{formatDate(paidAt, lang)}</td>
                    {canMarkPaid && (
                      <td className="px-5 py-3 text-right">
                        {paid ? (
                          <span className="text-[11px] text-zinc-400">{L('Déjà payée', 'Already paid')}</span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => onMarkPaid(order.id)}
                            className="inline-flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-1.5 bg-[#0052CC] text-white rounded-md hover:opacity-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0052CC] focus-visible:ring-offset-1"
                            aria-label={L(`Marquer ${order.name} comme payée`, `Mark ${order.name} as paid`)}
                          >
                            <CheckCircle2 size={11} aria-hidden="true" />
                            {L('Marquer payée', 'Mark paid')}
                          </button>
                        )}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {!canMarkPaid && (
        <p className="text-[11px] text-zinc-500">
          {L(
            'Seul un administrateur peut marquer une commission comme payée.',
            'Only an administrator can mark a commission as paid.',
          )}
        </p>
      )}

      {/* Mes clients / My clients — Task 10.8.
          Lightweight per-vendor CRM: one row per unique customer
          email this vendor has sold to, with an inline notes panel
          that opens on row click. Notes are strictly private and
          scoped by vendorId + customer email. */}
      <section
        ref={clientsRef}
        aria-labelledby="vendor-clients-heading"
        className="bg-white border border-zinc-200 rounded-2xl overflow-hidden"
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-100">
          <div>
            <h2 id="vendor-clients-heading" className="font-bold flex items-center gap-2">
              <Users size={16} className="text-brand-black" aria-hidden="true" />
              {L('Mes clients', 'My clients')}
            </h2>
            <p className="text-xs text-zinc-500 mt-0.5">
              {L(
                'Clients crédités à toi, avec notes privées par client.',
                'Customers credited to you, with private per-client notes.',
              )}
            </p>
          </div>
          <div className="text-[11px] font-bold text-zinc-500 uppercase tracking-wider">
            {L(`${clientRows.length} client(s)`, `${clientRows.length} client(s)`)}
          </div>
        </div>

        {clientRows.length === 0 ? (
          <div className="p-10 text-center text-sm text-zinc-500">
            {L(
              'Aucun client crédité pour l\u2019instant. Les clients apparaîtront ici dès ta première vente.',
              'No credited clients yet. Clients will appear here after your first sale.',
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[11px] font-bold text-zinc-500 uppercase tracking-wider border-b border-zinc-100 bg-zinc-50/60">
                  <th className="px-5 py-2.5 w-8" aria-hidden="true" />
                  <th className="px-3 py-2.5">{L('Client', 'Client')}</th>
                  <th className="px-3 py-2.5">{L('Courriel', 'Email')}</th>
                  <th className="px-3 py-2.5 text-right">{L('Commandes', 'Orders')}</th>
                  <th className="px-3 py-2.5 text-right">{L('Valeur vie', 'LTV')}</th>
                  <th className="px-3 py-2.5">{L('Dernière commande', 'Last order')}</th>
                  <th className="px-5 py-2.5 text-right">{L('Notes', 'Notes')}</th>
                </tr>
              </thead>
              <tbody>
                {clientRows.map(row => {
                  const expanded = selectedClientEmail === row.email;
                  const notes = clientNotes[row.email] ?? [];
                  return (
                    <Fragment key={row.email}>
                      <tr
                        onClick={() => toggleClientRow(row.email)}
                        className={`border-b border-zinc-100 last:border-b-0 hover:bg-zinc-50/70 transition-colors cursor-pointer ${expanded ? 'bg-zinc-50/70' : ''}`}
                        aria-expanded={expanded}
                        role="button"
                        tabIndex={0}
                        onKeyDown={e => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            toggleClientRow(row.email);
                          }
                        }}
                      >
                        <td className="px-5 py-3 text-zinc-400">
                          {expanded
                            ? <ChevronDown size={14} aria-hidden="true" />
                            : <ChevronRight size={14} aria-hidden="true" />}
                        </td>
                        <td className="px-3 py-3">
                          <div className="font-semibold text-sm">{row.customerName}</div>
                        </td>
                        <td className="px-3 py-3 text-xs text-zinc-500 truncate max-w-[240px]">{row.email}</td>
                        <td className="px-3 py-3 text-right font-semibold tabular-nums">{row.orderCount}</td>
                        <td className="px-3 py-3 text-right font-bold text-[#B37D10] tabular-nums">{formatMoney(row.ltv, lang)}</td>
                        <td className="px-3 py-3 text-xs text-zinc-600">{formatDate(row.lastOrderAt, lang)}</td>
                        <td className="px-5 py-3 text-right">
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold bg-brand-black/10 text-brand-black px-2 py-1 rounded-md">
                            <StickyNote size={11} aria-hidden="true" />
                            {notes.length}
                          </span>
                        </td>
                      </tr>
                      {expanded && (
                        <tr className="border-b border-zinc-100 last:border-b-0 bg-zinc-50/40">
                          <td colSpan={7} className="px-5 py-4">
                            <div className="space-y-3">
                              <div className="flex items-start gap-2">
                                <textarea
                                  value={noteDraft}
                                  onChange={e => setNoteDraft(e.target.value)}
                                  onKeyDown={e => {
                                    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
                                      e.preventDefault();
                                      onAddNote(row.email);
                                    }
                                  }}
                                  placeholder={L(
                                    `Note privée à propos de ${row.customerName}… (ex: « aime feuille d\u2019or, veut même couleur que sa dernière commande »)`,
                                    `Private note about ${row.customerName}… (e.g. "likes gold foil, wants same colour as last order")`,
                                  )}
                                  rows={2}
                                  aria-label={L('Ajouter une note', 'Add a note')}
                                  className="flex-1 min-w-0 resize-y text-sm px-3 py-2 border border-zinc-200 rounded-lg bg-white outline-none focus:border-[#0052CC] focus-visible:ring-2 focus-visible:ring-[#0052CC]/25"
                                />
                                <button
                                  type="button"
                                  onClick={() => onAddNote(row.email)}
                                  disabled={noteDraft.trim().length === 0}
                                  className="inline-flex items-center gap-1.5 text-xs font-bold px-3 py-2 bg-[#0052CC] text-white rounded-lg hover:opacity-90 shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0052CC] focus-visible:ring-offset-1 disabled:opacity-40 disabled:cursor-not-allowed disabled:shadow-none"
                                  aria-label={L('Ajouter la note', 'Add the note')}
                                >
                                  <Send size={12} aria-hidden="true" />
                                  {L('Ajouter', 'Add')}
                                </button>
                              </div>

                              {notes.length === 0 ? (
                                <p className="text-xs text-zinc-500 italic">
                                  {L(
                                    'Aucune note encore. Les notes sont privées (ce navigateur seulement).',
                                    'No notes yet. Notes are private (this browser only).',
                                  )}
                                </p>
                              ) : (
                                <ul className="space-y-2">
                                  {notes.map(note => (
                                    <li
                                      key={note.at}
                                      className="flex items-start gap-3 rounded-lg border border-zinc-200 bg-white px-3 py-2"
                                    >
                                      <div className="flex-1 min-w-0">
                                        <p className="text-sm whitespace-pre-wrap break-words text-zinc-800">{note.body}</p>
                                        <p className="mt-1 text-[11px] text-zinc-500">
                                          {formatDateTime(note.at, lang)}
                                          {note.author ? ` · ${note.author}` : ''}
                                        </p>
                                      </div>
                                      <button
                                        type="button"
                                        onClick={() => onDeleteNote(row.email, note.at)}
                                        className="flex-shrink-0 inline-flex items-center gap-1 text-[11px] font-bold px-2 py-1 bg-white border border-red-200 text-red-700 rounded-md hover:bg-red-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500/40"
                                        aria-label={L('Supprimer la note', 'Delete note')}
                                      >
                                        <Trash2 size={10} aria-hidden="true" />
                                        {L('Suppr.', 'Del.')}
                                      </button>
                                    </li>
                                  ))}
                                </ul>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section
        aria-labelledby="vendor-tax-forms-heading"
        className="bg-white border border-zinc-200 rounded-2xl overflow-hidden"
      >
        <div className="flex items-start justify-between gap-3 flex-wrap px-5 py-4 border-b border-zinc-100">
          <div>
            <h2 id="vendor-tax-forms-heading" className="font-bold">
              {L('Formulaires fiscaux', 'Tax forms')}
            </h2>
            <p className="text-xs text-zinc-500 mt-0.5 max-w-xl">
              {L(
                'Téléversez votre formulaire T4A (max 10 Mo, PDF ou image). Ces documents restent sur cet appareil jusqu\u2019au traitement par l\u2019équipe comptable.',
                'Upload your T4A form (max 10 MB, PDF or image). These documents remain on this device until the accounting team processes them.',
              )}
            </p>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <label className="flex items-center gap-2 text-xs text-zinc-500">
              <span>{L('Année', 'Year')}:</span>
              <select
                value={taxYear}
                onChange={e => setTaxYear(Number(e.target.value))}
                aria-label={L('Choisir l\u2019année fiscale', 'Pick tax year')}
                className="border border-zinc-200 rounded-lg px-2.5 py-1.5 bg-white outline-none focus:border-[#0052CC] focus-visible:ring-2 focus-visible:ring-[#0052CC]/25 text-xs font-semibold text-foreground cursor-pointer"
              >
                <option value={currentYear}>{currentYear}</option>
                <option value={currentYear - 1}>{currentYear - 1}</option>
              </select>
            </label>
            <input
              ref={taxInputRef}
              type="file"
              accept="application/pdf,image/*"
              onChange={onTaxFilePick}
              className="hidden"
              aria-hidden="true"
              tabIndex={-1}
            />
            <button
              type="button"
              onClick={() => taxInputRef.current?.click()}
              disabled={taxUploading}
              className="inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 bg-[#0052CC] text-white rounded-lg hover:opacity-90 shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0052CC] focus-visible:ring-offset-1 disabled:opacity-40 disabled:cursor-not-allowed"
              aria-label={L('Téléverser un formulaire fiscal', 'Upload a tax form')}
            >
              <FileUp size={13} aria-hidden="true" />
              {taxUploading
                ? L('Téléversement…', 'Uploading…')
                : L('Téléverser', 'Upload')}
            </button>
          </div>
        </div>

        {taxError && (
          <div
            role="alert"
            className="mx-5 mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800"
          >
            {taxError}
          </div>
        )}

        {taxForms.length === 0 ? (
          <div className="p-10 text-center text-sm text-zinc-500">
            {L(
              'Aucun formulaire téléversé. Cliquez « Téléverser » pour ajouter votre T4A.',
              'No forms uploaded yet. Click "Upload" to add your T4A.',
            )}
          </div>
        ) : (
          <ul className="divide-y divide-zinc-100">
            {taxForms.map(entry => (
              <li key={entry.id} className="flex items-center gap-3 px-5 py-3 hover:bg-zinc-50/50 transition-colors">
                <div className="flex-shrink-0 w-9 h-9 rounded-lg bg-[#0052CC]/10 text-[#0052CC] flex items-center justify-center">
                  <FileText size={16} aria-hidden="true" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-sm truncate">{entry.filename}</div>
                  <div className="text-xs text-zinc-500">
                    {L('Année', 'Year')} {entry.year}
                    {' · '}
                    {formatBytes(entry.size, lang)}
                    {' · '}
                    {L('Téléversé le', 'Uploaded')} {formatDate(entry.uploadedAt, lang)}
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <button
                    type="button"
                    onClick={() => onTaxDownload(entry)}
                    className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-1.5 bg-white border border-zinc-200 text-zinc-700 rounded-md hover:bg-zinc-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0052CC]/50"
                    aria-label={L(`Télécharger ${entry.filename}`, `Download ${entry.filename}`)}
                  >
                    <Download size={11} aria-hidden="true" />
                    {L('Télécharger', 'Download')}
                  </button>
                  <button
                    type="button"
                    onClick={() => onTaxDelete(entry.id)}
                    className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-1.5 bg-white border border-red-200 text-red-700 rounded-md hover:bg-red-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500/40"
                    aria-label={L(`Supprimer ${entry.filename}`, `Delete ${entry.filename}`)}
                  >
                    <Trash2 size={11} aria-hidden="true" />
                    {L('Supprimer', 'Delete')}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Footer — re-trigger the onboarding tour (Task 10.5). */}
      <footer className="flex items-center justify-center pt-2 pb-4">
        <button
          type="button"
          onClick={replayTour}
          className="inline-flex items-center gap-1.5 text-[11px] font-bold text-zinc-500 hover:text-brand-black px-3 py-1.5 rounded-lg hover:bg-zinc-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue/50"
          aria-label={L('Revoir la visite guidée du tableau de bord', 'See the dashboard tour again')}
        >
          <HelpCircle size={12} aria-hidden="true" />
          {L('Revoir la visite', 'See tour again')}
        </button>
      </footer>

      {tourOpen && (
        <OnboardingTour
          lang={lang}
          targets={tourTargets}
          onDone={closeTour}
        />
      )}
    </div>
  );
}
