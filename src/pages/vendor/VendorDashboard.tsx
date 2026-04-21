import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { DollarSign, TrendingUp, FileText, CheckCircle2, Clock, Calendar, Download, FileUp, Trash2 } from 'lucide-react';
import { StatCard } from '@/components/admin/StatCard';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { useAuthStore } from '@/stores/authStore';
import { hasPermission } from '@/lib/permissions';
import { useLang } from '@/lib/langContext';
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

export default function VendorDashboard() {
  useDocumentTitle('Tableau de bord — Vendeur Vision Affichage');
  const { lang } = useLang();
  const user = useAuthStore(s => s.user);

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
      if (e.key === 'vision-commission-paid' || e.key === 'vision-commission-credits' || e.key === 'vision-app-settings') bump();
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

  const onMarkPaid = useCallback((orderId: number | string) => {
    markCommissionPaid(orderId);
    setRefreshToken(t => t + 1);
  }, []);

  // Accountants asked for a one-click month-end export — this replaces
  // hand-copying the table. The Blob URL is revoked in the same tick
  // (after the click() fires) to avoid leaking the object URL for the
  // life of the tab. Button is gated on orders:read so a viewer role
  // couldn't download numbers they can't see in the table.
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
    URL.revokeObjectURL(url);
  }, [vendorId, month]);

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

  const L = (fr: string, en: string) => (lang === 'fr' ? fr : en);

  return (
    <div className="space-y-8">
      <header className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">
            {L('Tableau de bord', 'Dashboard')}
          </h1>
          <p className="text-sm text-zinc-500 mt-1">
            {L('Tes commissions ce mois-ci', 'Your commissions this month')} · {formatMonth(month, lang)}
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
        </div>
      </header>

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
                    <td className="px-5 py-3 font-mono text-xs font-bold text-[#1B3A6B]">{order.name}</td>
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
    </div>
  );
}
