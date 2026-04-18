import { useEffect, useState } from 'react';
import { Plus, Mail, TrendingUp, Trash2, X } from 'lucide-react';

interface VendorRecord {
  id: string;
  name: string;
  email: string;
  quotesSent: number;
  conversionRate: number;
  revenue: number;
  lastActive: string;
  isCustom?: boolean;
}

const SEED_VENDORS: VendorRecord[] = [
  { id: '1', name: 'Sophie Tremblay',         email: 'sophie@visionaffichage.com', quotesSent: 47, conversionRate: 68, revenue: 28400, lastActive: 'il y a 12 min' },
  { id: '2', name: 'Marc-André Pelletier',    email: 'marc@visionaffichage.com',   quotesSent: 32, conversionRate: 74, revenue: 19200, lastActive: 'il y a 1h' },
  { id: '3', name: 'Julie Gagnon',            email: 'julie@visionaffichage.com',  quotesSent: 28, conversionRate: 61, revenue: 15800, lastActive: 'il y a 4h' },
];

export default function AdminVendors() {
  const [customVendors, setCustomVendors] = useState<VendorRecord[]>([]);
  const [showInvite, setShowInvite] = useState(false);
  const [newName, setNewName] = useState('');
  const [newEmail, setNewEmail] = useState('');

  useEffect(() => {
    try {
      const raw = JSON.parse(localStorage.getItem('vision-vendors') ?? '[]');
      setCustomVendors(Array.isArray(raw) ? raw : []);
    } catch {
      setCustomVendors([]);
    }
  }, []);

  const persist = (next: VendorRecord[]) => {
    setCustomVendors(next);
    try { localStorage.setItem('vision-vendors', JSON.stringify(next)); }
    catch (e) { console.warn('[AdminVendors] Could not persist vendors:', e); }
  };

  const handleInvite = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEmail.trim() || !newName.trim()) return;
    const v: VendorRecord = {
      id: `cus-${Date.now()}`,
      name: newName.trim(),
      email: newEmail.trim().toLowerCase(),
      quotesSent: 0,
      conversionRate: 0,
      revenue: 0,
      lastActive: 'Invitation envoyée',
      isCustom: true,
    };
    persist([v, ...customVendors]);
    // Pre-fill an invitation mailto
    const subject = encodeURIComponent('Invitation à rejoindre Vision Affichage');
    const body = encodeURIComponent(
      `Bonjour ${v.name},\n\n` +
      `Tu as été invité comme vendeur Vision Affichage.\n\n` +
      `Connecte-toi ici : https://visionaffichage.com/admin/login\n` +
      `Ton courriel : ${v.email}\n` +
      `Mot de passe temporaire : vendeur123 (à changer après ta première connexion)\n\n` +
      `À bientôt,\nL'équipe Vision Affichage`,
    );
    window.location.href = `mailto:${encodeURIComponent(v.email)}?subject=${subject}&body=${body}`;
    setNewName('');
    setNewEmail('');
    setShowInvite(false);
  };

  const remove = (id: string) => {
    persist(customVendors.filter(v => v.id !== id));
  };

  const all = [...customVendors, ...SEED_VENDORS];

  return (
    <div className="space-y-6">
      <header className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">Vendeurs</h1>
          <p className="text-sm text-zinc-500 mt-1">Gère ton équipe et leurs accès · {all.length} vendeurs</p>
        </div>
        <button
          type="button"
          onClick={() => setShowInvite(true)}
          className="inline-flex items-center gap-2 text-sm font-bold px-4 py-2 bg-[#0052CC] text-white rounded-lg hover:opacity-90 shadow-md"
        >
          <Plus size={15} />
          Ajouter un vendeur
        </button>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {all.map(v => {
          const initials = v.name.split(' ').map(n => n[0]).slice(0, 2).join('');
          return (
            <div key={v.id} className="bg-white border border-zinc-200 rounded-2xl p-5 hover:shadow-lg transition-shadow group">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-[#0052CC] to-[#1B3A6B] text-white flex items-center justify-center font-extrabold text-sm">
                  {initials}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-bold truncate flex items-center gap-1.5">
                    {v.name}
                    {v.isCustom && (
                      <span className="text-[9px] font-bold bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded">
                        Nouveau
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-zinc-500 truncate flex items-center gap-1">
                    <Mail size={11} />
                    {v.email}
                  </div>
                </div>
                {v.isCustom && (
                  <button
                    type="button"
                    onClick={() => remove(v.id)}
                    className="opacity-0 group-hover:opacity-100 text-zinc-400 hover:text-rose-600 transition-all"
                    title="Retirer"
                  >
                    <Trash2 size={14} />
                  </button>
                )}
              </div>

              <div className="grid grid-cols-3 gap-2 mb-3">
                <div className="bg-zinc-50 rounded-lg p-2 text-center">
                  <div className="text-lg font-extrabold text-zinc-900">{v.quotesSent}</div>
                  <div className="text-[10px] text-zinc-500 uppercase tracking-wider">Devis</div>
                </div>
                <div className="bg-zinc-50 rounded-lg p-2 text-center">
                  <div className="text-lg font-extrabold text-emerald-600 inline-flex items-center gap-0.5">
                    {v.conversionRate}%
                    {v.conversionRate > 0 && <TrendingUp size={11} />}
                  </div>
                  <div className="text-[10px] text-zinc-500 uppercase tracking-wider">Conv.</div>
                </div>
                <div className="bg-zinc-50 rounded-lg p-2 text-center">
                  <div className="text-lg font-extrabold text-zinc-900">{(v.revenue / 1000).toFixed(0)}k</div>
                  <div className="text-[10px] text-zinc-500 uppercase tracking-wider">Ventes</div>
                </div>
              </div>

              <div className="flex items-center justify-between text-xs">
                <span className="text-zinc-500">Actif {v.lastActive}</span>
                <a
                  href={`mailto:${v.email}`}
                  className="text-[#0052CC] font-bold hover:underline"
                >
                  Contacter →
                </a>
              </div>
            </div>
          );
        })}
      </div>

      {showInvite && (
        <div className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setShowInvite(false)}>
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-extrabold">Inviter un vendeur</h2>
              <button onClick={() => setShowInvite(false)} className="text-zinc-400 hover:text-zinc-700">
                <X size={18} />
              </button>
            </div>
            <p className="text-sm text-zinc-500 mb-4">
              Le vendeur recevra une invitation par courriel avec un mot de passe temporaire.
            </p>
            <form onSubmit={handleInvite} className="space-y-3">
              <label className="block">
                <span className="text-[11px] font-bold text-zinc-500 uppercase tracking-wider">Nom complet</span>
                <input
                  type="text"
                  value={newName}
                  onChange={e => setNewName(e.target.value)}
                  required
                  placeholder="Marie Tremblay"
                  className="mt-1 w-full border border-zinc-200 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-[#0052CC]"
                />
              </label>
              <label className="block">
                <span className="text-[11px] font-bold text-zinc-500 uppercase tracking-wider">Courriel</span>
                <input
                  type="email"
                  value={newEmail}
                  onChange={e => setNewEmail(e.target.value)}
                  required
                  placeholder="marie@visionaffichage.com"
                  className="mt-1 w-full border border-zinc-200 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-[#0052CC]"
                />
              </label>
              <button
                type="submit"
                className="w-full py-3 bg-[#0052CC] text-white rounded-lg text-sm font-extrabold hover:opacity-90"
              >
                Envoyer l'invitation
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
