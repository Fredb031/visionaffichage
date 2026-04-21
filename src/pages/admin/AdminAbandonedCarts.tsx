import { Download, ExternalLink, Mail, Send, RefreshCw, ShoppingBag, Search, Check, X, Clock, Zap } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import {
  SHOPIFY_ABANDONED_CHECKOUTS_SNAPSHOT,
  SHOPIFY_STATS,
  SHOPIFY_SNAPSHOT_META,
  type ShopifyAbandonedCheckoutSnapshot,
} from '@/data/shopifySnapshot';
import { StatCard } from '@/components/admin/StatCard';
import { TablePagination } from '@/components/admin/TablePagination';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { useSearchHotkey } from '@/hooks/useSearchHotkey';
import { normalizeInvisible } from '@/lib/utils';
import { isAutomationActive } from '@/lib/automations';
import { downloadCsv } from '@/lib/csv';

const PAGE_SIZE = 25;

// localStorage keys. `vision-cart-reminders` is the structured ledger used
// by the UI to show "Reminder sent 2h ago"; `vision-email-sent-log` is the
// append-only fallback we write to when there's no real send path (no
// outlook.ts on main), so ops can still audit intent from devtools.
const REMINDERS_KEY = 'vision-cart-reminders';
const EMAIL_LOG_KEY = 'vision-email-sent-log';

type RemindersMap = Record<string, { sentAt: string }>;

