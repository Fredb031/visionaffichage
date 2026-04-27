import { useEffect, useMemo, useState } from 'react';
import { Trophy, AlertCircle, Star } from 'lucide-react';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { getLoyalty, type LoyaltyAccount, type LoyaltyTransaction } from '@/lib/loyalty';

// Volume II §22 — Admin Loyalty.
//
// Volume I §15 shipped a localStorage-backed loyalty shim
// (src/lib/loyalty.ts). Today it stores a single account on the
// active browser — the per-customer Supabase migration
// (`loyalty_accounts` + `loyalty_transactions`) is operator
// follow-up.
//
// This admin surface reads what the local shim can give us — the
// current device's account + transaction log — and explicitly
// flags the limitation. When the Supabase tables land, the shape
// rendered below already maps to a `select * from loyalty_accounts
// order by lifetime desc limit N` and a sum query for total points
// issued, so the upgrade is a data-source swap.

const TX_KEY = 'va:loyalty:transactions';

// Strict transaction-shape validator. Mirrors AdminCapacity 0636a9f
// parseSlotCount discipline applied to the loyalty TX log.
//
// `Array.isArray(parsed)` alone is not enough: entries can be edited
// by hand in localStorage, partially written by an aborted
// awardPoints() call, or carried over from an older shim version. A
// single bad row poisons the admin page in two visible ways:
//   1. totals tiles — `reduce((s, t) => s + t.points, 0)` propagates
//      NaN when `t.points` is anything but a finite number, and the
//      tile renders "NaN" / a rejected toLocaleString call;
//   2. date column — `new Date(t.at).toLocaleString(...)` returns the
//      string "Invalid Date" for corrupt timestamps, which is what
//      the operator then sees in production.
// Be picky on read: validate every field, reject the row otherwise.
// type=earn|redeem (literal), points=finite non-negative integer,
// reason=string, at=parseable ISO timestamp.
function isValidTransaction(t: unknown): t is LoyaltyTransaction {
  if (!t || typeof t !== 'object') return false;
  const tx = t as Record<string, unknown>;
  if (tx.type !== 'earn' && tx.type !== 'redeem') return false;
  const points = Number(tx.points);
  if (!Number.isFinite(points) || !Number.isInteger(points) || points < 0) return false;
  if (typeof tx.reason !== 'string') return false;
  if (typeof tx.at !== 'string') return false;
  const ts = Date.parse(tx.at);
  if (!Number.isFinite(ts)) return false;
  return true;
}

function readTransactions(): LoyaltyTransaction[] {
  try {
    const raw = localStorage.getItem(TX_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isValidTransaction);
  } catch {
    return [];
  }
}

function tierLabel(tier: LoyaltyAccount['tier']): string {
  return tier === 'gold' ? 'Or' : tier === 'silver' ? 'Argent' : 'Bronze';
}

function tierColor(tier: LoyaltyAccount['tier']): string {
  return tier === 'gold'
    ? 'bg-[#E8A838]/15 text-[#B37D10] border-[#E8A838]/40'
    : tier === 'silver'
    ? 'bg-zinc-200 text-zinc-700 border-zinc-300'
    : 'bg-orange-100 text-orange-800 border-orange-200';
}

