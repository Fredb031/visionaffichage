import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import {
  RefreshCw,
  Database,
  Boxes,
  PackageSearch,
  Send,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  CheckCircle2,
} from 'lucide-react';
import { useLang } from '@/lib/langContext';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { supabase } from '@/lib/supabase';
import { sanmarClient } from '@/lib/sanmar/client';
import type { SanmarOrderStatus, SanmarOrderInput } from '@/lib/sanmar/types';
import { TablePagination } from '@/components/admin/TablePagination';

/**
 * /admin/sanmar — operator console for the SanMar Canada PromoStandards
 * integration (Step 4 of the broader rollout).
 *
 * RBAC is enforced one level up via <RequirePermission permission="sanmar:read">
 * in App.tsx, so by the time this page renders we know the operator is
 * either `admin` or `president`. Every panel below still gracefully
 * degrades when VITE_SANMAR_NEXT_GEN=false because the client-side
 * wrapper throws a clear "not deployed" error in that mode — we catch,
 * surface a soft empty/disabled state, and let the operator continue.
 *
 * va.* tokens only — no hardcoded brand hex. Bilingual via useLang.
 */

const NEXT_GEN_ENABLED = import.meta.env.VITE_SANMAR_NEXT_GEN === 'true';

interface SanmarCatalogRow {
  sku: string | null;
  style_id: string | null;
  color: string | null;
  size: string | null;
  price: number | null;
  total_qty: number | null;
  vancouver_qty: number | null;
  mississauga_qty: number | null;
  calgary_qty: number | null;
  last_synced_at: string | null;
}

interface SanmarSyncLogRow {
  finished_at: string | null;
  total_styles: number | null;
  total_parts: number | null;
}

const PAGE_SIZE = 50;

