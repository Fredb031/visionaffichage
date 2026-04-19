import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Lock, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuthStore } from '@/stores/authStore';

interface InviteRow {
  email: string;
  full_name: string;
  role: 'admin' | 'vendor';
  expires_at: string;
  used_at: string | null;
}

export default function AcceptInvite() {
  const { token } = useParams();
  const navigate = useNavigate();
  const updatePassword = useAuthStore(s => s.updatePassword);

  const [invite, setInvite] = useState<InviteRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!token) {
      setError('Lien invalide');
      setLoading(false);
      return;
    }
    (async () => {
      try {
        const { data, error } = await supabase
          .from('vendor_invites')
          .select('email, full_name, role, expires_at, used_at')
          .eq('token', token)
          .maybeSingle();
        if (error || !data) {
          setError('Cette invitation n\'existe pas ou a déjà été utilisée');
        } else if (data.used_at) {
          setError('Cette invitation a déjà été utilisée');
        } else if (new Date(data.expires_at) < new Date()) {
          setError('Cette invitation est expirée. Demande à un admin de t\'en envoyer une nouvelle.');
        } else {
          setInvite(data as InviteRow);
        }
      } catch (err) {
        // Supabase client can reject on network / auth / RLS changes.
        // Without this catch, setLoading(false) never fires and the
        // user stares at the loading spinner indefinitely.
        console.error('[AcceptInvite] Failed to fetch invite:', err);
        setError('Erreur réseau. Vérifie ta connexion et recharge la page.');
      } finally {
        setLoading(false);
      }
    })();
  }, [token]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    if (password !== confirm) {
      setError('Les mots de passe ne correspondent pas');
      return;
    }
    if (password.length < 8) {
      setError('Mot de passe trop court (minimum 8 caractères)');
      return;
    }
    setSubmitting(true);
    setError(null);

    try {
      // Set the password (user is already logged in via the magic-link redirect)
      const result = await updatePassword(password);
      if (!result.ok) {
        setError(useAuthStore.getState().error ?? 'Échec mise à jour mot de passe');
        return;
      }

      // Update profile role + mark invite used. Both writes are checked —
      // silent failures here meant the user landed on the "activated"
      // screen but their role was never actually set.
      const { data: { user }, error: userErr } = await supabase.auth.getUser();
      if (userErr || !user || !invite) {
        setError('Impossible de récupérer ta session. Reconnecte-toi et réessaie.');
        return;
      }
      // Security check: the logged-in session's email must match the invite.
      // Prevents someone pasting an invite link while logged in as another
      // account from accidentally taking over the invite.
      if ((user.email ?? '').toLowerCase() !== invite.email.toLowerCase()) {
        setError(`Cette invitation a été envoyée à ${invite.email}. Déconnecte-toi et ouvre le lien dans ton navigateur privé.`);
        return;
      }
      const { error: profileErr } = await supabase
        .from('profiles')
        .update({ role: invite.role, full_name: invite.full_name })
        .eq('id', user.id);
      if (profileErr) {
        setError(`Échec mise à jour du profil : ${profileErr.message}`);
        return;
      }
      const { error: inviteErr } = await supabase
        .from('vendor_invites')
        .update({ used_at: new Date().toISOString() })
        .eq('token', token!);
      if (inviteErr) {
        // Non-fatal: the user's role was updated, the invite is just
        // marked used. Log for admin visibility, continue.
        console.warn('[AcceptInvite] Could not mark invite used:', inviteErr);
      }

      setDone(true);
      setTimeout(() => navigate(invite.role === 'admin' ? '/admin' : '/vendor', { replace: true }), 1800);
    } catch (err) {
      // A thrown supabase call (network reject) would otherwise leave
      // the button disabled forever with no feedback. Surface + release.
      console.error('[AcceptInvite] submit threw:', err);
      setError('Erreur réseau. Réessaie ou appelle-nous au 367-380-4808.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#0F2341] via-[#1B3A6B] to-[#0F2341] px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <img
            src="https://visionaffichage.com/cdn/shop/files/Logo-vision-horizontal-blanc.png?height=135&v=1694121209"
            alt="Vision Affichage"
            className="h-9 mx-auto mb-6 opacity-90"
          />
          <h1 className="text-2xl font-extrabold text-white mb-1">Bienvenue dans l'équipe</h1>
          <p className="text-sm text-white/60">Choisis ton mot de passe pour activer ton compte</p>
        </div>

        {loading ? (
          <div className="bg-white rounded-2xl p-12 shadow-2xl text-center" role="status" aria-label="Chargement de l'invitation">
            <Loader2 size={28} className="animate-spin text-[#0052CC] mx-auto" aria-hidden="true" />
          </div>
        ) : error && !invite ? (
          <div className="bg-white rounded-2xl p-6 md:p-8 shadow-2xl text-center" role="alert">
            <AlertCircle size={28} className="text-amber-500 mx-auto mb-3" aria-hidden="true" />
            <h2 className="text-lg font-extrabold mb-2">{error}</h2>
            <Link
              to="/admin/login"
              className="text-sm font-bold text-[#0052CC] hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0052CC] focus-visible:ring-offset-1 rounded"
            >
              Retour à la connexion
            </Link>
          </div>
        ) : done ? (
          <div className="bg-white rounded-2xl p-6 md:p-8 shadow-2xl text-center" role="status">
            <div className="w-14 h-14 rounded-full bg-emerald-500 text-white flex items-center justify-center mx-auto mb-4">
              <CheckCircle2 size={28} strokeWidth={2.5} aria-hidden="true" />
            </div>
            <h2 className="text-lg font-extrabold mb-2">Compte activé</h2>
            <p className="text-sm text-zinc-600">Redirection vers ton tableau de bord…</p>
          </div>
        ) : invite ? (
          <form onSubmit={onSubmit} className="bg-white rounded-2xl p-6 md:p-8 shadow-2xl space-y-4">
            <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 text-xs">
              <div className="font-bold text-emerald-900">{invite.full_name}</div>
              <div className="text-emerald-700">{invite.email}</div>
              <div className="text-[10px] uppercase tracking-wider font-bold text-emerald-600 mt-1">
                Rôle : {invite.role === 'admin' ? 'Administrateur' : 'Vendeur'}
              </div>
            </div>

            {error && (
              <div role="alert" className="flex items-start gap-2 p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-lg text-xs">
                <AlertCircle size={14} className="flex-shrink-0 mt-0.5" aria-hidden="true" />
                <span>{error}</span>
              </div>
            )}

            <label className="block">
              <span className="text-[11px] font-bold text-zinc-500 uppercase tracking-wider">Mot de passe (min 8)</span>
              <div className="mt-1.5 relative">
                <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" aria-hidden="true" />
                <input
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  minLength={8}
                  autoComplete="new-password"
                  className="w-full pl-10 pr-3 py-3 border border-zinc-200 rounded-xl text-sm outline-none focus:border-[#0052CC]"
                />
              </div>
            </label>

            <label className="block">
              <span className="text-[11px] font-bold text-zinc-500 uppercase tracking-wider">Confirmer</span>
              <div className="mt-1.5 relative">
                <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" aria-hidden="true" />
                <input
                  type="password"
                  value={confirm}
                  onChange={e => setConfirm(e.target.value)}
                  required
                  minLength={8}
                  autoComplete="new-password"
                  className="w-full pl-10 pr-3 py-3 border border-zinc-200 rounded-xl text-sm outline-none focus:border-[#0052CC]"
                />
              </div>
            </label>

            <button
              type="submit"
              disabled={submitting}
              className="w-full py-3.5 bg-gradient-to-br from-[#0052CC] to-[#1B3A6B] text-white rounded-xl text-sm font-extrabold disabled:opacity-60 hover:shadow-xl transition-all focus:outline-none focus-visible:ring-4 focus-visible:ring-[#E8A838]/60 focus-visible:ring-offset-2"
            >
              {submitting ? 'Activation…' : 'Activer mon compte'}
            </button>
          </form>
        ) : null}
      </div>
    </div>
  );
}
