import { useCallback, useEffect, useMemo, useState } from 'react';
import { DollarSign, TrendingUp, FileText, CheckCircle2, Clock, Calendar, Download } from 'lucide-react';
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
    </div>
  );
}
