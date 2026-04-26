import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Search, Plus, Crown, ShieldCheck, User, AlertCircle, Loader2, KeyRound, Check, Download } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuthStore, type UserRole } from '@/stores/authStore';
import { useEscapeKey } from '@/hooks/useEscapeKey';
import { useBodyScrollLock } from '@/hooks/useBodyScrollLock';
import { useFocusTrap } from '@/hooks/useFocusTrap';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { useSearchHotkey } from '@/hooks/useSearchHotkey';
import { isValidEmail, normalizeInvisible } from '@/lib/utils';
import {
  ALL_PERMISSIONS,
  ROLE_PERMISSIONS,
  coerceToPermissionRole,
  hasPermission,
  loadOverrides,
  saveOverrides,
  type Permission,
} from '@/lib/permissions';
import { logAdminAction } from '@/lib/auditLog';
import { getUser2faMap } from '@/lib/appSettings';
import { downloadCsv } from '@/lib/csv';

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
  salesman: 'bg-indigo-100 text-indigo-800',
  vendor: 'bg-amber-100 text-amber-800',
  client: 'bg-zinc-100 text-zinc-700',
};

const ROLE_LABEL: Record<UserRole, string> = {
  president: 'Président',
  admin: 'Admin',
  salesman: 'Représentant commercial',
  vendor: 'Vendeur',
  client: 'Client',
};

const VALID_ROLE_FILTERS: readonly (UserRole | 'all')[] = ['all', 'president', 'admin', 'salesman', 'vendor', 'client'];

/** Generate and download a CSV for the currently filtered user list.
 * Delegates escaping / BOM / download mechanics to @/lib/csv so the
 * users export stays in lockstep with the other admin exports (orders,
 * customers, quotes, …). fr-CA dates match the table display. */
function exportUsersCsv(rows: ProfileRow[], twoFa: Record<string, boolean>) {
  const fmtDate = (iso: string) => {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '';
    return d.toLocaleDateString('fr-CA', { year: 'numeric', month: '2-digit', day: '2-digit' });
  };
  const header = ['Nom', 'Courriel', 'Rôle', 'Statut', 'Inscrit le', '2FA'];
  const body = rows.map(u => [
    (u.full_name ?? '').trim() || u.email.split('@')[0],
    u.email,
    ROLE_LABEL[u.role] ?? u.role,
    u.active ? 'Actif' : 'Désactivé',
    fmtDate(u.created_at),
    twoFa[u.id] ? 'Oui' : 'Non',
  ]);
  const filename = `users-${new Date().toISOString().slice(0, 10)}.csv`;
  downloadCsv([header, ...body], filename);
  toast.success(`${rows.length} utilisateur${rows.length > 1 ? 's' : ''} exporté${rows.length > 1 ? 's' : ''}`);
}

