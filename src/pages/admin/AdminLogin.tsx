import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Mail, Lock, ArrowRight, AlertCircle, Eye, EyeOff } from 'lucide-react';
import { useAuthStore, getSignInLockoutRemaining } from '@/stores/authStore';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { isValidEmail } from '@/lib/utils';

export default function AdminLogin() {
  const navigate = useNavigate();
  const location = useLocation();
  const signIn = useAuthStore(s => s.signIn);
  const error = useAuthStore(s => s.error);
  const clearError = useAuthStore(s => s.clearError);
  const user = useAuthStore(s => s.user);
  const loading = useAuthStore(s => s.loading);

  // Distinguish auth tabs from the rest of the site in the browser tab
  // strip — without a specific title, an admin with login + dashboard
  // tabs open had to click each one to find the login form.
  useDocumentTitle('Connexion — Vision Affichage');

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  // CapsLock inline hint: only shows while the password input is
  // focused AND caps lock is currently on. Catches the "why is my
  // password wrong" failure mode before the user even submits.
  const [capsOn, setCapsOn] = useState(false);
  const [pwdFocused, setPwdFocused] = useState(false);
  const handleCapsCheck = (e: React.KeyboardEvent<HTMLInputElement>) => {
    setCapsOn(e.getModifierState('CapsLock'));
  };

  const redirectTo = (location.state as { from?: string } | null)?.from;

  // If already logged in, send them to their natural home — no point
  // showing the login form to a signed-in user.
  useEffect(() => {
    if (loading || !user) return;
    if (user.role === 'president' || user.role === 'admin') navigate('/admin', { replace: true });
    else if (user.role === 'vendor') navigate('/vendor', { replace: true });
    else navigate('/', { replace: true });
  }, [user, loading, navigate]);

  const [submitting, setSubmitting] = useState(false);

  // Live countdown for the client-side rate-limit lockout (Task 14.5).
  // Recomputed every second while > 0 so the user sees it tick down,
  // then cleared so the banner disappears and the form re-enables.
  const [lockSeconds, setLockSeconds] = useState(0);
  useEffect(() => {
    const tick = () => {
      const remaining = email.trim() ? getSignInLockoutRemaining(email) : 0;
      setLockSeconds(remaining);
    };
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [email]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    // Pre-validate so the user gets our friendly 'Courriel invalide'
    // instead of Supabase's generic invalid-credentials reply when
    // they typo a@b.
    if (!isValidEmail(email)) {
      useAuthStore.getState().setError('Courriel invalide');
      return;
    }
    setSubmitting(true);
    let result: Awaited<ReturnType<typeof signIn>>;
    try {
      result = await signIn(email, password);
    } catch (err) {
      // signIn normally returns {ok:false} with a friendly error on the
      // store, but a thrown exception (network down, fetch reject) used
      // to slip past the bare await and leave the button disabled
      // forever. Always release submitting, and surface the error so
      // the admin sees *something* — previously only console.error fired
      // and the form looked inert on bad wifi.
      console.error('[AdminLogin] signIn threw:', err);
      useAuthStore.getState().setError('Erreur réseau. Vérifie ta connexion et réessaie.');
      return;
    } finally {
      setSubmitting(false);
    }
    if (!result.ok) return;
    // Clear any stale error so a back-nav to /admin/login doesn't flash
    // the previous attempt's message.
    clearError();
    const role = result.role;
    // Return the user to wherever they were trying to go (state.from
    // set by AuthGuard) when they have permission to be there.
    // Before this, role='client' always fell through to '/' even when
    // the redirectTo was /account — a route that clients can access —
    // silently dropping the back-redirect.
    const canReach = (target: string): boolean => {
      if (role === 'president') return true;
      if (target.startsWith('/admin')) return role === 'admin';
      if (target.startsWith('/vendor')) return role === 'vendor' || role === 'admin';
      // Non-gated paths (e.g. /account, /cart, /checkout) are open to
      // any signed-in user.
      return true;
    };
    if (redirectTo && canReach(redirectTo)) {
      navigate(redirectTo, { replace: true });
      return;
    }
    if (role === 'admin' || role === 'president') navigate('/admin', { replace: true });
    else if (role === 'vendor') navigate('/vendor', { replace: true });
    else navigate('/', { replace: true });
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
          <h1 className="text-2xl font-extrabold text-white mb-1">Espace administration</h1>
          <p className="text-sm text-white/60">Connecte-toi pour gérer ton entreprise</p>
        </div>

        {lockSeconds > 0 && (
          <div
            role="alert"
            aria-live="polite"
            className="mb-4 flex items-start gap-2 p-3 bg-amber-50 border border-amber-300 text-amber-800 rounded-xl text-xs shadow-lg"
          >
            <AlertCircle size={14} className="flex-shrink-0 mt-0.5" aria-hidden="true" />
            <div className="flex-1">
              <div className="font-bold">Trop de tentatives</div>
              <div className="opacity-90">
                Réessaie dans <span className="font-bold tabular-nums">{lockSeconds}</span> seconde{lockSeconds > 1 ? 's' : ''}.
              </div>
            </div>
          </div>
        )}

        <form onSubmit={onSubmit} className="bg-white rounded-2xl p-6 md:p-8 shadow-2xl space-y-4">
          {error && (
            <div role="alert" className="flex items-start gap-2 p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-lg text-xs">
              <AlertCircle size={14} className="flex-shrink-0 mt-0.5" aria-hidden="true" />
              <div className="flex-1 space-y-1">
                <div>{error}</div>
                {/* Add an actionable suggestion when the failure was a
                    bad credential — first-time admins often hit this
                    because they haven't created their account yet, and
                    the bare 'invalid email or password' didn't tell
                    them where to go next. */}
                {error.toLowerCase().includes('invalide') || error.toLowerCase().includes('invalid') ? (
                  <div className="text-[11px] opacity-80">
                    Pas encore de compte ?{' '}
                    <Link
                      to="/admin/signup"
                      className="font-bold underline hover:no-underline focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 focus-visible:ring-offset-1 rounded"
                    >
                      Crée-le ici
                    </Link>
                    {' · '}
                    <Link
                      to="/admin/forgot-password"
                      className="font-bold underline hover:no-underline focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 focus-visible:ring-offset-1 rounded"
                    >
                      Mot de passe oublié
                    </Link>
                  </div>
                ) : null}
              </div>
            </div>
          )}

          <label className="block">
            <span className="text-[11px] font-bold text-zinc-500 uppercase tracking-wider">Courriel</span>
            <div className="mt-1.5 relative">
              <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" aria-hidden="true" />
              {(() => {
                const invalid = email.trim().length > 0 && !isValidEmail(email);
                return (
                  <input
                    type="email"
                    value={email}
                    onChange={e => {
                      setEmail(e.target.value);
                      if (error) clearError();
                    }}
                    placeholder="admin@visionaffichage.com"
                    autoComplete="email"
                    required
                    aria-invalid={invalid || undefined}
                    className={`w-full pl-10 pr-3 py-3 border rounded-xl text-sm outline-none focus:ring-2 ${
                      invalid
                        ? 'border-rose-300 focus:border-rose-500 focus:ring-rose-400/20'
                        : 'border-zinc-200 focus:border-[#0052CC] focus:ring-[#0052CC]/10'
                    }`}
                  />
                );
              })()}
            </div>
          </label>

          <label className="block">
            <span className="text-[11px] font-bold text-zinc-500 uppercase tracking-wider">Mot de passe</span>
            <div className="mt-1.5 relative">
              <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" aria-hidden="true" />
              <input
                type={showPwd ? 'text' : 'password'}
                value={password}
                onChange={e => {
                  setPassword(e.target.value);
                  if (error) clearError();
                }}
                onKeyDown={handleCapsCheck}
                onKeyUp={handleCapsCheck}
                onFocus={() => setPwdFocused(true)}
                onBlur={() => setPwdFocused(false)}
                placeholder="••••••••"
                autoComplete="current-password"
                required
                className="w-full pl-10 pr-11 py-3 border border-zinc-200 rounded-xl text-sm outline-none focus:border-[#0052CC] focus:ring-2 focus:ring-[#0052CC]/10"
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
            {pwdFocused && capsOn && (
              <p className="mt-1 text-[11px] font-semibold text-amber-600 flex items-center gap-1" role="status">
                <span aria-hidden="true">⇪</span> Caps Lock est activé
              </p>
            )}
          </label>

          <div className="flex items-center justify-end pt-1">
            {/* The "Stay connected" checkbox used to live here but did
                nothing — Supabase persists sessions via localStorage by
                default. Removed to avoid misleading the user. */}
            <Link
              to="/admin/forgot-password"
              className="text-xs font-bold text-[#0052CC] hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0052CC] focus-visible:ring-offset-1 rounded"
            >
              Mot de passe oublié ?
            </Link>
          </div>

          <button
            type="submit"
            disabled={submitting || lockSeconds > 0}
            className="w-full py-3.5 bg-gradient-to-br from-[#0052CC] to-[#1B3A6B] text-white rounded-xl text-sm font-extrabold flex items-center justify-center gap-2 hover:shadow-xl transition-all disabled:opacity-60 focus:outline-none focus-visible:ring-4 focus-visible:ring-[#E8A838]/60 focus-visible:ring-offset-2"
          >
            {submitting ? 'Connexion…' : lockSeconds > 0 ? `Attends ${lockSeconds}s…` : 'Se connecter'}
            {!submitting && lockSeconds === 0 && <ArrowRight size={16} aria-hidden="true" />}
          </button>

          <div className="bg-zinc-50 rounded-lg p-3 text-[11px] text-zinc-600 leading-relaxed">
            <div className="font-bold text-zinc-700 mb-1">Première connexion</div>
            <div>
              <span aria-hidden="true">👑 </span>
              Si tu es <strong>Frederick</strong>, crée ton compte :{' '}
              <Link
                to="/admin/signup"
                className="text-[#0052CC] font-bold hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0052CC] focus-visible:ring-offset-1 rounded"
              >
                Créer mon compte Président
              </Link>
            </div>
            <div className="text-zinc-500 mt-1">Le compte avec courriel <code className="bg-white px-1 rounded">contact@fredbouchard.ca</code> reçoit automatiquement le rôle Président avec accès total.</div>
          </div>

          <div className="text-center pt-2 border-t border-zinc-100">
            <span className="text-xs text-zinc-500">Pas d'accès admin ? </span>
            <Link
              to="/"
              className="text-xs font-bold text-[#0052CC] hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0052CC] focus-visible:ring-offset-1 rounded"
            >
              Retour au site
            </Link>
          </div>
        </form>

        <p className="text-center text-[11px] text-white/40 mt-6">
          © {new Date().getFullYear()} Vision Affichage · Connexion sécurisée
        </p>
      </div>
    </div>
  );
}
