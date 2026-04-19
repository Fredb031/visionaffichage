import { Link } from 'react-router-dom';
import { FileText, TrendingUp, DollarSign, Plus, Eye, Clock } from 'lucide-react';
import { StatCard } from '@/components/admin/StatCard';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';

const MOCK_RECENT = [
  { id: 'q1', client: 'Sous Pression', total: 1840, status: 'viewed',  age: 'il y a 2h' },
  { id: 'q2', client: 'Perfocazes',    total: 620,  status: 'paid',    age: 'il y a 5h' },
  { id: 'q3', client: 'Lacasse',       total: 3450, status: 'sent',    age: 'il y a 1j' },
  { id: 'q4', client: 'CFP Québec',    total: 2100, status: 'viewed',  age: 'il y a 2j' },
];

const STATUS_LABEL: Record<string, string> = {
  draft: 'Brouillon',
  sent: 'Envoyé',
  viewed: 'Vu',
  accepted: 'Accepté',
  paid: 'Payé',
  expired: 'Expiré',
};

const STATUS_COLOR: Record<string, string> = {
  draft: 'bg-zinc-100 text-zinc-700',
  sent: 'bg-blue-50 text-blue-700',
  viewed: 'bg-amber-50 text-amber-700',
  accepted: 'bg-emerald-50 text-emerald-700',
  paid: 'bg-emerald-100 text-emerald-800',
  expired: 'bg-rose-50 text-rose-700',
};

export default function VendorDashboard() {
  useDocumentTitle('Tableau de bord — Vendeur Vision Affichage');
  return (
    <div className="space-y-8">
      <header className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">Tableau de bord</h1>
          <p className="text-sm text-zinc-500 mt-1">Ton activité cette semaine</p>
        </div>
        <Link
          to="/vendor/quotes/new"
          className="inline-flex items-center gap-2 text-sm font-bold px-5 py-2.5 bg-[#0052CC] text-white rounded-lg hover:opacity-90 shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0052CC] focus-visible:ring-offset-2"
        >
          <Plus size={16} aria-hidden="true" />
          Nouvelle soumission
        </Link>
      </header>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Soumissions envoyées" value="12" delta={20} deltaLabel="vs. sem. dernière" icon={FileText} accent="blue" />
        <StatCard label="Taux de conversion" value="68%" delta={5} deltaLabel="vs. mois dernier" icon={TrendingUp} accent="green" />
        <StatCard label="Revenus générés" value="8 420 $" delta={12} icon={DollarSign} accent="gold" />
        <StatCard label="Soumissions vues" value="9" icon={Eye} accent="blue" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 bg-white border border-zinc-200 rounded-2xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-bold">Soumissions récentes</h2>
            <Link
              to="/vendor/quotes"
              aria-label="Voir toutes les soumissions"
              className="text-xs font-semibold text-[#0052CC] hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0052CC] focus-visible:ring-offset-1 rounded"
            >
              Voir tout →
            </Link>
          </div>
          <div className="divide-y divide-zinc-100">
            {MOCK_RECENT.map(q => (
              <Link
                key={q.id}
                to={`/quote/${q.id}`}
                className="py-3 flex items-center gap-4 hover:bg-zinc-50 -mx-3 px-3 rounded-lg transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0052CC] focus-visible:ring-offset-1"
              >
                <div className="flex-1">
                  <div className="font-semibold text-sm">{q.client}</div>
                  <div className="text-xs text-zinc-500 flex items-center gap-1.5 mt-0.5">
                    <Clock size={10} aria-hidden="true" />
                    {q.age}
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-bold text-sm">{q.total.toLocaleString('fr-CA')} $</div>
                </div>
                <span className={`text-[10px] font-bold px-2 py-1 rounded-md ${STATUS_COLOR[q.status]}`}>
                  {STATUS_LABEL[q.status]}
                </span>
              </Link>
            ))}
          </div>
        </div>

        <div className="space-y-5">
          <div className="bg-gradient-to-br from-[#E8A838] to-[#B37D10] text-white rounded-2xl p-5 shadow-lg">
            <div className="text-[11px] font-bold uppercase tracking-wider opacity-80 mb-1">Ce mois-ci</div>
            <div className="text-3xl font-extrabold mb-1">842,00 $</div>
            <div className="text-xs opacity-90">Commission estimée</div>
            <div className="mt-3 text-[11px] opacity-80 border-t border-white/20 pt-2">
              Basé sur les soumissions payées à date
            </div>
          </div>

          <div className="bg-white border border-zinc-200 rounded-2xl p-5">
            <h2 className="font-bold text-sm mb-3">Actions rapides</h2>
            <div className="space-y-2">
              <Link to="/vendor/quotes/new" className="block text-sm font-semibold text-[#0052CC] hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0052CC] focus-visible:ring-offset-1 rounded">
                → Créer une nouvelle soumission
              </Link>
              <Link to="/vendor/quotes?status=draft" className="block text-sm font-semibold text-[#0052CC] hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0052CC] focus-visible:ring-offset-1 rounded">
                → Finir mes brouillons (2)
              </Link>
              <Link to="/vendor/quotes?status=expired" className="block text-sm font-semibold text-[#0052CC] hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0052CC] focus-visible:ring-offset-1 rounded">
                → Relancer les soumissions expirées
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