export default function AdminSanMar() {
  const { lang } = useLang();
  useDocumentTitle(lang === 'en' ? 'SanMar Canada — Admin' : 'SanMar Canada — Admin');

  // ── Sync status ─────────────────────────────────────────────────────────
  const [syncStatus, setSyncStatus] = useState<{
    lastSync: string | null;
    totalStyles: number;
    totalParts: number;
    loading: boolean;
  }>({ lastSync: null, totalStyles: 0, totalParts: 0, loading: true });
  const [syncing, setSyncing] = useState(false);

  // ── Catalogue table ────────────────────────────────────────────────────
  const [catalogRows, setCatalogRows] = useState<SanmarCatalogRow[]>([]);
  const [catalogPage, setCatalogPage] = useState(0);
  const [catalogTotal, setCatalogTotal] = useState(0);
  const [catalogLoading, setCatalogLoading] = useState(true);

  // ── Open orders ────────────────────────────────────────────────────────
  const [openOrders, setOpenOrders] = useState<SanmarOrderStatus[]>([]);
  const [openOrdersLoading, setOpenOrdersLoading] = useState(false);
  const [openOrdersLastPoll, setOpenOrdersLastPoll] = useState<Date | null>(null);
  const [openOrdersError, setOpenOrdersError] = useState<string | null>(null);

  // ── Test order form ────────────────────────────────────────────────────
  const [testOrderOpen, setTestOrderOpen] = useState(false);
  const [testOrderSubmitting, setTestOrderSubmitting] = useState(false);
  const [testForm, setTestForm] = useState({
    productId: '',
    partId: '',
    qty: '1',
    unitPrice: '0',
    companyName: 'Vision Affichage',
    address1: '',
    city: '',
    region: 'QC',
    postalCode: '',
    attentionTo: '',
    email: '',
  });

  // ── Effects ────────────────────────────────────────────────────────────

  /**
   * Pull last sync metadata + total counts from `sanmar_sync_log` and
   * `sanmar_catalog`. If the tables don't exist yet (Step 5 will create
   * them) we surface a soft empty state instead of an exception. Same
   * pattern as the catalogue + open-orders fetches below — the page
   * must render in a half-deployed environment.
   */
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!supabase) {
        if (!cancelled) setSyncStatus(s => ({ ...s, loading: false }));
        return;
      }
      try {
        const [logRes, countRes] = await Promise.all([
          supabase
            .from('sanmar_sync_log')
            .select('finished_at,total_styles,total_parts')
            .order('finished_at', { ascending: false })
            .limit(1)
            .maybeSingle(),
          supabase.from('sanmar_catalog').select('*', { count: 'exact', head: true }),
        ]);
        if (cancelled) return;
        const log = (logRes.data ?? null) as SanmarSyncLogRow | null;
        setSyncStatus({
          lastSync: log?.finished_at ?? null,
          totalStyles: log?.total_styles ?? 0,
          totalParts: countRes.count ?? log?.total_parts ?? 0,
          loading: false,
        });
      } catch {
        if (!cancelled) setSyncStatus(s => ({ ...s, loading: false }));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  /**
   * Page through `sanmar_catalog` 50 rows at a time. The query order
   * (style_id, color, size) keeps a deterministic pagination window
   * even as new rows arrive; without an explicit order Supabase can
   * shuffle on each request and the operator sees the same SKU twice.
   */
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setCatalogLoading(true);
      if (!supabase) {
        if (!cancelled) setCatalogLoading(false);
        return;
      }
      const from = catalogPage * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;
      try {
        const { data, count, error } = await supabase
          .from('sanmar_catalog')
          .select(
            'sku,style_id,color,size,price,total_qty,vancouver_qty,mississauga_qty,calgary_qty,last_synced_at',
            { count: 'exact' },
          )
          .order('style_id', { ascending: true })
          .order('color', { ascending: true })
          .order('size', { ascending: true })
          .range(from, to);
        if (cancelled) return;
        if (error) {
          // Table missing in early-deploy environments — soft empty state.
          setCatalogRows([]);
          setCatalogTotal(0);
        } else {
          setCatalogRows((data ?? []) as SanmarCatalogRow[]);
          setCatalogTotal(count ?? 0);
        }
      } catch {
        if (!cancelled) {
          setCatalogRows([]);
          setCatalogTotal(0);
        }
      } finally {
        if (!cancelled) setCatalogLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [catalogPage]);

  /**
   * Fetch all open orders (queryType = 4 per the SanMar PDF: "all open
   * orders for this customer"). Manual-trigger only after first mount
   * because each call hits the SanMar gateway and counts toward the
   * customer's daily quota.
   */
  const fetchOpenOrders = useMemo(
    () => async () => {
      setOpenOrdersError(null);
      setOpenOrdersLoading(true);
      try {
        const result = await sanmarClient.getOrderStatus(4);
        setOpenOrders(result);
        setOpenOrdersLastPoll(new Date());
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        setOpenOrdersError(msg);
      } finally {
        setOpenOrdersLoading(false);
      }
    },
    [],
  );

  // ── Handlers ───────────────────────────────────────────────────────────

  /**
   * Operator-triggered catalogue sync. The `sanmar-sync-catalog` edge
   * function ships with Step 5; until then we attempt the invoke and
   * if Supabase reports the function isn't deployed we surface a soft
   * "operator action required" toast instead of crashing the page.
   */
  const handleSync = async () => {
    if (!supabase) {
      toast.error(
        lang === 'en'
          ? 'Supabase client not initialized'
          : 'Client Supabase non initialisé',
      );
      return;
    }
    setSyncing(true);
    toast.message(
      lang === 'en' ? 'Synchronization in progress...' : 'Synchronisation en cours...',
    );
    try {
      const { error } = await supabase.functions.invoke('sanmar-sync-catalog');
      if (error) {
        // Supabase returns { status: 404 } in error.context for missing
        // functions. Either way, the message contains "404" or
        // "Function not found" — surface a friendly explainer.
        const msg = error.message || '';
        if (msg.includes('404') || msg.toLowerCase().includes('not found')) {
          toast.error(
            lang === 'en'
              ? 'Edge function not deployed — operator action required'
              : 'Edge function non déployée — opérateur action requise',
          );
        } else {
          toast.error(
            lang === 'en' ? `Sync failed: ${msg}` : `Échec de la synchro : ${msg}`,
          );
        }
      } else {
        toast.success(
          lang === 'en' ? 'Sync completed' : 'Synchronisation terminée',
        );
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      toast.error(lang === 'en' ? `Sync failed: ${msg}` : `Échec : ${msg}`);
    } finally {
      setSyncing(false);
    }
  };

  /**
   * Test order submission — dispatches a Sample-type order with a
   * single line item so the operator can verify the SOAP plumbing
   * end-to-end without filing a real order. The transactionId is
   * returned in a toast; nothing persists locally.
   */
  const handleTestOrder = async () => {
    const qty = Number(testForm.qty);
    const unitPrice = Number(testForm.unitPrice);
    if (
      !testForm.productId.trim() ||
      !testForm.partId.trim() ||
      !Number.isFinite(qty) ||
      qty <= 0 ||
      !Number.isFinite(unitPrice) ||
      unitPrice < 0
    ) {
      toast.error(
        lang === 'en'
          ? 'Fill productId, partId, qty (>0), unit price (>=0)'
          : 'Remplir productId, partId, qty (>0), prix (>=0)',
      );
      return;
    }
    if (
      !testForm.address1.trim() ||
      !testForm.city.trim() ||
      !testForm.postalCode.trim() ||
      !testForm.attentionTo.trim() ||
      !testForm.email.trim()
    ) {
      toast.error(
        lang === 'en' ? 'Fill all ship-to fields' : 'Remplir tous les champs livraison',
      );
      return;
    }
    setTestOrderSubmitting(true);
    try {
      const orderData: SanmarOrderInput = {
        orderType: 'Sample',
        orderNumber: `TEST-${Date.now()}`,
        totalAmount: qty * unitPrice,
        currency: 'CAD',
        orderContact: {
          attentionTo: testForm.attentionTo,
          email: testForm.email,
        },
        shipContact: {
          companyName: testForm.companyName,
          address1: testForm.address1,
          city: testForm.city,
          region: testForm.region,
          postalCode: testForm.postalCode,
          country: 'CA',
        },
        shipment: {
          allowConsolidation: false,
          blindShip: false,
          packingListRequired: false,
          carrier: 'UPS',
        },
        lineItems: [
          {
            lineNumber: '1',
            quantity: qty,
            unitPrice,
            productId: testForm.productId,
          },
        ],
      };
      const result = await sanmarClient.submitOrder(orderData);
      toast.success(
        lang === 'en'
          ? `Test order accepted — transactionId ${result.transactionId}`
          : `Commande test acceptée — transactionId ${result.transactionId}`,
      );
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      toast.error(
        lang === 'en' ? `Submission failed: ${msg}` : `Échec de soumission : ${msg}`,
      );
    } finally {
      setTestOrderSubmitting(false);
    }
  };

  // ── Helpers ────────────────────────────────────────────────────────────

  const formatTimestamp = (iso: string | null): string => {
    if (!iso) return '—';
    const d = new Date(iso);
    if (!Number.isFinite(d.getTime())) return '—';
    return d.toLocaleString(lang === 'fr' ? 'fr-CA' : 'en-CA');
  };

  const envLabel = NEXT_GEN_ENABLED
    ? lang === 'en'
      ? 'PROD (next-gen edge functions enabled)'
      : 'PROD (fonctions edge nouvelle génération activées)'
    : lang === 'en'
      ? 'UAT (config-driven, gate disabled)'
      : 'UAT (piloté par config, gate désactivé)';

  // ── Render ─────────────────────────────────────────────────────────────

  return (
    <div className="min-h-full bg-va-bg-1">
      {/* Header strip */}
      <header className="bg-va-bg-2 py-6 px-8 border-b border-va-line">
        <h1 className="font-display font-black text-va-ink text-3xl tracking-tight">
          SanMar Canada
        </h1>
        <p className="text-va-muted text-sm mt-1">
          {lang === 'en' ? 'Environment' : 'Environnement'} : {envLabel}
        </p>
      </header>

      <div className="px-8 py-8 space-y-8">
        {/* Sync status */}
        <section
          aria-labelledby="sanmar-sync-title"
          className="bg-va-white border border-va-line rounded-2xl p-6"
        >
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <h2
                id="sanmar-sync-title"
                className="font-display font-black text-va-ink text-xl tracking-tight flex items-center gap-2"
              >
                <Database size={20} aria-hidden="true" className="text-va-blue" />
                {lang === 'en' ? 'Catalogue sync' : 'Synchronisation du catalogue'}
              </h2>
              <p className="text-va-muted text-sm mt-1">
                {lang === 'en'
                  ? 'Last sync, style + part totals, manual refresh.'
                  : 'Dernière synchro, total des styles et parts, actualisation manuelle.'}
              </p>
            </div>
            <button
              type="button"
              onClick={handleSync}
              disabled={syncing}
              className="bg-va-blue hover:bg-va-blue-hover text-white px-6 py-3 rounded-xl text-sm font-bold disabled:opacity-60 disabled:cursor-not-allowed inline-flex items-center gap-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-va-blue focus-visible:ring-offset-2 transition-colors"
            >
              <RefreshCw
                size={16}
                aria-hidden="true"
                className={syncing ? 'animate-spin' : ''}
              />
              {syncing
                ? lang === 'en'
                  ? 'Synchronizing...'
                  : 'Synchronisation en cours...'
                : lang === 'en'
                  ? 'Sync now'
                  : 'Synchroniser maintenant'}
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
            <div className="bg-va-bg-2 rounded-xl px-5 py-4">
              <div className="text-[11px] font-bold uppercase tracking-wider text-va-muted">
                {lang === 'en' ? 'Last sync' : 'Dernière synchro'}
              </div>
              <div className="text-va-ink font-bold mt-1">
                {syncStatus.loading ? '…' : formatTimestamp(syncStatus.lastSync)}
              </div>
            </div>
            <div className="bg-va-bg-2 rounded-xl px-5 py-4">
              <div className="text-[11px] font-bold uppercase tracking-wider text-va-muted">
                {lang === 'en' ? 'Total styles' : 'Total styles'}
              </div>
              <div className="text-va-ink font-bold mt-1 text-2xl">
                {syncStatus.loading ? '…' : syncStatus.totalStyles.toLocaleString()}
              </div>
            </div>
            <div className="bg-va-bg-2 rounded-xl px-5 py-4">
              <div className="text-[11px] font-bold uppercase tracking-wider text-va-muted">
                {lang === 'en' ? 'Total parts (SKUs)' : 'Total parts (SKUs)'}
              </div>
              <div className="text-va-ink font-bold mt-1 text-2xl">
                {syncStatus.loading ? '…' : syncStatus.totalParts.toLocaleString()}
              </div>
            </div>
          </div>
        </section>

        {/* Inventory table */}
        <section
          aria-labelledby="sanmar-catalog-title"
          className="bg-va-white border border-va-line rounded-2xl p-6"
        >
          <h2
            id="sanmar-catalog-title"
            className="font-display font-black text-va-ink text-xl tracking-tight flex items-center gap-2 mb-4"
          >
            <Boxes size={20} aria-hidden="true" className="text-va-blue" />
            {lang === 'en' ? 'Inventory' : 'Inventaire'}
          </h2>
          <div className="overflow-x-auto -mx-6 px-6">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-left text-[11px] font-bold uppercase tracking-wider text-va-muted border-b border-va-line">
                  <th className="py-2 pr-4">SKU</th>
                  <th className="py-2 pr-4">{lang === 'en' ? 'Style' : 'Style'}</th>
                  <th className="py-2 pr-4">{lang === 'en' ? 'Color' : 'Couleur'}</th>
                  <th className="py-2 pr-4">{lang === 'en' ? 'Size' : 'Taille'}</th>
                  <th className="py-2 pr-4 text-right">
                    {lang === 'en' ? 'Price' : 'Prix'}
                  </th>
                  <th className="py-2 pr-4 text-right">
                    {lang === 'en' ? 'Total' : 'Total'}
                  </th>
                  <th className="py-2 pr-4 text-right">Vancouver</th>
                  <th className="py-2 pr-4 text-right">Mississauga</th>
                  <th className="py-2 pr-4 text-right">Calgary</th>
                  <th className="py-2 pr-4">
                    {lang === 'en' ? 'Last synced' : 'Dernière synchro'}
                  </th>
                </tr>
              </thead>
              <tbody>
                {catalogLoading ? (
                  <tr>
                    <td colSpan={10} className="py-12 text-center text-va-muted">
                      {lang === 'en' ? 'Loading...' : 'Chargement...'}
                    </td>
                  </tr>
                ) : catalogRows.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="py-12 text-center text-va-muted">
                      {lang === 'en'
                        ? 'No catalogue rows yet. Trigger a sync above.'
                        : 'Aucune ligne dans le catalogue. Lance une synchro ci-dessus.'}
                    </td>
                  </tr>
                ) : (
                  catalogRows.map((row, i) => (
                    <tr
                      key={`${row.sku ?? row.style_id}-${i}`}
                      className="border-b border-va-line/50 hover:bg-va-bg-2/50"
                    >
                      <td className="py-2 pr-4 font-mono text-xs text-va-ink">
                        {row.sku ?? '—'}
                      </td>
                      <td className="py-2 pr-4 text-va-ink font-bold">
                        {row.style_id ?? '—'}
                      </td>
                      <td className="py-2 pr-4 text-va-dim">{row.color ?? '—'}</td>
                      <td className="py-2 pr-4 text-va-dim">{row.size ?? '—'}</td>
                      <td className="py-2 pr-4 text-right text-va-ink">
                        {row.price != null
                          ? row.price.toLocaleString(
                              lang === 'fr' ? 'fr-CA' : 'en-CA',
                              { style: 'currency', currency: 'CAD' },
                            )
                          : '—'}
                      </td>
                      <td className="py-2 pr-4 text-right text-va-ink font-bold">
                        {row.total_qty ?? 0}
                      </td>
                      <td className="py-2 pr-4 text-right text-va-dim">
                        {row.vancouver_qty ?? 0}
                      </td>
                      <td className="py-2 pr-4 text-right text-va-dim">
                        {row.mississauga_qty ?? 0}
                      </td>
                      <td className="py-2 pr-4 text-right text-va-dim">
                        {row.calgary_qty ?? 0}
                      </td>
                      <td className="py-2 pr-4 text-xs text-va-muted">
                        {formatTimestamp(row.last_synced_at)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          {catalogTotal > 0 && (
            <div className="mt-4">
              <TablePagination
                page={catalogPage}
                pageSize={PAGE_SIZE}
                total={catalogTotal}
                onPageChange={setCatalogPage}
                itemLabel={lang === 'en' ? 'SKUs' : 'SKUs'}
              />
            </div>
          )}
        </section>

        {/* Open orders */}
        <section
          aria-labelledby="sanmar-orders-title"
          className="bg-va-white border border-va-line rounded-2xl p-6"
        >
          <div className="flex items-start justify-between gap-4 flex-wrap mb-4">
            <h2
              id="sanmar-orders-title"
              className="font-display font-black text-va-ink text-xl tracking-tight flex items-center gap-2"
            >
              <PackageSearch size={20} aria-hidden="true" className="text-va-blue" />
              {lang === 'en' ? 'Open orders' : 'Commandes ouvertes'}
            </h2>
            <button
              type="button"
              onClick={fetchOpenOrders}
              disabled={openOrdersLoading}
              className="border border-va-line rounded-lg px-4 py-2 text-sm font-bold text-va-ink hover:bg-va-bg-2 inline-flex items-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed focus:outline-none focus-visible:ring-2 focus-visible:ring-va-blue focus-visible:ring-offset-2"
            >
              <RefreshCw
                size={14}
                aria-hidden="true"
                className={openOrdersLoading ? 'animate-spin' : ''}
              />
              {lang === 'en' ? 'Refresh' : 'Actualiser'}
            </button>
          </div>
          {openOrdersError ? (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3">
              <AlertCircle
                size={18}
                aria-hidden="true"
                className="text-va-warn mt-0.5 flex-shrink-0"
              />
              <div className="text-sm text-amber-900">
                <div className="font-bold mb-1">
                  {lang === 'en' ? 'Could not load open orders' : 'Impossible de charger les commandes ouvertes'}
                </div>
                <div className="text-xs">{openOrdersError}</div>
              </div>
            </div>
          ) : openOrders.length === 0 ? (
            <p className="text-va-muted text-sm py-6">
              {openOrdersLastPoll
                ? lang === 'en'
                  ? 'No open orders.'
                  : 'Aucune commande ouverte.'
                : lang === 'en'
                  ? 'Click Refresh to load open orders.'
                  : 'Clique sur Actualiser pour charger les commandes ouvertes.'}
            </p>
          ) : (
            <div className="overflow-x-auto -mx-6 px-6">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="text-left text-[11px] font-bold uppercase tracking-wider text-va-muted border-b border-va-line">
                    <th className="py-2 pr-4">PO #</th>
                    <th className="py-2 pr-4">
                      {lang === 'en' ? 'Sales order' : 'No commande SanMar'}
                    </th>
                    <th className="py-2 pr-4">
                      {lang === 'en' ? 'Status' : 'Statut'}
                    </th>
                    <th className="py-2 pr-4">
                      {lang === 'en' ? 'Expected ship' : 'Expédition prévue'}
                    </th>
                    <th className="py-2 pr-4">
                      {lang === 'en' ? 'Last poll' : 'Dernier sondage'}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {openOrders.flatMap(o =>
                    o.orderStatusDetails.length === 0
                      ? [
                          <tr
                            key={`${o.purchaseOrderNumber}-empty`}
                            className="border-b border-va-line/50"
                          >
                            <td className="py-2 pr-4 font-mono text-xs">
                              {o.purchaseOrderNumber}
                            </td>
                            <td className="py-2 pr-4 text-va-muted" colSpan={4}>
                              {lang === 'en' ? '(no detail rows)' : '(aucune ligne)'}
                            </td>
                          </tr>,
                        ]
                      : o.orderStatusDetails.map((d, i) => (
                          <tr
                            key={`${o.purchaseOrderNumber}-${d.factoryOrderNumber}-${i}`}
                            className="border-b border-va-line/50 hover:bg-va-bg-2/50"
                          >
                            <td className="py-2 pr-4 font-mono text-xs">
                              {o.purchaseOrderNumber}
                            </td>
                            <td className="py-2 pr-4 font-mono text-xs">
                              {d.factoryOrderNumber}
                            </td>
                            <td className="py-2 pr-4 text-va-ink font-bold">
                              {d.statusName}{' '}
                              <span className="text-va-muted font-normal">
                                ({d.statusId})
                              </span>
                            </td>
                            <td className="py-2 pr-4 text-va-dim">
                              {formatTimestamp(d.expectedShipDate)}
                            </td>
                            <td className="py-2 pr-4 text-xs text-va-muted">
                              {openOrdersLastPoll
                                ? openOrdersLastPoll.toLocaleString(
                                    lang === 'fr' ? 'fr-CA' : 'en-CA',
                                  )
                                : '—'}
                            </td>
                          </tr>
                        )),
                  )}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* Test order submission (collapsible) */}
        <section
          aria-labelledby="sanmar-test-title"
          className="bg-va-white border border-va-line rounded-2xl p-6"
        >
          <button
            type="button"
            onClick={() => setTestOrderOpen(o => !o)}
            aria-expanded={testOrderOpen}
            aria-controls="sanmar-test-form"
            className="w-full flex items-center justify-between gap-4 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-va-blue focus-visible:ring-offset-2 rounded-md"
          >
            <h2
              id="sanmar-test-title"
              className="font-display font-black text-va-ink text-xl tracking-tight flex items-center gap-2"
            >
              <Send size={20} aria-hidden="true" className="text-va-blue" />
              {lang === 'en'
                ? 'Test order submission (Sample type — never charges)'
                : 'Soumission test (type Sample — jamais facturée)'}
            </h2>
            {testOrderOpen ? (
              <ChevronUp size={18} aria-hidden="true" className="text-va-muted" />
            ) : (
              <ChevronDown size={18} aria-hidden="true" className="text-va-muted" />
            )}
          </button>
          {testOrderOpen && (
            <div id="sanmar-test-form" className="mt-5 grid grid-cols-1 md:grid-cols-2 gap-4">
              <Field
                label={lang === 'en' ? 'Product ID' : 'Product ID'}
                value={testForm.productId}
                onChange={v => setTestForm(s => ({ ...s, productId: v }))}
                placeholder="ATC1000"
              />
              <Field
                label={lang === 'en' ? 'Part ID' : 'Part ID'}
                value={testForm.partId}
                onChange={v => setTestForm(s => ({ ...s, partId: v }))}
                placeholder="ATC1000-BLK-LG"
              />
              <Field
                label={lang === 'en' ? 'Quantity' : 'Quantité'}
                value={testForm.qty}
                onChange={v => setTestForm(s => ({ ...s, qty: v }))}
                placeholder="1"
                inputMode="numeric"
              />
              <Field
                label={lang === 'en' ? 'Unit price (CAD)' : 'Prix unitaire (CAD)'}
                value={testForm.unitPrice}
                onChange={v => setTestForm(s => ({ ...s, unitPrice: v }))}
                placeholder="0"
                inputMode="decimal"
              />
              <Field
                label={lang === 'en' ? 'Attention to' : 'À l’attention de'}
                value={testForm.attentionTo}
                onChange={v => setTestForm(s => ({ ...s, attentionTo: v }))}
                placeholder="Frederick Bouchard"
              />
              <Field
                label={lang === 'en' ? 'Email' : 'Courriel'}
                value={testForm.email}
                onChange={v => setTestForm(s => ({ ...s, email: v }))}
                placeholder="ops@visionaffichage.com"
                inputMode="email"
              />
              <Field
                label={lang === 'en' ? 'Company' : 'Entreprise'}
                value={testForm.companyName}
                onChange={v => setTestForm(s => ({ ...s, companyName: v }))}
              />
              <Field
                label={lang === 'en' ? 'Address' : 'Adresse'}
                value={testForm.address1}
                onChange={v => setTestForm(s => ({ ...s, address1: v }))}
                placeholder="123 rue de l'Église"
              />
              <Field
                label={lang === 'en' ? 'City' : 'Ville'}
                value={testForm.city}
                onChange={v => setTestForm(s => ({ ...s, city: v }))}
                placeholder="Montréal"
              />
              <Field
                label={lang === 'en' ? 'Region' : 'Province'}
                value={testForm.region}
                onChange={v => setTestForm(s => ({ ...s, region: v }))}
                placeholder="QC"
              />
              <Field
                label={lang === 'en' ? 'Postal code' : 'Code postal'}
                value={testForm.postalCode}
                onChange={v => setTestForm(s => ({ ...s, postalCode: v }))}
                placeholder="H2X 1Y4"
              />
              <div className="md:col-span-2 flex items-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={handleTestOrder}
                  disabled={testOrderSubmitting}
                  className="bg-va-blue hover:bg-va-blue-hover text-white px-5 py-2.5 rounded-xl text-sm font-bold disabled:opacity-60 disabled:cursor-not-allowed inline-flex items-center gap-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-va-blue focus-visible:ring-offset-2 transition-colors"
                >
                  <CheckCircle2 size={14} aria-hidden="true" />
                  {testOrderSubmitting
                    ? lang === 'en'
                      ? 'Submitting...'
                      : 'Soumission...'
                    : lang === 'en'
                      ? 'Submit test order'
                      : 'Soumettre la commande test'}
                </button>
                <p className="text-xs text-va-muted">
                  {lang === 'en'
                    ? 'orderType=Sample — verifies SOAP plumbing without creating a real order.'
                    : 'orderType=Sample — vérifie la plomberie SOAP sans créer de vraie commande.'}
                </p>
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

/** Local labelled input — keeps the form markup readable without
 * pulling in shadcn primitives that the rest of the page doesn't need. */
function Field({
  label,
  value,
  onChange,
  placeholder,
  inputMode,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  inputMode?: 'text' | 'numeric' | 'decimal' | 'email';
}) {
  return (
    <label className="block">
      <span className="text-[11px] font-bold uppercase tracking-wider text-va-muted">
        {label}
      </span>
      <input
        type="text"
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        inputMode={inputMode}
        className="mt-1 w-full border border-va-line rounded-lg px-3 py-2 text-sm text-va-ink outline-none focus:border-va-blue focus-visible:ring-2 focus-visible:ring-va-blue/25 transition-shadow bg-va-white"
      />
    </label>
  );
}
