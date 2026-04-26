import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Lock, CheckCircle2, AlertCircle, Eye, EyeOff } from 'lucide-react';
import { useAuthStore } from '@/stores/authStore';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { supabase } from '@/integrations/supabase/client';

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
 * ResetPassword — landing page for the `/admin/reset-password` recovery link.
 * Waits for Supabase to parse the recovery hash, lets the user choose a new
 * password, and routes them to their space once the update succeeds.
 */
export default function ResetPassword() {
  const navigate = useNavigate();
  const updatePassword = useAuthStore(s => s.updatePassword);
  const error = useAuthStore(s => s.error);
  const user = useAuthStore(s => s.user);
  // Auth-tab disambiguation — also helps the user spot this tab in
  // history if they revisit the recovery link.
  useDocumentTitle('Nouveau mot de passe — Vision Affichage');

  const [newPwd, setNewPwd] = useState('');
  const [confirmPwd, setConfirmPwd] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [tokenReady, setTokenReady] = useState(false);
  // Per-input show/hide + focused-field + capsLock tracking. Keeps the
  // "⇪ Caps Lock est activé" hint tied to whichever password field the
  // user is actively typing in, and disappears as soon as they blur.
  const [showNewPwd, setShowNewPwd] = useState(false);
  const [showConfirmPwd, setShowConfirmPwd] = useState(false);
  const [capsOn, setCapsOn] = useState(false);
  const [pwdFocus, setPwdFocus] = useState<null | 'new' | 'confirm'>(null);
  const handleCapsCheck = (e: React.KeyboardEvent<HTMLInputElement>) => {
    setCapsOn(e.getModifierState('CapsLock'));
  };
  // Don't condemn the link as invalid until we've given Supabase enough
  // time to actually process the recovery hash. Users arriving from the
  // reset email used to see "Lien invalide ou expiré" flash for the first
  // ~200 ms before the SDK finished parsing the token — many hit Back
  // and asked for a new link thinking their perfectly-fine recovery link
  // was broken. Keep `checking=true` until either the session shows up
  // OR the timeout elapses, then render the invalid-link state only if
  // still no session.
  const [checking, setChecking] = useState(true);

  // Supabase parses the recovery token from the URL hash asynchronously
  // on client init. A first-mount getSession() often returns no session
  // because the SDK hasn't processed the hash yet. Subscribe to
  // onAuthStateChange so the PASSWORD_RECOVERY / SIGNED_IN event flips
  // tokenReady true the moment the SDK is ready.
  useEffect(() => {
    let alive = true;
    supabase.auth.getSession()
      .then(({ data: { session } }) => {
        if (!alive) return;
        if (session) {
          setTokenReady(true);
          setChecking(false);
        }
      })
      .catch((err) => {
        console.warn('[ResetPassword] getSession failed:', err);
      });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!alive) return;
      if (session) {
        setTokenReady(true);
        setChecking(false);
      }
    });
    // Hard upper bound — if Supabase still hasn't produced a session
    // after 2.5 s, the token really is bad (or the network dropped the
    // hash) and showing the invalid-link view is the honest answer.
    // 2.5 s is generous enough that a healthy SDK always wins the race.
    const timeout = setTimeout(() => {
      if (alive) setChecking(false);
    }, 2500);
    return () => {
      alive = false;
      clearTimeout(timeout);
      sub.subscription.unsubscribe();
    };
  }, []);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    // Clear any stale error from a previous attempt — without this, a
    // server error (e.g. "session expired") lingered visibly while the
    // next submit was in flight, then got replaced only if the new
    // attempt also failed. Wipe first so the form reflects the *current*
    // attempt's state honestly.
    useAuthStore.getState().setError(null);
    if (newPwd !== confirmPwd) {
      useAuthStore.getState().setError('Les mots de passe ne correspondent pas');
      return;
    }
    if (newPwd.length < 8) {
      useAuthStore.getState().setError('Mot de passe trop court (minimum 8 caractères)');
      return;
    }
    setSubmitting(true);
    try {
      const result = await updatePassword(newPwd);
      if (result.ok) {
        setDone(true);
        // No auto-redirect — the success view now has an explicit
        // "Continue to dashboard" button (see below). Auto-redirects
        // interrupted users reading the confirmation and were flagged
        // as an accessibility issue.
      }
    } catch (err) {
      // Without a try/finally, a thrown updatePassword (network reject)
      // left the Confirmer button disabled forever. Surface + release.
      console.error('[ResetPassword] updatePassword threw:', err);
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
          <h1 className="text-2xl font-extrabold text-white mb-1">Nouveau mot de passe</h1>
          <p className="text-sm text-white/60">Choisis un mot de passe fort (min 8 caractères)</p>
        </div>

        {done ? (
          <div className="bg-white rounded-2xl p-6 md:p-8 shadow-2xl text-center" role="status">
            <div className="w-14 h-14 rounded-full bg-emerald-500 text-white flex items-center justify-center mx-auto mb-4">
              <CheckCircle2 size={28} strokeWidth={2.5} aria-hidden="true" />
            </div>
            <h2 className="text-lg font-extrabold mb-2">Mot de passe mis à jour</h2>
            <p className="text-sm text-zinc-600 mb-5">Tu peux maintenant te connecter avec ton nouveau mot de passe.</p>
            <button
              type="button"
              onClick={() => {
                // Supabase's recovery flow leaves the session ACTIVE
                // after updatePassword, so routing to /admin/login just
                // bounced the user straight back to their dashboard
                // (or nowhere if they're role=client). Route based on
                // the live role so the button label matches what
                // actually happens.
                const dest = user?.role === 'president' || user?.role === 'admin'
                  ? '/admin'
                  : user?.role === 'vendor' ? '/vendor' : '/';
                navigate(dest, { replace: true });
              }}
              className="w-full py-3 bg-gradient-to-br from-[#0052CC] to-[#1B3A6B] text-white rounded-xl text-sm font-extrabold hover:shadow-xl transition-all focus:outline-none focus-visible:ring-4 focus-visible:ring-[#E8A838]/60 focus-visible:ring-offset-2"
            >
              {user?.role === 'president' || user?.role === 'admin'
                ? 'Continuer vers le tableau de bord'
                : user?.role === 'vendor' ? 'Continuer vers mon espace' : 'Retour au site'}
            </button>
          </div>
        ) : checking && !tokenReady ? (
          <div
            className="bg-white rounded-2xl p-6 md:p-8 shadow-2xl text-center"
            role="status"
            aria-live="polite"
            aria-busy="true"
          >
            <div
              className="w-10 h-10 border-[3px] border-[#0052CC] border-t-transparent rounded-full animate-spin mx-auto mb-3"
              aria-hidden="true"
            />
            <h2 className="text-sm font-extrabold text-zinc-700 mb-1">Validation du lien…</h2>
            <p className="text-xs text-zinc-500">On vérifie ton lien de réinitialisation.</p>
          </div>
        ) : !tokenReady ? (
          <div className="bg-white rounded-2xl p-6 md:p-8 shadow-2xl text-center" role="alert">
            <AlertCircle size={28} className="text-amber-500 mx-auto mb-3" aria-hidden="true" />
            <h2 className="text-lg font-extrabold mb-2">Lien invalide ou expiré</h2>
            <p className="text-sm text-zinc-600 mb-4">
              Ce lien de réinitialisation n'est plus valide. Demande-en un nouveau.
            </p>
            <Link
              to="/admin/forgot-password"
              className="text-sm font-bold text-[#0052CC] hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0052CC] focus-visible:ring-offset-1 rounded"
            >
              Recommencer
            </Link>
          </div>
        ) : (
          <form onSubmit={onSubmit} className="bg-white rounded-2xl p-6 md:p-8 shadow-2xl space-y-4">
            {error && (
              <div role="alert" className="flex items-start gap-2 p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-lg text-xs">
                <AlertCircle size={14} className="flex-shrink-0 mt-0.5" aria-hidden="true" />
                <span>{error}</span>
              </div>
            )}

            <label className="block">
              <span className="text-[11px] font-bold text-zinc-500 uppercase tracking-wider">Nouveau mot de passe</span>
              <div className="mt-1.5 relative">
                <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" aria-hidden="true" />
                <input
                  type={showNewPwd ? 'text' : 'password'}
                  value={newPwd}
                  onChange={e => setNewPwd(e.target.value)}
                  onKeyDown={handleCapsCheck}
                  onKeyUp={handleCapsCheck}
                  onFocus={() => setPwdFocus('new')}
                  onBlur={() => setPwdFocus(prev => (prev === 'new' ? null : prev))}
                  required
                  minLength={8}
                  autoComplete="new-password"
                  className="w-full pl-10 pr-11 py-3 border border-zinc-200 rounded-xl text-sm outline-none focus:border-[#0052CC]"
                />
                <button
                  type="button"
                  onClick={() => setShowNewPwd(s => !s)}
                  aria-label={showNewPwd ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
                  aria-pressed={showNewPwd}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-[#0052CC] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0052CC] rounded p-1"
                >
                  {showNewPwd ? <EyeOff size={16} aria-hidden="true" /> : <Eye size={16} aria-hidden="true" />}
                </button>
              </div>
              {pwdFocus === 'new' && capsOn && (
                <p className="mt-1 text-[11px] font-semibold text-amber-600 flex items-center gap-1" role="status">
                  <span aria-hidden="true">⇪</span> Caps Lock est activé
                </p>
              )}
              {newPwd.length > 0 && (() => {
                const score = scorePassword(newPwd);
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
                  const mismatch = newPwd.length > 0 && confirmPwd.length > 0 && newPwd !== confirmPwd;
                  return (
                    <input
                      type={showConfirmPwd ? 'text' : 'password'}
                      value={confirmPwd}
                      onChange={e => setConfirmPwd(e.target.value)}
                      onKeyDown={handleCapsCheck}
                      onKeyUp={handleCapsCheck}
                      onFocus={() => setPwdFocus('confirm')}
                      onBlur={() => setPwdFocus(prev => (prev === 'confirm' ? null : prev))}
                      required
                      minLength={8}
                      autoComplete="new-password"
                      aria-invalid={mismatch || undefined}
                      className={`w-full pl-10 pr-11 py-3 border rounded-xl text-sm outline-none ${
                        mismatch ? 'border-rose-300 focus:border-rose-500' : 'border-zinc-200 focus:border-[#0052CC]'
                      }`}
                    />
                  );
                })()}
                <button
                  type="button"
                  onClick={() => setShowConfirmPwd(s => !s)}
                  aria-label={showConfirmPwd ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
                  aria-pressed={showConfirmPwd}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-[#0052CC] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0052CC] rounded p-1"
                >
                  {showConfirmPwd ? <EyeOff size={16} aria-hidden="true" /> : <Eye size={16} aria-hidden="true" />}
                </button>
              </div>
              {pwdFocus === 'confirm' && capsOn && (
                <p className="mt-1 text-[11px] font-semibold text-amber-600 flex items-center gap-1" role="status">
                  <span aria-hidden="true">⇪</span> Caps Lock est activé
                </p>
              )}
              {newPwd.length > 0 && confirmPwd.length > 0 && newPwd !== confirmPwd && (
                <p className="mt-1 text-[11px] font-semibold text-rose-600 flex items-center gap-1" role="status">
                  <AlertCircle size={12} aria-hidden="true" /> Les mots de passe ne correspondent pas
                </p>
              )}
            </label>

            <button
              type="submit"
              disabled={submitting}
              className="w-full py-3.5 bg-gradient-to-br from-[#0052CC] to-[#1B3A6B] text-white rounded-xl text-sm font-extrabold disabled:opacity-60 hover:shadow-xl transition-all focus:outline-none focus-visible:ring-4 focus-visible:ring-[#E8A838]/60 focus-visible:ring-offset-2"
            >
              {submitting ? 'Mise à jour…' : 'Confirmer'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
