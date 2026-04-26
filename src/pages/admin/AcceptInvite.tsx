import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Lock, CheckCircle2, AlertCircle, Loader2, Eye, EyeOff } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuthStore } from '@/stores/authStore';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { normalizeInvisible } from '@/lib/utils';

interface InviteRow {
  email: string;
  full_name: string;
  role: 'admin' | 'vendor';
  expires_at: string;
  used_at: string | null;
}

/**
 * Rough password strength score (0-3). Counts length ≥ 8, length ≥ 12,
 * and character-class variety (letters + digits/symbols). Purely a UX
 * hint — the real minimum is still enforced on submit.
 */
function scorePassword(pwd: string): 0 | 1 | 2 | 3 {
  if (!pwd) return 0;
  let s = 0;
  if (pwd.length >= 8) s += 1;
  if (pwd.length >= 12) s += 1;
  const hasLetter = /[A-Za-z]/.test(pwd);
  const hasDigit = /\d/.test(pwd);
  const hasSymbol = /[^A-Za-z0-9]/.test(pwd);
  if (hasLetter && (hasDigit || hasSymbol)) s += 1;
  return Math.min(s, 3) as 0 | 1 | 2 | 3;
}

/**
 * AcceptInvite — landing page for the `/admin/accept-invite/:token` magic link.
 * Validates the invite token, lets the invitee choose a password, stamps their
 * profile role, and marks the invite used before redirecting to their space.
 */
