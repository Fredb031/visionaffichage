import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Mail, Lock, User as UserIcon, ArrowRight, AlertCircle, CheckCircle2, Eye, EyeOff } from 'lucide-react';
import { useAuthStore, isPresidentEmailCandidate } from '@/stores/authStore';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { isValidEmail } from '@/lib/utils';

export default function Signup() {
  const navigate = useNavigate();
  const signUp = useAuthStore(s => s.signUp);
  const error = useAuthStore(s => s.error);
  const clearError = useAuthStore(s => s.clearError);
  // Same auth-tab disambiguation as AdminLogin.
  useDocumentTitle('Créer un compte — Vision Affichage');

  // No hardcoded defaults — placeholder text in the inputs is enough.
  // Pre-filling Frederick's name leaked the owner's identity on a
  // shared browser.
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  // Per-input show/hide state. Independent so flipping one doesn't
  // accidentally reveal the other — the confirm field's whole job is to
  // catch typos in the primary, so they must stay decoupled.
  const [showPwd, setShowPwd] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  // CapsLock hint only renders while a password input is focused AND
  // caps lock is on. We track the focused field and the caps state
  // separately so blurring clears the hint even if caps is still on.
  const [capsOn, setCapsOn] = useState(false);
  const [pwdFocus, setPwdFocus] = useState<null | 'password' | 'confirm'>(null);
  const handleCapsCheck = (e: React.KeyboardEvent<HTMLInputElement>) => {
    setCapsOn(e.getModifierState('CapsLock'));
  };
  // Task 6.9 — hoisted so both the input (aria-invalid/describedby)
  // and the inline error note below can reference the same boolean
  // without recomputing in two places.
  const confirmMismatch = password.length > 0 && confirm.length > 0 && password !== confirm;

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    // Pre-validate with the stricter email regex — Supabase bounces
    // 'a@b'-style inputs back with an unfriendly message. Catch here
    // so the user gets our own friendly error before a round-trip.
    if (!isValidEmail(email)) {
      useAuthStore.getState().setError('Adresse courriel invalide');
      return;
    }
    if (password !== confirm) {
      useAuthStore.getState().setError('Les mots de passe ne correspondent pas');
      return;
    }
    if (password.length < 8) {
      useAuthStore.getState().setError('Mot de passe trop court (minimum 8 caractères)');
      return;
    }
    setSubmitting(true);
    try {
      const result = await signUp(email, password, name);
      if (result.ok) setDone(true);
    } catch (err) {
      // A thrown signUp (network reject) would otherwise leave the
      // Créer mon compte button disabled forever. Surface + release.
      console.error('[Signup] signUp threw:', err);
    } finally {
      setSubmitting(false);
    }
  };

  // Shared source of truth with authStore so the crown UI + the actual
  // role assignment never drift apart. Also strips invisibles so a
  // Slack paste of the owner email still lights up the crown.
  const isPresidentEmail = isPresidentEmailCandidate(email);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-brand-black via-brand-black to-brand-black px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <img
            src="https://visionaffichage.com/cdn/shop/files/Logo-vision-horizontal-blanc.png?height=135&v=1694121209"
            alt="Vision Affichage"
            className="h-9 mx-auto mb-6 opacity-90"
            onError={e => { (e.currentTarget as HTMLImageElement).style.visibility = 'hidden'; }}
          />
          <h1 className="text-2xl font-extrabold text-white mb-1 flex items-center gap-2 justify-center">
            {isPresidentEmail && <span role="img" aria-label="Président" title="Président">👑</span>}
            Créer un compte
          </h1>
          <p className="text-sm text-white/60">
            {isPresidentEmail
              ? 'Le rôle Président t\'est attribué automatiquement'
              : 'Compte client par défaut — un admin peut t\'inviter pour des accès supérieurs'}
          </p>
        </div>

        {done ? (
          <div className="bg-white rounded-2xl p-6 md:p-8 shadow-2xl text-center" role="status">
            <div className="w-14 h-14 rounded-full bg-emerald-500 text-white flex items-center justify-center mx-auto mb-4">
              <CheckCircle2 size={28} strokeWidth={2.5} aria-hidden="true" />
            </div>
            <h2 className="text-lg font-extrabold mb-2">Compte créé</h2>
            <p className="text-sm text-zinc-600 mb-2">
              Vérifie ton courriel <strong>{email}</strong> pour confirmer ton compte
              (vérifie aussi tes spams).
            </p>
            <p className="text-xs text-zinc-500 mb-5">
              Une fois confirmé, tu pourras te connecter normalement.
            </p>
            <button
              type="button"
              onClick={() => navigate('/admin/login')}
              className="text-sm font-bold text-[#0052CC] hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0052CC] focus-visible:ring-offset-1 rounded"
            >
              Aller à la connexion
            </button>
          </div>
        ) : (
          <form onSubmit={onSubmit} className="bg-white rounded-2xl p-6 md:p-8 shadow-2xl space-y-4">
            {error && (
              <div
                id="admin-signup-error"
                role="alert"
                aria-live="polite"
                className="flex items-start gap-2 p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-lg text-xs"
              >
                <AlertCircle size={14} className="flex-shrink-0 mt-0.5" aria-hidden="true" />
                <span>{error}</span>
              </div>
            )}

            <label className="block">
              <span className="text-[11px] font-bold text-zinc-500 uppercase tracking-wider">Nom complet</span>
              <div className="mt-1.5 relative">
                <UserIcon size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" aria-hidden="true" />
                <input
                  type="text"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  required
                  autoComplete="name"
                  className="w-full pl-10 pr-3 py-3 border border-zinc-200 rounded-xl text-sm outline-none focus:border-[#0052CC]"
                />
              </div>
            </label>

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
                      onChange={e => { setEmail(e.target.value); if (error) clearError(); }}
                      required
                      autoComplete="email"
                      aria-invalid={invalid || undefined}
                      className={`w-full pl-10 pr-3 py-3 border rounded-xl text-sm outline-none ${
                        invalid
                          ? 'border-rose-300 focus:border-rose-500'
                          : 'border-zinc-200 focus:border-[#0052CC]'
                      }`}
                    />
                  );
                })()}
              </div>
            </label>

            <label className="block">
              <span className="text-[11px] font-bold text-zinc-500 uppercase tracking-wider">Mot de passe (min 8)</span>
              <div className="mt-1.5 relative">
                <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" aria-hidden="true" />
                <input
                  type={showPwd ? 'text' : 'password'}
                  value={password}
                  onChange={e => { setPassword(e.target.value); if (error) clearError(); }}
                  onKeyDown={handleCapsCheck}
                  onKeyUp={handleCapsCheck}
                  onFocus={() => setPwdFocus('password')}
                  onBlur={() => setPwdFocus(prev => (prev === 'password' ? null : prev))}
                  required
                  minLength={8}
                  autoComplete="new-password"
                  className="w-full pl-10 pr-11 py-3 border border-zinc-200 rounded-xl text-sm outline-none focus:border-[#0052CC]"
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
            </label>

            <label className="block">
              <span className="text-[11px] font-bold text-zinc-500 uppercase tracking-wider">Confirmer</span>
              <div className="mt-1.5 relative">
                <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" aria-hidden="true" />
                <input
                  type={showConfirm ? 'text' : 'password'}
                  value={confirm}
                  onChange={e => setConfirm(e.target.value)}
                  onKeyDown={handleCapsCheck}
                  onKeyUp={handleCapsCheck}
                  onFocus={() => setPwdFocus('confirm')}
                  onBlur={() => setPwdFocus(prev => (prev === 'confirm' ? null : prev))}
                  required
                  minLength={8}
                  autoComplete="new-password"
                  aria-invalid={confirmMismatch || undefined}
                  // Task 6.9 — describedby points at the inline
                  // mismatch note below so the reason is read on
                  // refocus, not just when the note first appears.
                  aria-describedby={confirmMismatch ? 'admin-signup-confirm-error' : undefined}
                  className={`w-full pl-10 pr-11 py-3 border rounded-xl text-sm outline-none ${
                    confirmMismatch ? 'border-rose-300 focus:border-rose-500' : 'border-zinc-200 focus:border-[#0052CC]'
                  }`}
                />
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
              {confirmMismatch && (
                <p
                  id="admin-signup-confirm-error"
                  role="alert"
                  aria-live="polite"
                  className="mt-1 text-[11px] font-semibold text-rose-600"
                >
                  Les mots de passe ne correspondent pas.
                </p>
              )}
            </label>

            <button
              type="submit"
              disabled={submitting}
              className="w-full py-3.5 bg-gradient-to-br from-brand-blue to-brand-black text-white rounded-xl text-sm font-extrabold flex items-center justify-center gap-2 disabled:opacity-60 hover:shadow-xl transition-all focus:outline-none focus-visible:ring-4 focus-visible:ring-brand-blue/60 focus-visible:ring-offset-2"
            >
              {submitting ? 'Création…' : 'Créer mon compte'}
              {!submitting && <ArrowRight size={16} aria-hidden="true" />}
            </button>

            <Link
              to="/admin/login"
              className="block text-center text-xs font-bold text-zinc-600 hover:text-[#0052CC] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0052CC] focus-visible:ring-offset-1 rounded"
            >
              Déjà un compte ? Se connecter
            </Link>
          </form>
        )}
      </div>
    </div>
  );
}
