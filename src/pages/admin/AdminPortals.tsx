import { Building2, AlertCircle, ExternalLink } from 'lucide-react';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';

// Volume II §22 — Admin Portals.
//
// Volume I §04 shipped the data shape for `company_portals` (per-
// company branded portal: logo, allowed buyers, custom catalog,
// approval workflow). The Supabase table has not yet been migrated,
// so this surface is a placeholder shell with the intended columns
// listed for the operator to wire in. Once the table lands, swap
// the empty list for a real `from('company_portals').select(...)`
// call — the layout below is column-stable so no churn is needed.

interface PortalColumn {
  key: string;
  label: string;
  hint: string;
}

const COLUMNS: PortalColumn[] = [
  { key: 'company', label: 'Entreprise', hint: 'profiles.company FK' },
  { key: 'slug', label: 'Slug du portail', hint: '/portails/:slug' },
  { key: 'buyers', label: 'Acheteurs autorisés', hint: 'portal_members[]' },
  { key: 'catalog', label: 'Catalogue', hint: 'product_ids[]' },
  { key: 'approval', label: 'Workflow d\'approbation', hint: 'approval_required, threshold_cents' },
  { key: 'updated', label: 'Dernière mise à jour', hint: 'updated_at' },
];

export default function AdminPortals() {
  useDocumentTitle('Portails entreprises — Admin');

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-extrabold tracking-tight text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
          <Building2 size={22} aria-hidden="true" className="text-[#0052CC]" />
          Portails entreprises
        </h1>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          Vue des portails B2B (catalogue dédié, acheteurs autorisés, approbation des commandes par seuil).
        </p>
      </div>

      <div
        role="note"
        className="mb-5 flex items-start gap-3 rounded-xl border border-[#E8A838]/40 bg-[#E8A838]/10 px-4 py-3 text-sm text-[#7a5208] dark:text-[#E8A838]"
      >
        <AlertCircle size={16} aria-hidden="true" className="mt-0.5 shrink-0" />
        <div>
          <strong className="font-bold">Bientôt disponible.</strong>{' '}
          Volume I §04 a défini le schéma <code className="rounded bg-white/70 dark:bg-zinc-900/40 px-1 py-0.5 text-[12px]">company_portals</code>.
          La migration Supabase est à compléter — TODO opérateur :
          créer la table (id, company_id FK, slug unique, member_emails[], product_ids[], approval_required, approval_threshold_cents, theme_overrides jsonb, created_at, updated_at),
          activer RLS par <code className="rounded bg-white/70 dark:bg-zinc-900/40 px-1 py-0.5 text-[12px]">company_id</code>, puis brancher un select ici.
        </div>
      </div>

      <div className="rounded-xl border border-zinc-200 bg-white shadow-sm overflow-hidden dark:border-zinc-800 dark:bg-zinc-900">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-zinc-200 dark:divide-zinc-800 text-sm">
            <thead className="bg-zinc-50 dark:bg-zinc-900/60">
              <tr>
                {COLUMNS.map(col => (
                  <th
                    key={col.key}
                    scope="col"
                    className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-zinc-600 dark:text-zinc-400"
                  >
                    <div>{col.label}</div>
                    <div className="mt-0.5 text-[10px] font-mono normal-case text-zinc-400 dark:text-zinc-500">
                      {col.hint}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr>
                <td colSpan={COLUMNS.length} className="px-4 py-12 text-center">
                  <div className="mx-auto max-w-md">
                    <div className="mx-auto mb-3 w-12 h-12 rounded-xl bg-[#0052CC]/10 text-[#0052CC] flex items-center justify-center">
                      <Building2 size={22} aria-hidden="true" />
                    </div>
                    <div className="text-sm font-semibold text-zinc-700 dark:text-zinc-200">
                      Aucun portail entreprise pour le moment
                    </div>
                    <div className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                      La table <code className="font-mono">company_portals</code> est en attente de migration Supabase.
                      Les portails créés par le formulaire <em>Compte corporatif</em> y atterriront automatiquement
                      une fois le schéma activé.
                    </div>
                    <a
                      href="/compte-corporatif"
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label="Voir le formulaire d'inscription public (ouvre dans un nouvel onglet)"
                      className="mt-4 inline-flex items-center gap-1.5 text-xs font-semibold text-[#0052CC] hover:text-[#003D99] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0052CC] rounded"
                    >
                      Voir le formulaire d'inscription public
                      <ExternalLink size={12} aria-hidden="true" />
                    </a>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