export default function AdminLoyalty() {
  useDocumentTitle('Programme de fidélité — Admin');

  const [account, setAccount] = useState<LoyaltyAccount>(() => getLoyalty());
  const [transactions, setTransactions] = useState<LoyaltyTransaction[]>(() => readTransactions());

  // Re-pull on mount so the page is fresh after a navigation hop.
  useEffect(() => {
    setAccount(getLoyalty());
    setTransactions(readTransactions());
  }, []);

  const totalIssued = useMemo(
    () => transactions.filter(t => t.type === 'earn').reduce((sum, t) => sum + t.points, 0),
    [transactions],
  );
  const totalRedeemed = useMemo(
    () => transactions.filter(t => t.type === 'redeem').reduce((sum, t) => sum + t.points, 0),
    [transactions],
  );

  return (
    <div>
      <div className="mb-6 rounded-xl border border-[#D97706]/30 bg-[#FFFBEB] p-4 flex items-start gap-3">
        <span className="text-[#D97706] text-lg flex-shrink-0 mt-0.5" aria-hidden>⚠</span>
        <div className="flex-1">
          <p className="font-semibold text-[#0A0A0A] text-sm">Fonctionnalité en développement</p>
          <p className="text-[#374151] text-xs mt-1 leading-relaxed">
            Cette section attend la migration Supabase + l'intégration backend. Les données affichées peuvent être synthétiques ou vides en attendant. À ne pas utiliser comme source de vérité pour le moment.
          </p>
        </div>
      </div>
      <div className="mb-6">
        <h1 className="text-2xl font-extrabold tracking-tight text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
          <Trophy size={22} aria-hidden="true" className="text-[#E8A838]" />
          Programme de fidélité
        </h1>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          Aperçu du programme — niveaux Bronze / Argent / Or, points en cours et historique des transactions.
        </p>
      </div>

      <div
        role="note"
        className="mb-5 flex items-start gap-3 rounded-xl border border-[#E8A838]/40 bg-[#E8A838]/10 px-4 py-3 text-sm text-[#7a5208] dark:text-[#E8A838]"
      >
        <AlertCircle size={16} aria-hidden="true" className="mt-0.5 shrink-0" />
        <div>
          <strong className="font-bold">Source de données transitoire.</strong>{' '}
          Le programme s'appuie aujourd'hui sur <code className="rounded bg-white/70 dark:bg-zinc-900/40 px-1 py-0.5 text-[12px]">localStorage</code> (Volume I §15).
          Les valeurs ci-dessous reflètent le compte du navigateur actif. TODO opérateur :
          migrer vers Supabase (<code className="rounded bg-white/70 dark:bg-zinc-900/40 px-1 py-0.5 text-[12px]">loyalty_accounts</code>,
          <code className="rounded bg-white/70 dark:bg-zinc-900/40 px-1 py-0.5 text-[12px]">loyalty_transactions</code>),
          ajouter le webhook Shopify orders → <code className="rounded bg-white/70 dark:bg-zinc-900/40 px-1 py-0.5 text-[12px]">awardPoints()</code>,
          puis remplacer la lecture par un classement <em>top members</em> (lifetime DESC) + somme des points émis.
        </div>
      </div>

      {/* Top-line metrics. Three tiles laid out responsively — flex on
          mobile collapsing to a column, three equal columns from sm up. */}
      <div className="mb-6 grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <div className="text-[11px] font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
            Points en circulation
          </div>
          <div className="mt-1 text-2xl font-extrabold text-zinc-900 dark:text-zinc-100 tabular-nums">
            {account.points.toLocaleString('fr-CA')}
          </div>
          <div className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
            Points actuellement détenus par les membres.
          </div>
        </div>
        <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <div className="text-[11px] font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
            Points émis (cumulés)
          </div>
          <div className="mt-1 text-2xl font-extrabold text-[#0052CC] tabular-nums">
            {totalIssued.toLocaleString('fr-CA')}
          </div>
          <div className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
            Somme des transactions <em>earn</em> enregistrées.
          </div>
        </div>
        <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <div className="text-[11px] font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
            Points échangés
          </div>
          <div className="mt-1 text-2xl font-extrabold text-emerald-700 tabular-nums">
            {totalRedeemed.toLocaleString('fr-CA')}
          </div>
          <div className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
            Somme des transactions <em>redeem</em>.
          </div>
        </div>
      </div>

      {/* "Top members" section — there's only one local account today,
          so the table renders that single row. With Supabase wired in,
          this becomes the top-N members by lifetime points. */}
      <div className="mb-6 rounded-xl border border-zinc-200 bg-white shadow-sm overflow-hidden dark:border-zinc-800 dark:bg-zinc-900">
        <div className="px-4 py-3 border-b border-zinc-200 dark:border-zinc-800 flex items-center gap-2">
          <Star size={14} aria-hidden="true" className="text-[#E8A838]" />
          <h2 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">Membres principaux</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-zinc-200 dark:divide-zinc-800 text-sm">
            <thead className="bg-zinc-50 dark:bg-zinc-900/60">
              <tr>
                <th scope="col" className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-zinc-600 dark:text-zinc-400">
                  Membre
                </th>
                <th scope="col" className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-zinc-600 dark:text-zinc-400">
                  Niveau
                </th>
                <th scope="col" className="px-4 py-3 text-right text-[11px] font-bold uppercase tracking-wider text-zinc-600 dark:text-zinc-400">
                  Points actuels
                </th>
                <th scope="col" className="px-4 py-3 text-right text-[11px] font-bold uppercase tracking-wider text-zinc-600 dark:text-zinc-400">
                  Points à vie
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
              <tr>
                <td className="px-4 py-3">
                  <div className="font-semibold text-zinc-900 dark:text-zinc-100">Compte local (navigateur courant)</div>
                  <div className="text-[12px] text-zinc-500 dark:text-zinc-400">
                    Multi-membre disponible après migration Supabase
                  </div>
                </td>
                <td className="px-4 py-3">
                  <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-bold ${tierColor(account.tier)}`}>
                    {tierLabel(account.tier)}
                  </span>
                </td>
                <td className="px-4 py-3 text-right tabular-nums text-zinc-900 dark:text-zinc-100">
                  {account.points.toLocaleString('fr-CA')}
                </td>
                <td className="px-4 py-3 text-right tabular-nums font-semibold text-[#0052CC]">
                  {account.lifetime.toLocaleString('fr-CA')}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Recent transaction log — caps at 100 in the shim (FIFO). */}
      <div className="rounded-xl border border-zinc-200 bg-white shadow-sm overflow-hidden dark:border-zinc-800 dark:bg-zinc-900">
        <div className="px-4 py-3 border-b border-zinc-200 dark:border-zinc-800">
          <h2 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">Transactions récentes</h2>
          <p className="mt-0.5 text-[12px] text-zinc-500 dark:text-zinc-400">
            Limité à 100 entrées (cap FIFO du shim local).
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-zinc-200 dark:divide-zinc-800 text-sm">
            <thead className="bg-zinc-50 dark:bg-zinc-900/60">
              <tr>
                <th scope="col" className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-zinc-600 dark:text-zinc-400">Date</th>
                <th scope="col" className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-zinc-600 dark:text-zinc-400">Type</th>
                <th scope="col" className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-zinc-600 dark:text-zinc-400">Raison</th>
                <th scope="col" className="px-4 py-3 text-right text-[11px] font-bold uppercase tracking-wider text-zinc-600 dark:text-zinc-400">Points</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {transactions.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-sm text-zinc-500">
                    Aucune transaction enregistrée pour le moment.
                  </td>
                </tr>
              ) : transactions.map((t, idx) => (
                <tr key={`${t.at}-${idx}`} className="hover:bg-zinc-50/60 dark:hover:bg-zinc-800/40 transition-colors">
                  <td className="px-4 py-3 text-zinc-700 dark:text-zinc-300 tabular-nums">
                    {new Date(t.at).toLocaleString('fr-CA', { dateStyle: 'medium', timeStyle: 'short' })}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-bold ${
                      t.type === 'earn'
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                        : 'bg-zinc-100 text-zinc-700 border-zinc-200'
                    }`}>
                      {t.type === 'earn' ? 'Gain' : 'Échange'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-zinc-700 dark:text-zinc-300">
                    {t.reason}
                  </td>
                  <td className={`px-4 py-3 text-right tabular-nums font-semibold ${
                    t.type === 'earn' ? 'text-emerald-700' : 'text-zinc-700 dark:text-zinc-300'
                  }`}>
                    {t.type === 'earn' ? '+' : '−'}{t.points.toLocaleString('fr-CA')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