export default function AdminUsers() {
  useDocumentTitle('Comptes & accès — Admin Vision Affichage');
  // URL-backed search/filter — same pattern as the other admin tables.
  const [searchParams, setSearchParams] = useSearchParams();
  const initialQuery = searchParams.get('q') ?? '';
  const initialFilterRaw = searchParams.get('filter') ?? 'all';
  const initialFilter: UserRole | 'all' = (VALID_ROLE_FILTERS as readonly string[]).includes(initialFilterRaw)
    ? (initialFilterRaw as UserRole | 'all')
    : 'all';

  const me = useAuthStore(s => s.user);
  const [users, setUsers] = useState<ProfileRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState(initialQuery);
  const [filter, setFilter] = useState<UserRole | 'all'>(initialFilter);
  const searchRef = useSearchHotkey({ onClear: () => setQuery('') });

  // Sync state → URL with replace history.
  useEffect(() => {
    const next = new URLSearchParams(searchParams);
    const trimmed = query.trim();
    if (trimmed) next.set('q', trimmed); else next.delete('q');
    if (filter !== 'all') next.set('filter', filter); else next.delete('filter');
    if (next.toString() !== searchParams.toString()) {
      setSearchParams(next, { replace: true });
    }
  }, [query, filter, searchParams, setSearchParams]);
  const [showInvite, setShowInvite] = useState(false);
  const [inviteName, setInviteName] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'admin' | 'vendor'>('vendor');
  const [inviteSubmitting, setInviteSubmitting] = useState(false);
  const [inviteResult, setInviteResult] = useState<string | null>(null);
  const inviteNameRef = useRef<HTMLInputElement>(null);
  const trapRef = useFocusTrap<HTMLDivElement>(showInvite);

  // Permission-override dialog state. `permsTarget` is the ProfileRow the
  // admin is editing; `permsDraft` is the in-flight override list
  // (committed to localStorage only when they click Save). Keeping the
  // draft separate means ESC cancels cleanly without writing partials.
  const [permsTarget, setPermsTarget] = useState<ProfileRow | null>(null);
  const [permsDraft, setPermsDraft] = useState<Permission[]>([]);
  const permsTrapRef = useFocusTrap<HTMLDivElement>(permsTarget !== null);
  useEscapeKey(permsTarget !== null, useCallback(() => setPermsTarget(null), []));
  useBodyScrollLock(permsTarget !== null);

  const openPerms = useCallback((u: ProfileRow) => {
    const map = loadOverrides();
    setPermsDraft(map[u.id] ?? []);
    setPermsTarget(u);
  }, []);

  const togglePermOverride = useCallback((perm: Permission) => {
    setPermsDraft(prev => prev.includes(perm) ? prev.filter(p => p !== perm) : [...prev, perm]);
  }, []);

  const savePermOverrides = useCallback(() => {
    if (!permsTarget) return;
    const map = loadOverrides();
    if (permsDraft.length === 0) {
      delete map[permsTarget.id];
    } else {
      map[permsTarget.id] = permsDraft;
    }
    saveOverrides(map);
    toast.success('Permissions mises à jour.');
    setPermsTarget(null);
  }, [permsTarget, permsDraft]);

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
  useBodyScrollLock(showInvite);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, email, full_name, role, title, active, created_at')
        .order('created_at', { ascending: false });
      if (error) {
        setError(error.message);
      } else {
        setUsers((data ?? []) as ProfileRow[]);
      }
    } catch (err) {
      // supabase-js throws on network/CORS/DNS rejects before the
      // response object is built. Without this catch the loading
      // spinner sat forever while the admin stared at an empty list.
      console.error('[AdminUsers] fetchUsers threw:', err);
      setError('Erreur réseau. Vérifie ta connexion et recharge la page.');
    } finally {
      setLoading(false);
    }
  };

  // Task 9.20 — per-user 2FA status, read from localStorage. The admin
  // can't toggle this from here (the enrolment flow lives in each
  // user's own profile) but we surface the state so they can spot who
  // still hasn't enabled it. Memoised against the users list so a
  // subsequent role-change re-render doesn't re-read localStorage for
  // every row.
  const twoFaMap = useMemo<Record<string, boolean>>(() => getUser2faMap(), [users]);

  const filtered = useMemo(() => {
    // Strip invisibles in both the search term and the indexed fields
    // — same reasoning as AdminOrders / AdminCustomers.
    const q = normalizeInvisible(query).trim().toLowerCase();
    return users.filter(u => {
      if (filter !== 'all' && u.role !== filter) return false;
      if (!q) return true;
      const email = normalizeInvisible(u.email).toLowerCase();
      const name = normalizeInvisible(u.full_name ?? '').toLowerCase();
      return email.includes(q) || name.includes(q);
    });
  }, [users, query, filter]);

  const updateRole = async (userId: string, newRole: UserRole) => {
    if (userId === me?.id && newRole !== 'president' && me?.role === 'president') {
      toast.error('Tu ne peux pas retirer ton propre rôle Président.');
      return;
    }
    // Last-admin guard — if downgrading the only remaining admin (who
    // isn't a president) the team would have nobody able to manage the
    // /admin surface. Block to prevent locking the org out of its own
    // back office. President accounts always retain access so they
    // count toward the safe-min as well.
    const target = users.find(u => u.id === userId);
    if (target && target.role === 'admin' && newRole !== 'admin') {
      const remainingAdmins = users.filter(
        u => u.id !== userId && (u.role === 'admin' || u.role === 'president') && u.active,
      ).length;
      if (remainingAdmins === 0) {
        toast.error('Impossible : c\'est le dernier compte avec accès admin. Promote quelqu\'un d\'autre d\'abord.');
        return;
      }
    }
    // Confirm any other self-demotion. An admin who clicks the wrong row
    // shouldn't silently lose their own access on a misclick — without
    // this, a Customer-row click immediately wiped their admin role and
    // the very next page nav bounced them to /admin/login.
    if (userId === me?.id && newRole !== me?.role) {
      const ok = window.confirm(
        `Tu es sur le point de changer ton propre rôle (${ROLE_LABEL[me.role]} → ${ROLE_LABEL[newRole]}). Tu pourrais perdre l'accès à cette page. Continuer ?`,
      );
      if (!ok) return;
    }
    try {
      const { error } = await supabase.from('profiles').update({ role: newRole }).eq('id', userId);
      if (error) {
        toast.error(`Erreur : ${error.message}`);
        return;
      }
      // Task 9.19 — capture from/to so the audit trail reads like a
      // diff. We pull `from` off the pre-update target snapshot (not
      // the post-setUsers state) so the log reflects the real
      // transition, not a no-op.
      const fromRole = target?.role ?? 'unknown';
      setUsers(prev => prev.map(u => (u.id === userId ? { ...u, role: newRole } : u)));
      logAdminAction('user.role_changed', { userId, from: fromRole, to: newRole });
      toast.success('Rôle mis à jour.');
    } catch (err) {
      // supabase-js can throw on network/DNS/CORS rejects before the
      // response ever arrives — that previously bypassed the error
      // branch and left the admin with no feedback.
      console.error('[AdminUsers] updateRole threw:', err);
      toast.error('Erreur réseau. Réessaie dans un instant.');
    }
  };

  const toggleActive = async (userId: string, current: boolean) => {
    // Same lock-out guard as updateRole — deactivating the last admin
    // (or the user's own account when they're the last admin) leaves
    // /admin with nobody to manage it. Block before the confirm modal
    // so the message reads as 'this is impossible' not 'do you want to'.
    if (current) {
      const target = users.find(u => u.id === userId);
      if (target && (target.role === 'admin' || target.role === 'president')) {
        const remainingAdmins = users.filter(
          u => u.id !== userId && (u.role === 'admin' || u.role === 'president') && u.active,
        ).length;
        if (remainingAdmins === 0) {
          toast.error('Impossible : c\'est le dernier compte avec accès admin actif. Promote ou réactive quelqu\'un d\'autre d\'abord.');
          return;
        }
      }
    }
    const confirmMsg = current
      ? 'Désactiver cet utilisateur ? Il perdra l\u2019accès immédiatement.'
      : 'Réactiver cet utilisateur ?';
    if (!window.confirm(confirmMsg)) return;
    try {
      const { error } = await supabase.from('profiles').update({ active: !current }).eq('id', userId);
      if (error) {
        toast.error(`Erreur : ${error.message}`);
        return;
      }
      setUsers(prev => prev.map(u => (u.id === userId ? { ...u, active: !current } : u)));
      toast.success(current ? 'Utilisateur désactivé.' : 'Utilisateur réactivé.');
    } catch (err) {
      console.error('[AdminUsers] toggleActive threw:', err);
      toast.error('Erreur réseau. Réessaie dans un instant.');
    }
  };

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (inviteSubmitting) return;
    // Strip invisible chars BEFORE we store. isValidEmail already
    // does this internally for the validity check, but the raw
    // inviteEmail value was what got sent to the edge function,
    // so a ZWSP paste from Slack/Notion lived in vendor_invites
    // and AcceptInvite's strict email compare bounced the invitee.
    const cleanEmail = normalizeInvisible(inviteEmail).trim().toLowerCase();
    const cleanName = normalizeInvisible(inviteName).trim();
    if (!cleanName || !isValidEmail(cleanEmail)) {
      setInviteResult('Nom + courriel valides requis.');
      return;
    }
    setInviteSubmitting(true);
    setInviteResult(null);
    try {
      const { data, error } = await supabase.functions.invoke('admin-invite-vendor', {
        body: { email: cleanEmail, full_name: cleanName, role: inviteRole },
      });
      if (error) {
        setInviteResult(`Erreur : ${error.message}`);
        return;
      }
      setInviteResult(data?.warning ?? `Invitation envoyée à ${cleanEmail}.`);
      setInviteName('');
      setInviteEmail('');
      fetchUsers();
    } catch (err) {
      // supabase.functions.invoke can reject on network/DNS issues —
      // without a finally this used to leave the Envoyer button
      // disabled forever. Log + surface a generic error.
      console.error('[AdminUsers] admin-invite-vendor threw:', err);
      setInviteResult('Erreur réseau. Vérifie ta connexion et réessaie.');
    } finally {
      setInviteSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <header className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">Utilisateurs</h1>
          <p className="text-sm text-zinc-500 mt-1">{users.length} comptes · Tous synchronisés avec Supabase Auth</p>
          <p className="text-[11px] text-zinc-400 mt-1 inline-flex items-center gap-1">
            <ShieldCheck size={11} className="text-emerald-600" aria-hidden="true" />
            Les utilisateurs activent la 2FA depuis leur profil.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => exportUsersCsv(filtered, twoFaMap)}
            disabled={filtered.length === 0}
            // Disabled when the filter yields nothing — mirrors
            // AdminOrders: a header-only CSV is noise and the tooltip
            // tells the admin the filter is the thing to change.
            className="inline-flex items-center gap-2 text-sm font-bold px-4 py-2.5 border border-zinc-200 rounded-lg hover:bg-zinc-50 bg-white transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0052CC] focus-visible:ring-offset-1 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-white"
            title={filtered.length === 0 ? 'Aucun utilisateur à exporter' : 'Exporter en CSV'}
            aria-label={
              filtered.length === 0
                ? 'Aucun utilisateur à exporter'
                : `Exporter ${filtered.length} utilisateur${filtered.length > 1 ? 's' : ''} en CSV`
            }
          >
            <Download size={15} aria-hidden="true" />
            Exporter CSV
          </button>
          <button
            type="button"
            onClick={() => setShowInvite(true)}
            className="inline-flex items-center gap-2 text-sm font-bold px-5 py-2.5 bg-[#0052CC] text-white rounded-xl hover:bg-[#003D99] shadow-md transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0052CC] focus-visible:ring-offset-2 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Plus size={15} aria-hidden="true" />
            Inviter un membre
          </button>
        </div>
      </header>

      {error && (
        <div role="alert" className="bg-amber-50 border border-amber-200 rounded-2xl p-4 text-sm text-amber-900">
          <div className="flex items-start gap-2">
            <AlertCircle size={16} className="mt-0.5 flex-shrink-0" aria-hidden="true" />
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
            <Search size={16} className="text-zinc-400" aria-hidden="true" />
            <input
              ref={searchRef}
              type="search"
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Rechercher par nom ou courriel  (⌘K)"
              aria-label="Rechercher par nom ou courriel"
              aria-keyshortcuts="Meta+K Control+K"
              className="bg-transparent border-none outline-none text-sm flex-1"
            />
          </div>
          <select
            value={filter}
            onChange={e => setFilter(e.target.value as UserRole | 'all')}
            aria-label="Filtrer par rôle"
            className="text-sm border border-zinc-200 rounded-lg px-3 py-2 bg-white outline-none focus:border-[#0052CC] focus-visible:ring-2 focus-visible:ring-[#0052CC]/25"
          >
            <option value="all">Tous les rôles</option>
            <option value="president">Président</option>
            <option value="admin">Admin</option>
            <option value="salesman">Représentant commercial</option>
            <option value="vendor">Vendeur</option>
            <option value="client">Client</option>
          </select>
        </div>

        {loading ? (
          <div className="p-12 flex items-center justify-center" role="status" aria-label="Chargement des utilisateurs">
            <Loader2 size={24} className="animate-spin text-[#0052CC]" aria-hidden="true" />
          </div>
        ) : filtered.length === 0 ? (
          // Differentiate "no users at all" from "filters yielded nothing".
          // The second case gives the admin a one-click reset so they
          // aren't stuck wondering why the list looks empty after an
          // over-specific search.
          users.length === 0 ? (
            <div className="p-12 text-center">
              <div className="mx-auto w-12 h-12 rounded-full bg-zinc-100 flex items-center justify-center mb-3">
                <User size={20} className="text-zinc-400" aria-hidden="true" />
              </div>
              <p className="text-sm font-bold text-zinc-700">Aucun utilisateur</p>
              <p className="text-xs text-zinc-500 mt-1">Invite un premier membre pour démarrer.</p>
            </div>
          ) : (
            <div className="p-12 text-center">
              <div className="mx-auto w-12 h-12 rounded-full bg-zinc-100 flex items-center justify-center mb-3">
                <Search size={20} className="text-zinc-400" aria-hidden="true" />
              </div>
              <p className="text-sm font-bold text-zinc-700">Aucun résultat pour ces filtres</p>
              <p className="text-xs text-zinc-500 mt-1">
                {users.length} utilisateur{users.length > 1 ? 's' : ''} au total.
              </p>
              <button
                type="button"
                onClick={() => { setQuery(''); setFilter('all'); }}
                className="mt-4 inline-flex items-center gap-2 text-xs font-bold px-4 py-2 border border-zinc-200 rounded-lg hover:bg-zinc-50 bg-white focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0052CC] focus-visible:ring-offset-1"
              >
                Réinitialiser
              </button>
            </div>
          )
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
                // ?? keeps '' (only null/undefined fall through), so a legacy
                // profile row with full_name = '' used to render a blank
                // avatar circle and a blank display name. Fall back to the
                // email's local-part for any empty/whitespace-only full_name
                // so the avatar initials match the name we render below
                // (previously the avatar derived initials from the full
                // email — 'fred@example.com' → 'FE' — but the row showed
                // 'fred', causing a visible mismatch).
                const displayName = (u.full_name ?? '').trim() || u.email.split('@')[0];
                const initials = displayName.split(/[\s@]/).map(s => s[0]).filter(Boolean).slice(0, 2).join('').toUpperCase();
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
                            {u.role === 'president' && <Crown size={12} className="text-[#E8A838]" aria-label="Président" />}
                            {(u.full_name ?? '').trim() || u.email.split('@')[0]}
                            {isMe && <span className="text-[10px] font-bold text-[#0052CC]">(toi)</span>}
                            {twoFaMap[u.id] && (
                              <span
                                title="2FA activée"
                                aria-label="2FA activée"
                                className="inline-flex items-center gap-0.5 text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-md bg-emerald-100 text-emerald-800"
                              >
                                <ShieldCheck size={10} aria-hidden="true" />
                                2FA
                              </span>
                            )}
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
                        aria-label={`Rôle pour ${displayName}`}
                        className={`text-[11px] font-bold px-2 py-1 rounded-md outline-none cursor-pointer focus-visible:ring-2 focus-visible:ring-[#0052CC] focus-visible:ring-offset-1 ${ROLE_TONE[u.role]} disabled:cursor-not-allowed`}
                      >
                        {(['president', 'admin', 'salesman', 'vendor', 'client'] as UserRole[]).map(r => (
                          <option key={r} value={r}>{ROLE_LABEL[r]}</option>
                        ))}
                      </select>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-[11px] font-bold ${u.active ? 'text-emerald-700' : 'text-rose-700'}`}>
                        <span aria-hidden="true">● </span>{u.active ? 'Actif' : 'Désactivé'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-zinc-500 text-xs">
                      {new Date(u.created_at).toLocaleDateString('fr-CA', { year: 'numeric', month: 'short', day: 'numeric' })}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="inline-flex items-center gap-3 justify-end">
                        <button
                          type="button"
                          onClick={() => openPerms(u)}
                          aria-label={`Gérer les permissions de ${displayName}`}
                          className="inline-flex items-center gap-1 text-xs font-bold text-[#0052CC] hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0052CC] focus-visible:ring-offset-1 rounded"
                        >
                          <KeyRound size={13} aria-hidden="true" />
                          Permissions
                        </button>
                        {!isMe && (
                          <button
                            type="button"
                            onClick={() => toggleActive(u.id, u.active)}
                            aria-label={u.active
                              ? `Désactiver ${displayName}`
                              : `Réactiver ${displayName}`}
                            className="text-xs font-bold text-zinc-500 hover:text-zinc-900 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0052CC] focus-visible:ring-offset-1 rounded"
                          >
                            {u.active ? 'Désactiver' : 'Réactiver'}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {permsTarget && (() => {
        // Compute the effective matrix on each render: role default OR
        // override. Passing permsDraft as the overrides argument shows
        // the admin the live preview of what will be saved, instead of
        // the stale committed state.
        const targetRole = coerceToPermissionRole(permsTarget.role);
        const targetName = (permsTarget.full_name ?? '').trim() || permsTarget.email;
        // Group permissions by resource for a cleaner layout. We derive
        // the groups on the fly rather than hardcoding them so new
        // permissions in ALL_PERMISSIONS show up automatically.
        const groups: Record<string, Permission[]> = {};
        for (const p of ALL_PERMISSIONS) {
          const [resource] = p.split(':');
          if (!groups[resource]) groups[resource] = [];
          groups[resource].push(p);
        }
        return (
          <div
            className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4"
            role="dialog"
            aria-modal="true"
            aria-labelledby="perms-dialog-title"
            onClick={() => setPermsTarget(null)}
          >
            <div
              ref={permsTrapRef}
              tabIndex={-1}
              className="bg-white rounded-2xl p-6 w-full max-w-2xl shadow-2xl focus:outline-none max-h-[85vh] overflow-y-auto"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-start justify-between gap-3 mb-1">
                <div>
                  <h2 id="perms-dialog-title" className="text-lg font-extrabold tracking-tight">
                    Permissions — {targetName}
                  </h2>
                  <p className="text-xs text-zinc-500 mt-0.5">
                    Rôle de base : <span className="font-bold text-zinc-700">{ROLE_LABEL[permsTarget.role]}</span>
                    {' · '}
                    {ROLE_PERMISSIONS[targetRole]?.length ?? 0} permission(s) par défaut
                  </p>
                </div>
                <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-md bg-[#0052CC]/10 text-[#0052CC]">
                  Override
                </span>
              </div>
              <p className="text-xs text-zinc-500 mb-4">
                Coche une permission pour l'accorder manuellement à cet utilisateur, en plus de son rôle.
                Les permissions déjà incluses dans le rôle sont affichées en vert.
              </p>

              <div className="space-y-4">
                {Object.entries(groups).map(([resource, perms]) => (
                  <fieldset key={resource} className="border border-zinc-200 rounded-xl p-3">
                    <legend className="px-2 text-[11px] font-bold uppercase tracking-wider text-zinc-500">
                      {resource}
                    </legend>
                    <div className="grid grid-cols-2 gap-2 mt-1">
                      {perms.map(p => {
                        const fromRole = hasPermission(targetRole, p);
                        const fromOverride = permsDraft.includes(p);
                        const effective = fromRole || fromOverride;
                        return (
                          <label
                            key={p}
                            className={`flex items-center gap-2 text-xs font-medium px-3 py-2 rounded-lg border cursor-pointer transition-colors ${
                              effective
                                ? fromRole
                                  ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
                                  : 'border-[#0052CC]/40 bg-[#0052CC]/5 text-[#0052CC]'
                                : 'border-zinc-200 bg-white text-zinc-600 hover:border-zinc-300'
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={fromOverride}
                              onChange={() => togglePermOverride(p)}
                              className="sr-only"
                              aria-label={`Override ${p}`}
                            />
                            <span className={`w-4 h-4 flex items-center justify-center rounded border flex-shrink-0 ${
                              fromOverride
                                ? 'bg-[#0052CC] border-[#0052CC] text-white'
                                : fromRole
                                  ? 'bg-emerald-500 border-emerald-500 text-white'
                                  : 'bg-white border-zinc-300'
                            }`}>
                              {(fromOverride || fromRole) && <Check size={11} strokeWidth={3} aria-hidden="true" />}
                            </span>
                            <span className="font-mono">{p}</span>
                            {fromRole && !fromOverride && (
                              <span className="ml-auto text-[10px] font-bold uppercase tracking-wider opacity-60">rôle</span>
                            )}
                          </label>
                        );
                      })}
                    </div>
                  </fieldset>
                ))}
              </div>

              <div className="mt-5 flex items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={() => setPermsDraft([])}
                  className="text-xs font-bold text-zinc-500 hover:text-rose-600 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0052CC] focus-visible:ring-offset-1 rounded"
                >
                  Effacer tous les overrides
                </button>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setPermsTarget(null)}
                    className="text-xs font-bold text-zinc-600 px-4 py-2 rounded-lg border border-zinc-200 hover:bg-zinc-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0052CC] focus-visible:ring-offset-1"
                  >
                    Annuler
                  </button>
                  <button
                    type="button"
                    onClick={savePermOverrides}
                    className="text-xs font-extrabold text-white px-5 py-2 rounded-xl bg-[#0052CC] hover:bg-[#003D99] transition-all focus:outline-none focus-visible:ring-4 focus-visible:ring-[#E8A838]/60 focus-visible:ring-offset-1 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    Enregistrer
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {showInvite && (
        <div
          className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="invite-member-title"
          onClick={() => { setShowInvite(false); setInviteResult(null); }}
        >
          <div
            ref={trapRef}
            tabIndex={-1}
            className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl focus:outline-none"
            onClick={e => e.stopPropagation()}
          >
            <h2 id="invite-member-title" className="text-lg font-extrabold mb-1">Inviter un membre</h2>
            <p className="text-sm text-zinc-500 mb-4">
              Le membre recevra un courriel avec un lien d'activation valide 7 jours.
            </p>

            {inviteResult && (
              <div
                role={inviteResult.startsWith('Erreur') ? 'alert' : 'status'}
                className={`p-3 rounded-lg text-xs mb-3 ${inviteResult.startsWith('Erreur') ? 'bg-rose-50 text-rose-700' : 'bg-emerald-50 text-emerald-700'}`}
              >
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
                {(() => {
                  const invalid = inviteEmail.trim().length > 0 && !isValidEmail(inviteEmail);
                  return (
                    <input
                      type="email"
                      value={inviteEmail}
                      onChange={e => setInviteEmail(e.target.value)}
                      required
                      autoComplete="email"
                      placeholder="marie@visionaffichage.com"
                      aria-invalid={invalid || undefined}
                      className={`mt-1 w-full border rounded-lg px-3 py-2.5 text-sm outline-none ${
                        invalid ? 'border-rose-300 focus:border-rose-500' : 'border-zinc-200 focus:border-[#0052CC]'
                      }`}
                    />
                  );
                })()}
              </label>
              <div>
                <span id="invite-role-label" className="text-[11px] font-bold text-zinc-500 uppercase tracking-wider block mb-1.5">Rôle</span>
                <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-labelledby="invite-role-label">
                  {(['vendor', 'admin'] as const).map(r => {
                    const Icon = r === 'admin' ? ShieldCheck : User;
                    return (
                      <button
                        key={r}
                        type="button"
                        role="radio"
                        aria-checked={inviteRole === r}
                        onClick={() => setInviteRole(r)}
                        className={`flex items-center gap-2 p-3 border-2 rounded-lg text-sm font-bold transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0052CC] focus-visible:ring-offset-1 ${
                          inviteRole === r ? 'border-[#0052CC] bg-[#0052CC]/5 text-[#0052CC]' : 'border-zinc-200 text-zinc-600'
                        }`}
                      >
                        <Icon size={15} aria-hidden="true" />
                        {ROLE_LABEL[r]}
                      </button>
                    );
                  })}
                </div>
              </div>
              <button
                type="submit"
                disabled={inviteSubmitting}
                className="w-full py-3 bg-[#0052CC] text-white rounded-xl text-sm font-extrabold hover:bg-[#003D99] transition-all disabled:opacity-40 disabled:cursor-not-allowed focus:outline-none focus-visible:ring-4 focus-visible:ring-[#E8A838]/60 focus-visible:ring-offset-2"
              >
                {inviteSubmitting ? 'Envoi…' : "Envoyer l'invitation"}
              </button>
              <button
                type="button"
                onClick={() => { setShowInvite(false); setInviteResult(null); }}
                className="w-full text-xs text-zinc-500 hover:text-zinc-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0052CC] focus-visible:ring-offset-1 rounded"
              >
                Annuler
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
