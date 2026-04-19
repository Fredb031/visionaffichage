import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { useLang } from '@/lib/langContext';
import { useAuthStore } from '@/stores/authStore';
import { useBodyScrollLock } from '@/hooks/useBodyScrollLock';
import { useEscapeKey } from '@/hooks/useEscapeKey';
import { useFocusTrap } from '@/hooks/useFocusTrap';
import { isValidEmail } from '@/lib/utils';

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type Mode = 'login' | 'signup';

export function LoginModal({ isOpen, onClose }: LoginModalProps) {
  const { lang } = useLang();
  const navigate = useNavigate();
  const signIn = useAuthStore(s => s.signIn);
  const signUp = useAuthStore(s => s.signUp);
  const error = useAuthStore(s => s.error);
  const clearError = useAuthStore(s => s.clearError);

  const [accountType, setAccountType] = useState<'client' | 'admin' | null>(null);
  const [mode, setMode] = useState<Mode>('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [password2, setPassword2] = useState('');
  // Local in-flight state so a double-click on the submit button doesn't
  // fire two parallel Supabase auth calls. authStore.loading is global
  // (hydration), not per-submit, so we need a local flag here.
  const [submitting, setSubmitting] = useState(false);

  // Clear stale auth errors whenever the modal is closed so the next
  // open doesn't flash the previous attempt's error message.
  useEffect(() => {
    if (!isOpen && error) clearError();
  }, [isOpen, error, clearError]);

  useEscapeKey(isOpen && !submitting, onClose);

  useBodyScrollLock(isOpen);

  const trapRef = useFocusTrap<HTMLDivElement>(isOpen);

  if (!isOpen) return null;

  const title =
    mode === 'login'
      ? lang === 'en' ? 'Log in' : 'Connexion'
      : lang === 'en' ? 'Create account' : 'Créer un compte';

  const subtitle =
    mode === 'login'
      ? lang === 'en' ? 'Choose your account type' : 'Choisissez votre type de compte'
      : lang === 'en' ? 'Sign up in 30 seconds' : "Inscris-toi en 30 secondes";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    // Pre-validate so the user gets our friendly message instead of
    // Supabase's generic 'invalid credentials' when they typo a@b.
    if (!isValidEmail(email)) {
      useAuthStore.getState().setError(
        lang === 'en' ? 'Please enter a valid email address' : 'Courriel invalide',
      );
      return;
    }
    setSubmitting(true);
    try {
      if (mode === 'signup') {
        if (password !== password2) return;
        const res = await signUp(email, password, name);
        if (!res.ok) return;
        // Supabase signup with email confirmation returns ok=true but
        // the session is NOT live until the user clicks the email link.
        // The old code silently closed the modal and navigated home,
        // which read like 'you're signed in' when they weren't. Surface
        // a toast so the user knows to go check their inbox.
        toast.success(
          lang === 'en'
            ? 'Account created! Check your email to confirm.'
            : 'Compte créé ! Vérifie ton courriel pour confirmer.',
          { duration: 5000 },
        );
        onClose();
        navigate('/');
        return;
      }
      const res = await signIn(email, password);
      if (!res.ok) return;
      onClose();
      if (res.role === 'admin' || res.role === 'president') navigate('/admin');
      else if (res.role === 'vendor') navigate('/vendor');
    } catch (err) {
      // signIn/signUp normally trap their own errors and return
      // {ok:false} with a friendly message on the store. But a thrown
      // exception — fetchProfile rejecting on network, onAuthStateChange
      // subscriber throwing, syncOwnerProfile blowing up — would
      // otherwise bubble into the unhandled-rejection path and React
      // would render an error boundary instead of staying in the
      // modal. Catch + surface via the store's error state so the
      // existing red-alert label picks it up.
      console.error('[LoginModal] auth call threw:', err);
      useAuthStore.getState().setError(
        lang === 'en'
          ? 'Something went wrong. Check your connection and try again.'
          : 'Une erreur est survenue. Vérifie ta connexion et réessaie.',
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[700] bg-foreground/60 backdrop-blur-[14px] flex items-center justify-center"
      // Don't close the modal while a sign-in is in flight — the async
      // chain keeps running post-unmount and the success path calls
      // navigate() on whatever route the user ended up on, which reads
      // as "I clicked outside to dismiss, now it teleported me to
      // /admin." Block the backdrop close while submitting.
      onClick={() => { if (!submitting) onClose(); }}
      aria-hidden="true"
    >
      <div
        ref={trapRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="login-modal-title"
        tabIndex={-1}
        className="bg-background rounded-[22px] w-[420px] max-w-[94vw] overflow-hidden shadow-[0_40px_80px_rgba(0,0,0,0.15)] animate-[staggerUp_0.35s_cubic-bezier(.34,1.4,.64,1)_forwards] focus:outline-none"
        onClick={e => e.stopPropagation()}
      >
        <div className="pt-7 px-7 text-center">
          <img
            src="https://visionaffichage.com/cdn/shop/files/Asset_1_d5d82510-0b83-4657-91b7-3ac1992ee697.svg?height=90&v=1769614651"
            alt=""
            aria-hidden="true"
            width={88}
            height={22}
            decoding="async"
            className="h-[22px] w-auto mx-auto mb-[18px] opacity-70"
            onError={e => { (e.currentTarget as HTMLImageElement).style.visibility = 'hidden'; }}
          />
          <h2 id="login-modal-title" className="text-xl font-extrabold text-foreground mb-[5px]">{title}</h2>
          <p className="text-[13px] text-muted-foreground mb-5">{subtitle}</p>
        </div>

        <div className="grid grid-cols-2 gap-2.5 px-6 pb-5">
          {[
            { id: 'client' as const, name: 'Client', desc: lang === 'en' ? 'Order tracking' : 'Suivi de commandes' },
            { id: 'admin'  as const, name: 'Équipe', desc: lang === 'en' ? 'Admin & vendors' : 'Admin & vendeurs' },
          ].map(t => (
            <button
              key={t.id}
              type="button"
              onClick={() => setAccountType(t.id)}
              className={`border-[1.5px] rounded-[14px] p-[18px] text-center cursor-pointer transition-all bg-transparent ${
                accountType === t.id
                  ? 'border-primary bg-primary/[0.06]'
                  : 'border-border hover:border-primary/50 hover:bg-primary/[0.03]'
              }`}
              aria-pressed={accountType === t.id}
            >
              <div className="text-[13px] font-bold text-foreground">{t.name}</div>
              <div className="text-[11px] text-muted-foreground mt-0.5">{t.desc}</div>
            </button>
          ))}
        </div>

        {accountType ? (
          <form onSubmit={handleSubmit} className="px-6 pb-6 flex flex-col gap-2.5">
            {error && (
              <div role="alert" className="flex items-start gap-2 p-2.5 bg-rose-50 border border-rose-200 text-rose-700 rounded-lg text-xs">
                <AlertCircle size={13} className="flex-shrink-0 mt-0.5" aria-hidden="true" />
                <span>{error}</span>
              </div>
            )}

            {mode === 'signup' && (
              <input
                className="border border-border rounded-[10px] py-[11px] px-3.5 text-sm outline-none focus:border-primary focus-visible:ring-2 focus-visible:ring-primary/25 bg-background"
                placeholder={lang === 'en' ? 'Full name' : 'Nom complet'}
                aria-label={lang === 'en' ? 'Full name' : 'Nom complet'}
                type="text"
                autoComplete="name"
                value={name}
                onChange={e => setName(e.target.value)}
                required
              />
            )}

            <input
              className="border border-border rounded-[10px] py-[11px] px-3.5 text-sm outline-none focus:border-primary focus-visible:ring-2 focus-visible:ring-primary/25 bg-background"
              placeholder={lang === 'en' ? 'Email address' : 'Adresse courriel'}
              aria-label={lang === 'en' ? 'Email address' : 'Adresse courriel'}
              type="email"
              autoComplete="email"
              value={email}
              onChange={e => {
                setEmail(e.target.value);
                if (error) clearError();
              }}
              required
            />

            <input
              className="border border-border rounded-[10px] py-[11px] px-3.5 text-sm outline-none focus:border-primary focus-visible:ring-2 focus-visible:ring-primary/25 bg-background"
              placeholder={lang === 'en' ? 'Password' : 'Mot de passe'}
              aria-label={lang === 'en' ? 'Password' : 'Mot de passe'}
              type="password"
              autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
              value={password}
              onChange={e => {
                setPassword(e.target.value);
                if (error) clearError();
              }}
              required
            />

            {mode === 'signup' && (
              <>
                <input
                  className="border border-border rounded-[10px] py-[11px] px-3.5 text-sm outline-none focus:border-primary focus-visible:ring-2 focus-visible:ring-primary/25 bg-background"
                  placeholder={lang === 'en' ? 'Confirm password' : 'Confirmer le mot de passe'}
                  aria-label={lang === 'en' ? 'Confirm password' : 'Confirmer le mot de passe'}
                  type="password"
                  autoComplete="new-password"
                  value={password2}
                  onChange={e => setPassword2(e.target.value)}
                  required
                />
                {password && password2 && password !== password2 && (
                  <p role="alert" className="text-[11px] text-rose-600 font-semibold">
                    {lang === 'en' ? 'Passwords do not match' : 'Les mots de passe ne correspondent pas'}
                  </p>
                )}
              </>
            )}

            <button
              type="submit"
              disabled={submitting || (mode === 'signup' && password.length > 0 && password !== password2)}
              className="w-full py-3.5 gradient-navy-dark text-primary-foreground border-none rounded-[10px] text-sm font-extrabold cursor-pointer hover:opacity-[0.87] transition-opacity disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus-visible:ring-4 focus-visible:ring-[#E8A838]/60 focus-visible:ring-offset-2"
            >
              {submitting
                ? lang === 'en' ? 'Please wait…' : 'Un instant…'
                : mode === 'login'
                  ? lang === 'en' ? 'Log in' : 'Se connecter'
                  : lang === 'en' ? 'Create my account' : 'Créer mon compte'}
            </button>

            {/* Forgot-password link — only in LOGIN mode. Closes the
                modal and routes to the dedicated reset page, which
                sends a magic link via Supabase.auth.resetPasswordForEmail. */}
            {mode === 'login' && (
              <button
                type="button"
                onClick={() => {
                  if (error) clearError();
                  onClose();
                  navigate('/admin/forgot-password');
                }}
                className="text-[12px] text-muted-foreground font-medium bg-transparent border-none cursor-pointer hover:text-foreground hover:underline mt-1 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 rounded"
              >
                {lang === 'en' ? 'Forgot password?' : 'Mot de passe oublié ?'}
              </button>
            )}

            <button
              type="button"
              onClick={() => {
                setMode(mode === 'login' ? 'signup' : 'login');
                if (error) clearError();
                // Wipe password fields on mode switch so switching from
                // login → signup doesn't carry the "please wait while we
                // check if you exist" password into signup (and disable
                // the signup button because password2 is empty).
                setPassword('');
                setPassword2('');
              }}
              className="text-[12px] text-primary font-semibold bg-transparent border-none cursor-pointer hover:underline mt-1 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 rounded"
            >
              {mode === 'login'
                ? lang === 'en' ? "Don't have an account? Sign up" : "Pas de compte? S'inscrire"
                : lang === 'en' ? 'Already have an account? Log in' : 'Déjà un compte? Se connecter'}
            </button>

            <button
              type="button"
              onClick={onClose}
              className="text-[12px] text-muted-foreground cursor-pointer underline bg-transparent border-none focus:outline-none focus-visible:ring-2 focus-visible:ring-muted-foreground focus-visible:ring-offset-1 rounded"
            >
              {lang === 'en' ? 'Cancel' : 'Annuler'}
            </button>
          </form>
        ) : (
          <div className="px-6 pb-5 text-center">
            <span className="text-[12px] text-muted-foreground">
              {lang === 'en'
                ? 'Select an account type to continue'
                : 'Sélectionne un type de compte pour continuer'}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