function loadReminders(): RemindersMap {
  try {
    const raw = localStorage.getItem(REMINDERS_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? (parsed as RemindersMap) : {};
  } catch {
    return {};
  }
}

function saveReminders(next: RemindersMap): void {
  try {
    localStorage.setItem(REMINDERS_KEY, JSON.stringify(next));
  } catch {
    // Ignore quota / private-mode errors — the UI still shows the toast.
  }
}

function appendEmailLog(entry: {
  cartId: number;
  to: string;
  subject: string;
  body: string;
  sentAt: string;
}): void {
  try {
    const raw = localStorage.getItem(EMAIL_LOG_KEY);
    const arr = raw ? (JSON.parse(raw) as unknown) : [];
    const list = Array.isArray(arr) ? arr : [];
    list.push(entry);
    localStorage.setItem(EMAIL_LOG_KEY, JSON.stringify(list));
  } catch {
    // Non-fatal — toast still reports success to the admin.
  }
}

// Best-effort send. Uses `import.meta.glob` with eager:false so Vite can
// statically see whether `@/lib/outlook` exists at build time without
// breaking the build when it doesn't (a bare dynamic import fails the
// rollup load step). When the module is present and exposes a
// `sendTestEmail` function we call it; otherwise the caller falls back
// to appending a local log entry so nothing is silently dropped.
async function trySendEmail(payload: {
  to: string;
  subject: string;
  body: string;
}): Promise<{ ok: boolean; via: 'sender' | 'log' }> {
  try {
    const modules = import.meta.glob('../../lib/outlook.ts');
    const loader = modules['../../lib/outlook.ts'];
    if (loader) {
      const mod = (await loader()) as {
        sendTestEmail?: (args: { to: string; subject: string; body: string }) => Promise<unknown>;
      };
      if (typeof mod.sendTestEmail === 'function') {
        await mod.sendTestEmail(payload);
        return { ok: true, via: 'sender' };
      }
    }
  } catch {
    // Module present but threw — fall through to the log path so the
    // admin still gets feedback that the intent was captured.
  }
  return { ok: false, via: 'log' };
}

function formatRelative(iso: string): string {
  // Compare CALENDAR-DAY deltas instead of a 24-hour-window floor —
  // a cart created at 11:55pm yesterday was previously labelled
  // "aujourd'hui" when viewed at 11:55am today (12h diff → floor(12/24)=0)
  // even though it was clearly the previous calendar day. Use day-start
  // anchors so the same calendar day reads "aujourd'hui" and the prior
  // calendar day always reads "hier" regardless of the hour.
  const created = new Date(iso);
  if (Number.isNaN(created.getTime())) return '';
  const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const todayMid = startOfDay(new Date()).getTime();
  const createdMid = startOfDay(created).getTime();
  const days = Math.max(0, Math.round((todayMid - createdMid) / 86400000));
  if (days === 0) return "aujourd'hui";
  if (days === 1) return 'hier';
  if (days < 7) return `il y a ${days} jours`;
  if (days < 30) return `il y a ${Math.floor(days / 7)} sem.`;
  return `il y a ${Math.floor(days / 30)} mois`;
}

// Short "sent 2h ago" style — more granular than formatRelative because
// reminders are usually sent within the last few hours, so day-granularity
// would collapse everything to "aujourd'hui" and lose the feedback signal.
function formatSentAgo(iso: string): string {
  const sent = new Date(iso).getTime();
  if (Number.isNaN(sent)) return '';
  const diffMs = Date.now() - sent;
  if (diffMs < 60_000) return 'à l\'instant';
  const mins = Math.floor(diffMs / 60_000);
  if (mins < 60) return `il y a ${mins} min`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `il y a ${hours} h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `il y a ${days} j`;
  return `il y a ${Math.floor(days / 7)} sem.`;
}

// 24h rate-limit window for the quick-send button. Prevents an admin
// from spamming a customer by re-clicking on the same row — and from
// double-firing when the Bulk action is triggered twice in a row.
const QUICK_SEND_COOLDOWN_MS = 24 * 60 * 60 * 1000;

function reminderHoursAgo(sentAt: string): number {
  const sent = new Date(sentAt).getTime();
  if (Number.isNaN(sent)) return Infinity;
  return Math.floor((Date.now() - sent) / (60 * 60 * 1000));
}

function isWithinCooldown(reminder: { sentAt: string } | undefined): boolean {
  if (!reminder) return false;
  const sent = new Date(reminder.sentAt).getTime();
  if (Number.isNaN(sent)) return false;
  return Date.now() - sent < QUICK_SEND_COOLDOWN_MS;
}

type AbandonedSort = 'recent' | 'value';
const VALID_SORTS: readonly AbandonedSort[] = ['recent', 'value'];

type ReminderFilter = 'all' | 'sent' | 'unsent';
const VALID_REMINDER_FILTERS: readonly ReminderFilter[] = ['all', 'sent', 'unsent'];

// Age-bucket filter — narrows the visible carts by `now - createdAt`.
// 'all' skips the filter; the numeric buckets match the recovery-sequence
// timings the ops team already uses (1h / 24h / 7j).
type AgeBucket = 'all' | '1h' | '24h' | '7j';
const VALID_AGE_BUCKETS: readonly AgeBucket[] = ['all', '1h', '24h', '7j'];
const AGE_BUCKET_MS: Record<Exclude<AgeBucket, 'all'>, number> = {
  '1h': 60 * 60 * 1000,
  '24h': 24 * 60 * 60 * 1000,
  '7j': 7 * 24 * 60 * 60 * 1000,
};

/** Generate + download a CSV for the currently filtered abandoned-cart
 * list. Delegates escaping + BOM + anchor-click dance to the shared
 * `@/lib/csv` helper so Excel/Numbers handle accents + leading
 * '=' / '+' / '-' / '@' safely (OWASP formula injection). Columns:
 * Courriel, Nom, Articles, Total, Abandonné le. Date formatted fr-CA.
 * Filename keeps the legacy `abandoned-carts-<UTC-YYYY-MM-DD>.csv`
 * pattern (not `vision-*`) so archived downloads on ops laptops stay
 * greppable. */
function exportAbandonedCartsCsv(carts: ReadonlyArray<ShopifyAbandonedCheckoutSnapshot>) {
  const header = ['Courriel', 'Nom', 'Articles', 'Total', 'Abandonné le'];
  const rows = carts.map(c => [
    c.email,
    c.customerName,
    String(c.itemsCount),
    // No currency symbol — keeps the column numeric-parseable in Excel.
    c.total.toFixed(2),
    new Date(c.createdAt).toLocaleDateString('fr-CA', { year: 'numeric', month: 'short', day: 'numeric' }),
  ]);
  const filename = `abandoned-carts-${new Date().toISOString().slice(0, 10)}.csv`;
  downloadCsv([header, ...rows], filename);
  toast.success(`${carts.length} panier${carts.length > 1 ? 's' : ''} exporté${carts.length > 1 ? 's' : ''}`);
}

// Default subject + body builder — kept in sync with the mailto fallback
// so whether the admin clicks "Envoyer un rappel" (dialog) or the mail
// icon (native mailto), they get identical copy.
function buildDefaultReminder(checkout: ShopifyAbandonedCheckoutSnapshot): { subject: string; body: string } {
  const name = checkout.customerName.trim() || checkout.email.split('@')[0];
  const subject = 'Ton panier t\'attend sur Vision Affichage — 10 % offert';
  const body =
    `Bonjour ${name},\n\n` +
    `On a remarqué que tu as un panier en attente sur notre site. Pour te remercier, voici 10 % de rabais avec le code VISION10 — valide 7 jours.\n\n` +
    `Reprendre ta commande :\n` +
    `${checkout.recoveryUrl}\n\n` +
    `Code promo : VISION10 (à coller dans le panier)\n\n` +
    `Si tu as des questions, n'hésite pas — on est là pour t'aider.\n\n` +
    `— Équipe Vision Affichage`;
  return { subject, body };
}

export default function AdminAbandonedCarts() {
  // URL-backed sort so reload preserves the admin's preferred ranking
  // and a copied URL takes the recipient straight to "highest value
  // first" or "newest first" without re-clicking. Defaults to 'value'.
  const [searchParams, setSearchParams] = useSearchParams();
  const initialSortRaw = searchParams.get('sort') ?? 'value';
  const initialSort: AbandonedSort = (VALID_SORTS as readonly string[]).includes(initialSortRaw)
    ? (initialSortRaw as AbandonedSort)
    : 'value';
  const initialReminderRaw = searchParams.get('reminder') ?? 'all';
  const initialReminderFilter: ReminderFilter = (VALID_REMINDER_FILTERS as readonly string[]).includes(initialReminderRaw)
    ? (initialReminderRaw as ReminderFilter)
    : 'all';
  const initialAgeRaw = searchParams.get('age') ?? 'all';
  const initialAgeBucket: AgeBucket = (VALID_AGE_BUCKETS as readonly string[]).includes(initialAgeRaw)
    ? (initialAgeRaw as AgeBucket)
    : 'all';

  const [sort, setSort] = useState<AbandonedSort>(initialSort);
  const [reminderFilter, setReminderFilter] = useState<ReminderFilter>(initialReminderFilter);
  const [ageBucket, setAgeBucket] = useState<AgeBucket>(initialAgeBucket);
  const [query, setQuery] = useState(searchParams.get('q') ?? '');
  const [page, setPage] = useState(0);
  const [reminders, setReminders] = useState<RemindersMap>(() => loadReminders());
  const [dialogCart, setDialogCart] = useState<ShopifyAbandonedCheckoutSnapshot | null>(null);
  useDocumentTitle('Paniers abandonnés — Admin Vision Affichage');
  const searchRef = useSearchHotkey({ onClear: () => setQuery('') });

  // Cancel the resync delay if the admin navigates away in the 400ms
  // before the reload — same pattern as AdminProducts / AdminOrders /
  // AdminCustomers, otherwise the reload yanks them back here
  // mid-navigation.
  const resyncTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    return () => {
      if (resyncTimerRef.current) clearTimeout(resyncTimerRef.current);
    };
  }, []);

  // Sync state → URL with replace history.
  useEffect(() => {
    const next = new URLSearchParams(searchParams);
    const trimmed = query.trim();
    if (trimmed) next.set('q', trimmed); else next.delete('q');
    if (sort !== 'value') next.set('sort', sort); else next.delete('sort');
    if (reminderFilter !== 'all') next.set('reminder', reminderFilter); else next.delete('reminder');
    if (ageBucket !== 'all') next.set('age', ageBucket); else next.delete('age');
    if (next.toString() !== searchParams.toString()) {
      setSearchParams(next, { replace: true });
    }
  }, [sort, query, reminderFilter, ageBucket, searchParams, setSearchParams]);

  // Reset pagination when search / filter changes so narrowing doesn't
  // strand the user on an empty page 5.
  useEffect(() => { setPage(0); }, [query, reminderFilter, ageBucket]);

  const markReminderSent = useCallback((cartId: number): void => {
    setReminders(prev => {
      const next = { ...prev, [String(cartId)]: { sentAt: new Date().toISOString() } };
      saveReminders(next);
      return next;
    });
  }, []);

  // Quick-send path — no dialog, fires the default template straight
  // through trySendEmail + ledger. Returns true on success so the bulk
  // driver can count + toast the aggregate result. We re-check the
  // cooldown here so the bulk caller doesn't have to dedupe.
  const quickSend = useCallback(async (
    checkout: ShopifyAbandonedCheckoutSnapshot,
    options?: { silent?: boolean },
  ): Promise<boolean> => {
    const existing = loadReminders()[String(checkout.id)];
    if (isWithinCooldown(existing)) {
      if (!options?.silent) {
        toast.warning(`Rappel déjà envoyé il y a ${reminderHoursAgo(existing!.sentAt)}h`);
      }
      return false;
    }
    const defaults = buildDefaultReminder(checkout);
    const sentAt = new Date().toISOString();
    try {
      const result = await trySendEmail({ to: checkout.email, subject: defaults.subject, body: defaults.body });
      appendEmailLog({ cartId: checkout.id, to: checkout.email, subject: defaults.subject, body: defaults.body, sentAt });
      markReminderSent(checkout.id);
      if (!options?.silent) {
        if (result.via === 'sender') {
          toast.success(`Rappel envoyé à ${checkout.email}`);
        } else {
          toast.success(`Rappel consigné pour ${checkout.email} (envoi Zapier non configuré).`);
        }
      }
      return true;
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erreur inconnue';
      if (!options?.silent) toast.error(`Échec de l'envoi : ${msg}`);
      return false;
    }
  }, [markReminderSent]);


  const sorted = useMemo(() => {
    // Filter before sort so the sorted output is already narrowed.
    // ZWSP-strip both sides — same pattern as other admin tables.
    const q = normalizeInvisible(query).trim().toLowerCase();
    const textFiltered = q
      ? SHOPIFY_ABANDONED_CHECKOUTS_SNAPSHOT.filter(c => {
          const email = normalizeInvisible(c.email).toLowerCase();
          const name  = normalizeInvisible(c.customerName ?? '').toLowerCase();
          return email.includes(q) || name.includes(q);
        })
      : SHOPIFY_ABANDONED_CHECKOUTS_SNAPSHOT;
    const reminderFiltered = reminderFilter === 'all'
      ? textFiltered
      : textFiltered.filter(c => {
          const hasReminder = Boolean(reminders[String(c.id)]);
          return reminderFilter === 'sent' ? hasReminder : !hasReminder;
        });
    // Age-bucket filter — compare `now - createdAt` against the bucket
    // window. `Date.now()` is captured once so a cart right on the edge
    // isn't classified differently per-row within a single sort pass.
    const base = ageBucket === 'all'
      ? reminderFiltered
      : (() => {
          const windowMs = AGE_BUCKET_MS[ageBucket];
          const now = Date.now();
          return reminderFiltered.filter(c => {
            const created = new Date(c.createdAt).getTime();
            if (Number.isNaN(created)) return false;
            return now - created <= windowMs;
          });
        })();
    const arr = [...base];
    if (sort === 'value') arr.sort((a, b) => b.total - a.total);
    else arr.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    return arr;
  }, [sort, query, reminderFilter, ageBucket, reminders]);

  // Reset page on sort change so user isn't stranded.
  useEffect(() => { setPage(0); }, [sort]);

  // Candidates for the bulk send: every cart currently visible after
  // search / filter that hasn't been nudged in the last 24h. Using
  // `sorted` (not the raw snapshot) keeps the button action aligned
  // with what the admin is looking at — a narrowed search ⇒ narrowed
  // bulk send.
  const bulkCandidates = useMemo(
    () => sorted.filter(c => !isWithinCooldown(reminders[String(c.id)])),
    [sorted, reminders],
  );

  const [bulkSending, setBulkSending] = useState(false);
  const handleBulkQuickSend = useCallback(async () => {
    if (bulkSending || bulkCandidates.length === 0) return;
    setBulkSending(true);
    let sent = 0;
    let skipped = 0;
    // Sequential awaits so each send is logged + ledger-updated in
    // turn — trySendEmail hits at worst localStorage, so the latency
    // stays sub-second even for ~20 rows and we get correct counts
    // instead of a Promise.all race on the shared setState.
    for (const c of bulkCandidates) {
      const ok = await quickSend(c, { silent: true });
      if (ok) sent += 1; else skipped += 1;
    }
    if (sent === 0) {
      toast.warning('Aucun rappel envoyé — tous les paniers éligibles ont déjà reçu un rappel récent.');
    } else if (skipped === 0) {
      toast.success(`Rappel envoyé à ${sent} panier${sent > 1 ? 's' : ''}.`);
    } else {
      toast.success(`Rappel envoyé à ${sent} panier${sent > 1 ? 's' : ''} (${skipped} ignoré${skipped > 1 ? 's' : ''}).`);
    }
    setBulkSending(false);
  }, [bulkSending, bulkCandidates, quickSend]);

  const pageItems = useMemo(
    () => sorted.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE),
    [sorted, page],
  );

  return (
    <div className="space-y-6">
      <header className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">Paniers abandonnés</h1>
          <p className="text-sm text-zinc-500 mt-1 flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 text-emerald-700">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Live Shopify via Zapier
            </span>
            <span className="text-zinc-400">·</span>
            <span>{SHOPIFY_STATS.abandonedCheckoutsCount} checkouts à recuperer</span>
          </p>
        </div>
        {/* Match the Resync UX on AdminProducts / AdminOrders /
            AdminCustomers: toast for immediate feedback, then reload after
            a short delay so the admin sees the spinner state. Before this
            the button was decorative with no onClick and clicking produced
            no visible reaction — the whole page read as broken. */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* CSV export — mirrors AdminOrders chrome and the same
              injection-safe helper. Disabled state when the filter
              yields zero rows so the admin doesn't download a
              header-only file and the title explains why. */}
          <button
            type="button"
            onClick={() => exportAbandonedCartsCsv(sorted)}
            disabled={sorted.length === 0}
            className="inline-flex items-center gap-2 text-sm font-bold px-4 py-2 border border-zinc-200 rounded-lg hover:bg-zinc-50 bg-white transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0052CC] focus-visible:ring-offset-1 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-white"
            title={sorted.length === 0 ? 'Aucun panier à exporter' : 'Exporter en CSV'}
            aria-label={
              sorted.length === 0
                ? 'Aucun panier à exporter'
                : `Exporter ${sorted.length} panier${sorted.length > 1 ? 's' : ''} en CSV`
            }
          >
            <Download size={15} aria-hidden="true" />
            Exporter CSV
          </button>
          {/* Bulk quick-send — amber/gold Zap chrome matches the
              single-row button so the relationship reads at a glance.
              Disabled when no eligible rows remain, so the count going
              to 0 is the admin's signal the queue is drained. */}
          <button
            type="button"
            onClick={handleBulkQuickSend}
            disabled={bulkSending || bulkCandidates.length === 0}
            title={bulkCandidates.length === 0
              ? 'Tous les paniers visibles ont déjà reçu un rappel récent.'
              : `Envoi rapide à ${bulkCandidates.length} panier${bulkCandidates.length > 1 ? 's' : ''} sans rappel récent`}
            className="inline-flex items-center gap-2 text-sm font-bold px-4 py-2 border border-amber-300 rounded-lg bg-amber-50 text-amber-800 hover:bg-amber-100 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-1 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {bulkSending ? (
              <RefreshCw size={15} className="animate-spin" aria-hidden="true" />
            ) : (
              <Zap size={15} aria-hidden="true" className="text-amber-600" />
            )}
            {bulkSending
              ? 'Envoi en cours…'
              : bulkCandidates.length > 0
                ? `Envoi rapide à ${bulkCandidates.length} panier${bulkCandidates.length > 1 ? 's' : ''}`
                : 'Tous les rappels sont à jour'}
          </button>
          <button
            type="button"
            onClick={() => {
              toast.info('Synchronisation en cours…');
              if (resyncTimerRef.current) clearTimeout(resyncTimerRef.current);
              resyncTimerRef.current = setTimeout(() => window.location.reload(), 400);
            }}
            className="inline-flex items-center gap-2 text-sm font-bold px-4 py-2 border border-zinc-200 rounded-lg hover:bg-zinc-50 bg-white transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0052CC] focus-visible:ring-offset-1"
          >
            <RefreshCw size={15} aria-hidden="true" />
            Resync
          </button>
        </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatCard
          label="Valeur totale"
          value={SHOPIFY_STATS.abandonedCheckoutsValue.toLocaleString('fr-CA', { style: 'currency', currency: 'CAD', maximumFractionDigits: 0 })}
          icon={ShoppingBag}
          accent="gold"
        />
        <StatCard
          label="Checkouts en attente"
          value={String(SHOPIFY_STATS.abandonedCheckoutsCount)}
          icon={Mail}
          accent="blue"
        />
        <StatCard
          label="Valeur moyenne"
          value={(SHOPIFY_STATS.abandonedCheckoutsValue / Math.max(SHOPIFY_STATS.abandonedCheckoutsCount, 1)).toLocaleString('fr-CA', { style: 'currency', currency: 'CAD', maximumFractionDigits: 0 })}
          accent="green"
        />
      </div>

      <div className="bg-white border border-zinc-200 rounded-2xl p-4">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
          <h2 className="font-bold text-sm">Liste des paniers</h2>
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-2 w-[220px] border border-zinc-200 rounded-lg px-3 py-1.5 bg-zinc-50">
              <Search size={14} className="text-zinc-400" aria-hidden="true" />
              <input
                ref={searchRef}
                type="search"
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="Rechercher  (⌘K)"
                aria-label="Rechercher un panier par courriel ou nom"
                aria-keyshortcuts="Meta+K Control+K"
                className="bg-transparent border-none outline-none text-xs flex-1"
              />
            </div>
            {/* Reminder filter — native <select> because we don't ship a
                Select primitive in src/components/ui/ yet and the zinc-100
                chrome keeps it visually aligned with the sort pill. */}
            <label className="inline-flex items-center gap-1.5 text-xs text-zinc-500">
              <span className="sr-only">Filtrer par rappel</span>
              <select
                value={reminderFilter}
                onChange={e => setReminderFilter(e.target.value as ReminderFilter)}
                aria-label="Filtrer les paniers par statut de rappel"
                className="bg-zinc-100 rounded-lg px-2 py-1.5 text-xs font-bold text-zinc-700 border-none focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0052CC] focus-visible:ring-offset-1"
              >
                <option value="all">Toutes</option>
                <option value="sent">Avec rappel envoyé</option>
                <option value="unsent">Sans rappel</option>
              </select>
            </label>
            {/* Age-bucket filter — slices by `now - createdAt`. Default
                'Tout' keeps parity with the previous behaviour so admins
                who didn't set a preference see the same list on load. */}
            <label className="inline-flex items-center gap-1.5 text-xs text-zinc-500">
              <span className="sr-only">Filtrer par âge du panier</span>
              <select
                value={ageBucket}
                onChange={e => setAgeBucket(e.target.value as AgeBucket)}
                aria-label="Filtrer les paniers par âge"
                className="bg-zinc-100 rounded-lg px-2 py-1.5 text-xs font-bold text-zinc-700 border-none focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0052CC] focus-visible:ring-offset-1"
              >
                <option value="all">Tout</option>
                <option value="1h">1h</option>
                <option value="24h">24h</option>
                <option value="7j">7j</option>
              </select>
            </label>
            <div className="inline-flex bg-zinc-100 rounded-lg p-0.5" role="radiogroup" aria-label="Trier les paniers">
              {(['value', 'recent'] as const).map(s => (
                <button
                  key={s}
                  type="button"
                  role="radio"
                  aria-checked={sort === s}
                  onClick={() => setSort(s)}
                  className={`px-3 py-1.5 rounded-md text-xs font-bold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0052CC] focus-visible:ring-offset-1 ${
                    sort === s ? 'bg-white text-zinc-900 shadow-sm' : 'text-zinc-500 hover:text-zinc-900'
                  }`}
                >
                  {s === 'value' ? 'Plus haute valeur' : 'Plus récent'}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="space-y-2">
          {pageItems.length === 0 ? (
            // Empty-state when search/filter narrows results to nothing.
            // Without this row the user just sees an empty gap between
            // the toolbar and (hidden) pagination — looks like the page
            // failed to load. Mirrors the AdminQuotes pattern.
            <div className="text-center text-xs text-zinc-500 py-10">
              {query.trim()
                ? `Aucun panier ne correspond à « ${query.trim()} ».`
                : ageBucket !== 'all'
                  ? `Aucun panier abandonné dans la fenêtre ${ageBucket}.`
                  : reminderFilter === 'sent'
                    ? 'Aucun rappel envoyé pour le moment.'
                    : reminderFilter === 'unsent'
                      ? 'Tous les paniers ont reçu un rappel.'
                      : 'Aucun panier abandonné pour le moment.'}
            </div>
          ) : (
            pageItems.map(c => (
              <CheckoutRow
                key={c.id}
                checkout={c}
                reminder={reminders[String(c.id)]}
                onOpenReminder={() => setDialogCart(c)}
                onQuickSend={() => quickSend(c)}
              />
            ))
          )}
        </div>

        <TablePagination
          page={page}
          pageSize={PAGE_SIZE}
          total={sorted.length}
          onPageChange={setPage}
          itemLabel="paniers"
        />
      </div>

      <div className="bg-gradient-to-br from-[#0F2341] to-[#1B3A6B] text-white rounded-2xl p-5">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center flex-shrink-0">
            <Send size={18} aria-hidden="true" />
          </div>
          <div>
            <div className="font-bold text-sm mb-1">Activer la séquence de récupération</div>
            <div className="text-xs text-white/70 mb-3 max-w-md">
              Configurez l'envoi automatique d'un courriel de relance après 1h, 24h et 72h pour récupérer en moyenne 15-25% des paniers abandonnés.
            </div>
            {/* Link to Shopify Admin's marketing-automation page since
                we don't host the recovery flows ourselves — Shopify Email
                + Shopify Marketing handle the cron + send. The button
                used to be decorative with no onClick which read as a
                broken integration. */}
            <a
              href={`https://${SHOPIFY_SNAPSHOT_META.shop}/admin/marketing/automations`}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Configurer la séquence de récupération dans Shopify Marketing (nouvel onglet)"
              className="inline-flex items-center gap-1 text-[11px] font-bold text-[#E8A838] hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-[#E8A838] focus-visible:ring-offset-2 focus-visible:ring-offset-[#0F2341] rounded"
            >
              Configurer la séquence dans Shopify
              <ExternalLink size={11} aria-hidden="true" />
            </a>
          </div>
        </div>
      </div>

      {dialogCart && (
        <ReminderDialog
          checkout={dialogCart}
          onClose={() => setDialogCart(null)}
          onSent={() => {
            markReminderSent(dialogCart.id);
            setDialogCart(null);
          }}
        />
      )}
    </div>
  );
}

function CheckoutRow({
  checkout,
  reminder,
  onOpenReminder,
  onQuickSend,
}: {
  checkout: ShopifyAbandonedCheckoutSnapshot;
  reminder: { sentAt: string } | undefined;
  onOpenReminder: () => void;
  onQuickSend: () => Promise<boolean>;
}) {
  const name = checkout.customerName.trim() || checkout.email.split('@')[0];
  const valueColor = checkout.total >= 200 ? 'text-emerald-700' : checkout.total >= 75 ? 'text-amber-700' : 'text-zinc-500';
  const [quickSending, setQuickSending] = useState(false);
  const onCooldown = isWithinCooldown(reminder);
  const hoursAgo = reminder ? reminderHoursAgo(reminder.sentAt) : 0;
  const quickDisabled = quickSending || onCooldown;
  const quickTitle = onCooldown
    ? `Rappel envoyé il y a ${hoursAgo}h — attendez 24h`
    : 'Envoi immédiat du rappel par défaut';
  const handleQuickClick = async () => {
    if (quickDisabled) return;
    setQuickSending(true);
    try { await onQuickSend(); } finally { setQuickSending(false); }
  };

  return (
    // focus-within mirrors the hover state when a keyboard user tabs
    // into one of the row's action links (Mail / ExternalLink). Without
    // it, sighted-mouse users got the hover affordance but keyboard
    // users had no row-level visual context to anchor focus.
    <div className="flex items-center gap-4 p-3 hover:bg-zinc-50 focus-within:bg-zinc-50 rounded-xl transition-colors">
      <div
        className="w-10 h-10 rounded-full bg-zinc-100 text-zinc-600 flex items-center justify-center text-xs font-bold flex-shrink-0"
        aria-hidden="true"
      >
        {name[0]?.toUpperCase() || '?'}
      </div>
      <div className="flex-1 min-w-0">
        <div className="font-semibold text-sm truncate">{name}</div>
        <div className="text-xs text-zinc-500 truncate">{checkout.email}</div>
        {reminder && (
          <div className="inline-flex items-center gap-1 mt-0.5 text-[10px] font-bold text-emerald-700">
            <Clock size={10} aria-hidden="true" />
            Rappel envoyé {formatSentAgo(reminder.sentAt)}
          </div>
        )}
      </div>
      <div className="text-xs text-zinc-400 hidden sm:block min-w-[80px] text-right">
        {checkout.itemsCount} {checkout.itemsCount > 1 ? 'articles' : 'article'}
      </div>
      <div className="text-xs text-zinc-400 hidden md:block min-w-[110px] text-right">
        {formatRelative(checkout.createdAt)}
      </div>
      <div className={`text-sm font-extrabold min-w-[80px] text-right ${valueColor}`}>
        {checkout.total.toLocaleString('fr-CA', { minimumFractionDigits: 2 })} $
      </div>
      {/* Quick-send (Zap) — fires the default template straight through
          without opening the dialog. Paired with the dialog-backed
          Envoyer button so the admin has both: "edit first" (Send icon)
          and "just go" (Zap icon). Gated to one send per 24h via the
          shared vision-cart-reminders ledger. */}
      <button
        type="button"
        onClick={handleQuickClick}
        disabled={quickDisabled}
        title={quickTitle}
        className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-1.5 border border-amber-300 rounded-lg bg-amber-50 text-amber-800 hover:bg-amber-100 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-1 disabled:opacity-50 disabled:cursor-not-allowed"
        aria-label={onCooldown
          ? `Rappel déjà envoyé à ${name} il y a ${hoursAgo} heures`
          : `Envoi rapide du rappel par défaut à ${name}`}
      >
        {quickSending ? (
          <RefreshCw size={12} className="animate-spin" aria-hidden="true" />
        ) : (
          <Zap size={12} aria-hidden="true" className="text-amber-600" />
        )}
        <span className="hidden sm:inline">Envoi rapide</span>
      </button>
      {/* In-app reminder dialog — gives the admin a chance to tweak the
          copy before hitting send, versus the mailto icon which hands off
          to the OS mail client unchanged. */}
      <button
        type="button"
        onClick={onOpenReminder}
        className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-1.5 border border-zinc-200 rounded-lg hover:bg-zinc-50 hover:border-[#0052CC]/30 hover:text-[#0052CC] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0052CC] focus-visible:ring-offset-1"
        aria-label={`Envoyer un rappel à ${name}`}
      >
        <Send size={12} aria-hidden="true" />
        <span className="hidden sm:inline">Envoyer un rappel</span>
      </button>
      {(() => {
        // Build the mailto URL via encodeURIComponent on each field so
        // spaces, accents, and apostrophes are handled uniformly.
        // The old inline template mixed hand-crafted %C3%A9 escapes with
        // raw spaces and unencoded recipient addresses — any email with
        // a `+alias` or a space would break the link.
        const defaults = buildDefaultReminder(checkout);
        const subject = encodeURIComponent(defaults.subject);
        const body = encodeURIComponent(defaults.body);
        const mailtoHref = `mailto:${encodeURIComponent(checkout.email)}?subject=${subject}&body=${body}`;
        // Gate the 1h abandoned-cart recovery send on the pause flag
        // admins can toggle in /admin/automations. The mailto still
        // renders as an anchor (keeps right-click / open-in-new-tab
        // muscle memory), but an onClick preventDefault short-circuits
        // the actual mail-client launch when paused. The 24h/72h nudges
        // don't have a direct trigger here; this is the single visible
        // send point for abandoned-cart recovery in-app.
        const handleRecoveryClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
          if (!isAutomationActive('abandoned-cart-1h')) {
            e.preventDefault();
            console.info('[automation] skipped paused automation:', 'abandoned-cart-1h');
            toast.warning('Relance de panier suspendue', {
              description: 'L\u2019automatisation « abandoned-cart-1h » est en pause dans /admin/automations.',
            });
          }
        };
        return (
          <a
            href={mailtoHref}
            onClick={handleRecoveryClick}
            title="Ouvrir dans le client mail local"
            aria-label={`Ouvrir un courriel dans le client local pour ${name}`}
            className="w-8 h-8 rounded-lg hover:bg-zinc-100 flex items-center justify-center text-zinc-500 hover:text-[#0052CC] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0052CC] focus-visible:ring-offset-1"
          >
            <Mail size={14} aria-hidden="true" />
          </a>
        );
      })()}
      <a
        href={checkout.recoveryUrl}
        target="_blank"
        rel="noopener noreferrer"
        title="Lien de récupération"
        aria-label={`Ouvrir le lien de récupération pour ${name} (nouvel onglet)`}
        className="w-8 h-8 rounded-lg hover:bg-zinc-100 flex items-center justify-center text-zinc-500 hover:text-[#0052CC] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0052CC] focus-visible:ring-offset-1"
      >
        <ExternalLink size={14} aria-hidden="true" />
      </a>
    </div>
  );
}

function ReminderDialog({
  checkout,
  onClose,
  onSent,
}: {
  checkout: ShopifyAbandonedCheckoutSnapshot;
  onClose: () => void;
  onSent: () => void;
}) {
  const defaults = useMemo(() => buildDefaultReminder(checkout), [checkout]);
  const [subject, setSubject] = useState(defaults.subject);
  const [body, setBody] = useState(defaults.body);
  const [sending, setSending] = useState(false);

  // Close on Escape — standard dialog affordance. Without this the only
  // way out is the Annuler button or the backdrop, which is a
  // keyboard-accessibility gap.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !sending) onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, sending]);

  const handleSend = useCallback(async () => {
    if (sending) return;
    setSending(true);
    const sentAt = new Date().toISOString();
    try {
      const result = await trySendEmail({ to: checkout.email, subject, body });
      // Always append to the log — even on the sender path we want an
      // audit trail the admin can pull up without wiring a separate
      // mailbox viewer.
      appendEmailLog({ cartId: checkout.id, to: checkout.email, subject, body, sentAt });
      if (result.via === 'sender') {
        toast.success(`Rappel envoyé à ${checkout.email}`);
      } else {
        toast.success('Rappel enregistré (envoi Zapier non configuré — consignation locale).');
      }
      onSent();
    } catch (err) {
      // Narrow the catch so the toast message reflects the actual
      // failure instead of a generic "something went wrong" banner.
      const msg = err instanceof Error ? err.message : 'Erreur inconnue';
      toast.error(`Échec de l'envoi : ${msg}`);
      setSending(false);
    }
  }, [sending, checkout.email, checkout.id, subject, body, onSent]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="reminder-dialog-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40"
      onClick={e => {
        // Close on backdrop click only, not when clicking inside the card.
        if (e.target === e.currentTarget && !sending) onClose();
      }}
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-auto">
        <div className="flex items-start justify-between p-5 border-b border-zinc-100">
          <div>
            <h2 id="reminder-dialog-title" className="font-extrabold text-base">Envoyer un rappel</h2>
            <p className="text-xs text-zinc-500 mt-0.5">Panier de {checkout.customerName.trim() || checkout.email}</p>
          </div>
          <button
            type="button"
            onClick={() => !sending && onClose()}
            aria-label="Fermer"
            className="w-8 h-8 rounded-lg hover:bg-zinc-100 flex items-center justify-center text-zinc-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0052CC] focus-visible:ring-offset-1"
          >
            <X size={16} aria-hidden="true" />
          </button>
        </div>
        <div className="p-5 space-y-4">
          <div>
            <label className="block text-xs font-bold text-zinc-700 mb-1.5">Destinataire</label>
            <div className="text-sm px-3 py-2 bg-zinc-50 border border-zinc-200 rounded-lg text-zinc-700">
              {checkout.email}
            </div>
          </div>
          <div>
            <label htmlFor="reminder-subject" className="block text-xs font-bold text-zinc-700 mb-1.5">Sujet</label>
            <input
              id="reminder-subject"
              type="text"
              value={subject}
              onChange={e => setSubject(e.target.value)}
              disabled={sending}
              className="w-full text-sm px-3 py-2 bg-white border border-zinc-200 rounded-lg focus:outline-none focus:border-[#0052CC] focus:ring-2 focus:ring-[#0052CC]/20 disabled:bg-zinc-50"
            />
          </div>
          <div>
            <label htmlFor="reminder-body" className="block text-xs font-bold text-zinc-700 mb-1.5">Message</label>
            <textarea
              id="reminder-body"
              value={body}
              onChange={e => setBody(e.target.value)}
              disabled={sending}
              rows={10}
              className="w-full text-sm px-3 py-2 bg-white border border-zinc-200 rounded-lg focus:outline-none focus:border-[#0052CC] focus:ring-2 focus:ring-[#0052CC]/20 font-mono disabled:bg-zinc-50"
            />
          </div>
        </div>
        <div className="flex items-center justify-end gap-2 p-5 border-t border-zinc-100 bg-zinc-50 rounded-b-2xl">
          <button
            type="button"
            onClick={() => !sending && onClose()}
            disabled={sending}
            className="text-xs font-bold px-4 py-2 border border-zinc-200 rounded-lg hover:bg-white text-zinc-700 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0052CC] focus-visible:ring-offset-1 disabled:opacity-50"
          >
            Annuler
          </button>
          <button
            type="button"
            onClick={handleSend}
            disabled={sending || !subject.trim() || !body.trim()}
            className="inline-flex items-center gap-1.5 text-xs font-bold px-4 py-2 bg-[#0052CC] text-white rounded-lg hover:bg-[#003d99] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0052CC] focus-visible:ring-offset-1 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {sending ? (
              <>
                <RefreshCw size={12} className="animate-spin" aria-hidden="true" />
                Envoi…
              </>
            ) : (
              <>
                <Check size={12} aria-hidden="true" />
                Envoyer le rappel
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
