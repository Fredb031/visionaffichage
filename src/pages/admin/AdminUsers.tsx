import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Search, Plus, Crown, ShieldCheck, User, AlertCircle, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuthStore, type UserRole } from '@/stores/authStore';
import { useEscapeKey } from '@/hooks/useEscapeKey';

interface ProfileRow {
  id: string;
  email: string;
  full_name: string | null;
  role: UserRole;
  title: string | null;
  active: boolean;
  created_at: string;
}

const ROLE_TONE: Record<UserRole, string> = {
  president: 'bg-gradient-to-br from-[#E8A838] to-[#B37D10] text-white',
  admin: 'bg-blue-100 text-blue-800',
  vendor: 'bg-amber-100 text-amber-800',
  client: 'bg-zinc-100 text-zinc-700',
};

const ROLE_LABEL: Record<UserRole, string> = {
  president: 'Président',
  admin: 'Admin',
  vendor: 'Vendeur',
  client: 'Client',
};

export default function AdminUsers() {
  const me = useAuthStore(s => s.user);
  const [users, setUsers] = useState<ProfileRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<UserRole | 'all'>('all');
  const [showInvite, setShowInvite] = useState(false);
  const [inviteName, setInviteName] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'admin' | 'vendor'>('vendor');
  const [inviteSubmitting, setInviteSubmitting] = useState(false);
  const [inviteResult, setInviteResult] = useState<string | null>(null);
  const inviteNameRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchUsers();
  }, []);

  useEffect(() => {
    if (!showInvite) return;
    inviteNameRef.current?.focus();
  }, [showInvite]);
  useEscapeKey(showInvite, useCallback(() => {
    setShowInvite(false);
    setInviteResult(null);
  }, []));

  const fetchUsers = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('profiles')
      .select('id, email, full_name, role, title, active, created_at')
      .order('created_at', { ascending: false });
    if (error) {
      setError(error.message);
    } else {
      setUsers((data ?? []) as ProfileRow[]);
    }
    setLoading(false);
  };

  const filtered = useMemo(() => {
    return users.filter(u => {
      if (filter !== 'all' && u.role !== filter) return false;
      if (!query.trim()) return true;
      const q = query.toLowerCase();
      return u.email.toLowerCase().includes(q) || (u.full_name ?? '').toLowerCase().includes(q);
    });
  }, [users, query, filter]);

  const updateRole = async (userId: string, newRole: UserRole) => {
    if (userId === me?.id && newRole !== 'president' && me?.role === 'president') {
      toast.error('Tu ne peux pas retirer ton propre rôle Président.');
      return;
    }
    const { error } = await supabase.from('profiles').update({ role: newRole }).eq('id', userId);
    if (error) {
      toast.error(`Erreur : ${error.message}`);
      return;
    }
    setUsers(prev => prev.map(u => (u.id === userId ? { ...u, role: newRole } : u)));
    toast.success('Rôle mis à jour.');
  };

  const toggleActive = async (userId: string, current: boolean) => {
    const confirmMsg = current
      ? 'Désactiver cet utilisateur ? Il perdra l\u2019accès immédiatement.'
      : 'Réactiver cet utilisateur ?';
    if (!window.confirm(confirmMsg)) return;
    const { error } = await supabase.from('profiles').update({ active: !current }).eq('id', userId);
    if (error) {
      toast.error(`Erreur : ${error.message}`);
      return;
    }
    setUsers(prev => prev.map(u => (u.id === userId ? { ...u, active: !current } : u)));
    toast.success(current ? 'Utilisateur désactivé.' : 'Utilisateur réactivé.');
  };

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    setInviteSubmitting(true);
    setInviteResult(null);
    const { data, error } = await supabase.functions.invoke('admin-invite-vendor', {
      body: { email: inviteEmail, full_name: inviteName, role: inviteRole },
    });
    setInviteSubmitting(false);
    if (error) {
      setInviteResult(`Erreur : ${error.message}`);
      return;
    }
    setInviteResult(data?.warning ?? `Invitation envoyée à ${inviteEmail}.`);
    setInviteName('');
    setInviteEmail('');
    fetchUsers();
  };

  return (
    <div className="space-y-6">
      <header className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">Utilisateurs</h1>
          <p className="text-sm text-zinc-500 mt-1">{users.length} comptes · Tous synchronisés avec Supabase Auth</p>
        </div>
        <button
          type="button"
          onClick={() => setShowInvite(true)}
          className="inline-flex items-center gap-2 text-sm font-bold px-5 py-2.5 bg-[#0052CC] text-white rounded-lg hover:opacity-90 shadow-md"
        >
          <Plus size={15} />
          Inviter un membre
        </button>
      </header>

      {error && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 text-sm text-amber-900">
          <div className="flex items-start gap-2">
            <AlertCircle size={16} className="mt-0.5 flex-shrink-0" />
            <div>
              <strong>Migration non encore appliquée ?</strong> Cette page exige que la migration{' '}
              <code className="bg-white px-1 rounded">supabase/migrations/0001_auth_quotes_invites.sql</code> ait été exécutée
              dans Supabase Studio.
              <div className="text-xs mt-1 opacity-75">{error}</div>
            </div>
          </div>
        </div>
      )}

      <div className="bg-white border border-zinc-200 rounded-2xl overflow-hidden">
        <div className="p-4 flex items-center gap-3 border-b border-zinc-100 flex-wrap">
          <div className="flex items-center gap-2 flex-1 min-w-[220px] border border-zinc-200 rounded-lg px-3 py-2 bg-zinc-50">
            <Search size={16} className="text-zinc-400" />
            <input
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Rechercher par nom ou courriel"
              className="bg-transparent border-none outline-none text-sm flex-1"
            />
          </div>
          <select
            value={filter}
            onChange={e => setFilter(e.target.value as UserRole | 'all')}
            className="text-sm border border-zinc-200 rounded-lg px-3 py-2 bg-white outline-none focus:border-[#0052CC]"
          >
            <option value="all">Tous les rôles</option>
            <option value="president">Président</option>
            <option value="admin">Admin</option>
            <option value="vendor">Vendeur</option>
            <option value="client">Client</option>
          </select>
        </div>

        {loading ? (
          <div className="p-12 flex items-center justify-center">
            <Loader2 size={24} className="animate-spin text-[#0052CC]" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center text-zinc-400 text-sm">Aucun utilisateur</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-zinc-50 text-[11px] font-bold text-zinc-500 tracking-wider uppercase">
              <tr>
                <th className="text-left px-4 py-3">Utilisateur</th>
                <th className="text-left px-4 py-3">Rôle</th>
                <th className="text-left px-4 py-3">Statut</th>
                <th className="text-left px-4 py-3">Inscrit</th>
                <th className="text-right px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(u => {
                const initials = (u.full_name ?? u.email).split(/[\s@]/).map(s => s[0]).filter(Boolean).slice(0, 2).join('').toUpperCase();
                const isMe = u.id === me?.id;
                return (
                  <tr key={u.id} className="border-t border-zinc-100">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className={`w-9 h-9 rounded-full text-white flex items-center justify-center text-[11px] font-extrabold ${
                          u.role === 'president' ? 'bg-gradient-to-br from-[#E8A838] to-[#B37D10]' : 'bg-gradient-to-br from-[#0052CC] to-[#1B3A6B]'
                        }`}>
                          {initials}
                        </div>
                        <div className="min-w-0">
                          <div className="font-semibold flex items-center gap-1.5">
                            {u.role === 'president' && <Crown size={12} className="text-[#E8A838]" />}
                            {u.full_name ?? u.email.split('@')[0]}
                            {isMe && <span className="text-[10px] font-bold text-[#0052CC]">(toi)</span>}
                          </div>
                          <div className="text-xs text-zinc-500 truncate">{u.email}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <select
                        value={u.role}
                        onChange={e => updateRole(u.id, e.target.value as UserRole)}
                        disabled={isMe && u.role === 'president'}
                        className={`text-[11px] font-bold px-2 py-1 rounded-md outline-none cursor-pointer ${ROLE_TONE[u.role]} disabled:cursor-not-allowed`}
                      >
                        {(['president', 'admin', 'vendor', 'client'] as UserRole[]).map(r => (
                          <option key={r} value={r}>{ROLE_LABEL[r]}</option>
                        ))}
                      </select>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-[11px] font-bold ${u.active ? 'text-emerald-700' : 'text-rose-700'}`}>
                        {u.active ? '● Actif' : '● Désactivé'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-zinc-500 text-xs">
                      {new Date(u.created_at).toLocaleDateString('fr-CA', { year: 'numeric', month: 'short', day: 'numeric' })}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {!isMe && (
                        <button
                          type="button"
                          onClick={() => toggleActive(u.id, u.active)}
                          className="text-xs font-bold text-zinc-500 hover:text-zinc-900 hover:underline"
                        >
                          {u.active ? 'Désactiver' : 'Réactiver'}
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {showInvite && (
        <div
          className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="invite-member-title"
          onClick={() => { setShowInvite(false); setInviteResult(null); }}
        >
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl" onClick={e => e.stopPropagation()}>
            <h2 id="invite-member-title" className="text-lg font-extrabold mb-1">Inviter un membre</h2>
            <p className="text-sm text-zinc-500 mb-4">
              Le membre recevra un courriel avec un lien d'activation valide 7 jours.
            </p>

            {inviteResult && (
              <div className={`p-3 rounded-lg text-xs mb-3 ${inviteResult.startsWith('Erreur') ? 'bg-rose-50 text-rose-700' : 'bg-emerald-50 text-emerald-700'}`}>
                {inviteResult}
              </div>
            )}

            <form onSubmit={handleInvite} className="space-y-3">
              <label className="block">
                <span className="text-[11px] font-bold text-zinc-500 uppercase tracking-wider">Nom complet</span>
                <input ref={inviteNameRef} type="text" value={inviteName} onChange={e => setInviteName(e.target.value)} required autoComplete="name" placeholder="Marie Tremblay"
                  className="mt-1 w-full border border-zinc-200 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-[#0052CC]" />
              </label>
              <label className="block">
                <span className="text-[11px] font-bold text-zinc-500 uppercase tracking-wider">Courriel</span>
                <input type="email" value={inviteEmail} onChange={e => setInviteEmail(e.target.value)} required autoComplete="email" placeholder="marie@visionaffichage.com"
                  className="mt-1 w-full border border-zinc-200 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-[#0052CC]" />
              </label>
              <div>
                <span className="text-[11px] font-bold text-zinc-500 uppercase tracking-wider block mb-1.5">Rôle</span>
                <div className="grid grid-cols-2 gap-2">
                  {(['vendor', 'admin'] as const).map(r => {
                    const Icon = r === 'admin' ? ShieldCheck : User;
                    return (
                      <button
                        key={r}
                        type="button"
                        onClick={() => setInviteRole(r)}
                        className={`flex items-center gap-2 p-3 border-2 rounded-lg text-sm font-bold transition-all ${
                          inviteRole === r ? 'border-[#0052CC] bg-[#0052CC]/5 text-[#0052CC]' : 'border-zinc-200 text-zinc-600'
                        }`}
                      >
                        <Icon size={15} />
                        {ROLE_LABEL[r]}
                      </button>
                    );
                  })}
                </div>
              </div>
              <button type="submit" disabled={inviteSubmitting}
                className="w-full py-3 bg-[#0052CC] text-white rounded-lg text-sm font-extrabold hover:opacity-90 disabled:opacity-60">
                {inviteSubmitting ? 'Envoi…' : "Envoyer l'invitation"}
              </button>
              <button type="button" onClick={() => { setShowInvite(false); setInviteResult(null); }} className="w-full text-xs text-zinc-500 hover:text-zinc-900">
                Annuler
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
