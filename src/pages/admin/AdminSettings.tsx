import { Link2, Building2, CreditCard, Shield } from 'lucide-react';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';

export default function AdminSettings() {
  useDocumentTitle('Paramètres — Admin Vision Affichage');
  return (
    <div className="space-y-6 max-w-3xl">
      <header>
        <h1 className="text-2xl font-extrabold tracking-tight">Paramètres</h1>
        <p className="text-sm text-zinc-500 mt-1">Configurez votre entreprise et vos intégrations</p>
      </header>

      <section className="bg-white border border-zinc-200 rounded-2xl p-5">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-9 h-9 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
            <Building2 size={18} aria-hidden="true" />
          </div>
          <h2 className="font-bold">Informations de l'entreprise</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <Field label="Nom légal" defaultValue="Vision Affichage" />
          <Field label="NEQ" defaultValue="" placeholder="Numéro d'entreprise du Québec" />
          <Field label="Courriel général" type="email" defaultValue="info@visionaffichage.com" />
          <Field label="Téléphone" defaultValue="367-380-4808" />
        </div>
      </section>

      <section className="bg-white border border-zinc-200 rounded-2xl p-5">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-9 h-9 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
            <Link2 size={18} aria-hidden="true" />
          </div>
          <h2 className="font-bold">Connexion Shopify</h2>
        </div>
        <div className="flex items-center justify-between p-3 bg-zinc-50 rounded-lg">
          <div>
            <div className="font-semibold text-sm">visionaffichage.myshopify.com</div>
            <div className="text-xs text-zinc-500 mt-0.5">Connecté · 22 produits synchronisés</div>
          </div>
          <span className="text-[11px] font-bold px-2 py-1 bg-emerald-100 text-emerald-700 rounded-md">Actif</span>
        </div>
        <button
          type="button"
          className="mt-3 text-xs font-bold text-[#0052CC] hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0052CC] focus-visible:ring-offset-1 rounded"
        >
          Gérer les permissions
        </button>
      </section>

      <section className="bg-white border border-zinc-200 rounded-2xl p-5">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-9 h-9 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
            <CreditCard size={18} aria-hidden="true" />
          </div>
          <h2 className="font-bold">Paiements</h2>
        </div>
        <div className="text-sm text-zinc-600">
          Traitement via Shopify Payments. Configurez les taxes QST/TPS dans l'admin Shopify.
        </div>
      </section>

      <section className="bg-white border border-zinc-200 rounded-2xl p-5">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-9 h-9 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center">
            <Shield size={18} aria-hidden="true" />
          </div>
          <h2 className="font-bold">Sécurité</h2>
        </div>
        <div className="space-y-2 text-sm">
          <Toggle label="Authentification à deux facteurs (2FA)" enabled />
          <Toggle label="Notifications par courriel sur nouvelle commande" enabled />
          <Toggle label="Webhook Zapier sur paiement reçu" enabled={false} />
        </div>
      </section>
    </div>
  );
}

function Field({ label, defaultValue, placeholder, type = 'text' }: { label: string; defaultValue?: string; placeholder?: string; type?: string }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[11px] font-bold text-zinc-500 uppercase tracking-wider">{label}</span>
      <input
        type={type}
        defaultValue={defaultValue}
        placeholder={placeholder}
        className="border border-zinc-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-[#0052CC] focus:ring-2 focus:ring-[#0052CC]/10"
      />
    </label>
  );
}

function Toggle({ label, enabled }: { label: string; enabled: boolean }) {
  return (
    <div className="flex items-center justify-between p-3 bg-zinc-50 rounded-lg">
      <span className="text-sm" id={`toggle-${label.replace(/\s+/g, '-')}`}>{label}</span>
      <button
        type="button"
        role="switch"
        aria-checked={enabled}
        aria-labelledby={`toggle-${label.replace(/\s+/g, '-')}`}
        className={`relative inline-block w-9 h-5 rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0052CC] focus-visible:ring-offset-1 ${enabled ? 'bg-[#0052CC]' : 'bg-zinc-300'}`}
      >
        <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow-md transition-transform ${enabled ? 'translate-x-[18px]' : 'translate-x-0.5'}`} aria-hidden="true" />
      </button>
    </div>
  );
}