export default function AcceptInvite() {
  const { token } = useParams();
  const navigate = useNavigate();
  const updatePassword = useAuthStore(s => s.updatePassword);
  // Auth-tab disambiguation so an invitee who revisits the magic link
  // (or has multiple admin tabs open) recognises this one in the strip.
  useDocumentTitle('Activer mon compte — Vision Affichage');

  const [invite, setInvite] = useState<InviteRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  // Per-input show/hide + caps-lock tracking. Helps invitees catch a
  // typo'd password before activating (which auto-logs them in).
  const [showPwd, setShowPwd] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [capsOn, setCapsOn] = useState(false);
  const [pwdFocus, setPwdFocus] = useState<null | 'password' | 'confirm'>(null);
  const handleCapsCheck = (e: React.KeyboardEvent<HTMLInputElement>) => {
    setCapsOn(e.getModifierState('CapsLock'));
  };
  // Track the post-activation redirect timer so a fast unmount (user
  // clicks a nav link while the success screen is showing) doesn't
  // later shove them to the dashboard against their choice.
  const redirectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    return () => {
      if (redirectTimerRef.current) clearTimeout(redirectTimerRef.current);
    };
  }, []);

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
      //
      // Strip invisible chars before comparing — an admin could have
      // pasted the invitee's email from Slack/Notion with a sneaky
      // ZWSP attached; it lived in the invites row but user.email from
      // Supabase is clean, so the strict compare falsely rejected the
      // legitimate invitee.
      const sessEmail = normalizeInvisible(user.email ?? '').trim().toLowerCase();
      const inviteEmail = normalizeInvisible(invite.email).trim().toLowerCase();
      if (sessEmail !== inviteEmail) {
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
      if (redirectTimerRef.current) clearTimeout(redirectTimerRef.current);
      redirectTimerRef.current = setTimeout(() => {
        navigate(invite.role === 'admin' ? '/admin' : '/vendor', { replace: true });
      }, 1800);
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
            onError={e => { (e.currentTarget as HTMLImageElement).style.visibility = 'hidden'; }}
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
            <h2 className="text-lg font-extrabold mb-2">Lien invalide ou expiré</h2>
            <p className="text-sm text-zinc-600 mb-5">{error}</p>
            {/* Expired / invalid token: offer a direct path to request a
                new reset link instead of dead-ending at the login page. */}
            <Link
              to="/admin/forgot-password"
              className="inline-block w-full py-3 bg-gradient-to-br from-[#0052CC] to-[#1B3A6B] text-white rounded-xl text-sm font-extrabold hover:shadow-xl transition-all focus:outline-none focus-visible:ring-4 focus-visible:ring-[#E8A838]/60 focus-visible:ring-offset-2"
            >
              Demander un nouveau lien
            </Link>
            <Link
              to="/admin/login"
              className="mt-3 inline-block text-xs font-bold text-[#0052CC] hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0052CC] focus-visible:ring-offset-1 rounded"
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
            <p className="text-sm text-zinc-600 mb-5">Tu peux entrer maintenant ou attendre la redirection automatique.</p>
            {/* Explicit Continue button — the 1.8s auto-redirect was
                jarring for users who hadn't finished reading the success
                state. The button gives keyboard / screen-reader users a
                clear next action and short-circuits the timer for those
                who want to move faster. */}
            <button
              type="button"
              onClick={() => {
                if (redirectTimerRef.current) clearTimeout(redirectTimerRef.current);
                navigate(invite?.role === 'admin' ? '/admin' : '/vendor', { replace: true });
              }}
              className="w-full py-3 bg-gradient-to-br from-[#0052CC] to-[#1B3A6B] text-white rounded-xl text-sm font-extrabold hover:shadow-xl transition-all focus:outline-none focus-visible:ring-4 focus-visible:ring-[#E8A838]/60 focus-visible:ring-offset-2"
            >
              {invite?.role === 'admin' ? 'Aller au tableau de bord admin' : 'Aller à mon espace vendeur'}
            </button>
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
                  type={showPwd ? 'text' : 'password'}
                  value={password}
                  onChange={e => {
                    setPassword(e.target.value);
                    // Clear stale submit error as the user retypes so a
                    // lingering "mots de passe ne correspondent pas" or
                    // "trop court" warning doesn't keep shouting after
                    // they've started fixing the problem.
                    if (error) setError(null);
                  }}
                  onKeyDown={handleCapsCheck}
                  onKeyUp={handleCapsCheck}
                  onFocus={() => setPwdFocus('password')}
                  onBlur={() => setPwdFocus(prev => (prev === 'password' ? null : prev))}
                  required
                  minLength={8}
                  disabled={submitting}
                  autoComplete="new-password"
                  className="w-full pl-10 pr-11 py-3 border border-zinc-200 rounded-xl text-sm outline-none focus:border-[#0052CC] disabled:bg-zinc-50 disabled:cursor-wait"
                />
                <button
                  type="button"
                  onClick={() => setShowPwd(s => !s)}
                  aria-label={showPwd ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
                  aria-pressed={showPwd}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-[#0052CC] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0052CC] rounded p-1"
                >
                  {showPwd ? <EyeOff size={16} aria-hidden="true" /> : <Eye size={16} aria-hidden="true" />}
                </button>
              </div>
              {pwdFocus === 'password' && capsOn && (
                <p className="mt-1 text-[11px] font-semibold text-amber-600 flex items-center gap-1" role="status">
                  <span aria-hidden="true">⇪</span> Caps Lock est activé
                </p>
              )}
              {password.length > 0 && (() => {
                const score = scorePassword(password);
                // 3-segment bar: rose (weak) → amber (ok) → emerald (strong).
                const tones = ['bg-rose-400', 'bg-amber-400', 'bg-emerald-500'];
                const label = score <= 1 ? 'Faible' : score === 2 ? 'Moyen' : 'Solide';
                return (
                  <div className="mt-2" aria-live="polite">
                    <div className="flex gap-1" aria-hidden="true">
                      {[0, 1, 2].map(i => (
                        <span
                          key={i}
                          className={`h-1 flex-1 rounded-full transition-colors ${
                            i < score ? tones[Math.min(score - 1, 2)] : 'bg-zinc-200'
                          }`}
                        />
                      ))}
                    </div>
                    <p className="mt-1 text-[10px] font-bold uppercase tracking-wider text-zinc-500">
                      Force : {label}
                    </p>
                  </div>
                );
              })()}
            </label>

            <label className="block">
              <span className="text-[11px] font-bold text-zinc-500 uppercase tracking-wider">Confirmer</span>
              <div className="mt-1.5 relative">
                <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" aria-hidden="true" />
                {(() => {
                  const mismatch = password.length > 0 && confirm.length > 0 && password !== confirm;
                  return (
                    <input
                      type={showConfirm ? 'text' : 'password'}
                      value={confirm}
                      onChange={e => {
                        setConfirm(e.target.value);
                        if (error) setError(null);
                      }}
                      onKeyDown={handleCapsCheck}
                      onKeyUp={handleCapsCheck}
                      onFocus={() => setPwdFocus('confirm')}
                      onBlur={() => setPwdFocus(prev => (prev === 'confirm' ? null : prev))}
                      required
                      minLength={8}
                      disabled={submitting}
                      autoComplete="new-password"
                      aria-invalid={mismatch || undefined}
                      className={`w-full pl-10 pr-11 py-3 border rounded-xl text-sm outline-none disabled:bg-zinc-50 disabled:cursor-wait ${
                        mismatch ? 'border-rose-300 focus:border-rose-500' : 'border-zinc-200 focus:border-[#0052CC]'
                      }`}
                    />
                  );
                })()}
                <button
                  type="button"
                  onClick={() => setShowConfirm(s => !s)}
                  aria-label={showConfirm ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
                  aria-pressed={showConfirm}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-[#0052CC] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0052CC] rounded p-1"
                >
                  {showConfirm ? <EyeOff size={16} aria-hidden="true" /> : <Eye size={16} aria-hidden="true" />}
                </button>
              </div>
              {pwdFocus === 'confirm' && capsOn && (
                <p className="mt-1 text-[11px] font-semibold text-amber-600 flex items-center gap-1" role="status">
                  <span aria-hidden="true">⇪</span> Caps Lock est activé
                </p>
              )}
              {password.length > 0 && confirm.length > 0 && password !== confirm && (
                <p className="mt-1 text-[11px] font-semibold text-rose-600 flex items-center gap-1" role="alert">
                  <AlertCircle size={12} aria-hidden="true" /> Les mots de passe ne correspondent pas
                </p>
              )}
            </label>

            <button
              type="submit"
              disabled={submitting}
              aria-busy={submitting || undefined}
              className="w-full py-3.5 bg-gradient-to-br from-[#0052CC] to-[#1B3A6B] text-white rounded-xl text-sm font-extrabold disabled:opacity-60 disabled:cursor-wait hover:shadow-xl transition-all focus:outline-none focus-visible:ring-4 focus-visible:ring-[#E8A838]/60 focus-visible:ring-offset-2 flex items-center justify-center gap-2"
            >
              {submitting && <Loader2 size={16} className="animate-spin" aria-hidden="true" />}
              {submitting ? 'Activation…' : 'Activer mon compte'}
            </button>
          </form>
        ) : null}
      </div>
    </div>
  );
}
