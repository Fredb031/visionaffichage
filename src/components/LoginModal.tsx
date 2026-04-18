import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertCircle } from 'lucide-react';
import { useLang } from '@/lib/langContext';
import { useAuthStore } from '@/stores/authStore';
import { useBodyScrollLock } from '@/hooks/useBodyScrollLock';
import { useEscapeKey } from '@/hooks/useEscapeKey';

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

  // Clear stale auth errors whenever the modal is closed so the next
  // open doesn't flash the previous attempt's error message.
  useEffect(() => {
    if (!isOpen && error) clearError();
  }, [isOpen, error, clearError]);

  useEscapeKey(isOpen, onClose);

  useBodyScrollLock(isOpen);

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
    if (mode === 'signup') {
      if (password !== password2) return;
      const res = await signUp(email, password, name);
      if (!res.ok) return;
      onClose();
      navigate('/');
      return;
    }
    const res = await signIn(email, password);
    if (!res.ok) return;
    onClose();
    if (res.role === 'admin' || res.role === 'president') navigate('/admin');
    else if (res.role === 'vendor') navigate('/vendor');
  };

  return (
    <div
      className="fixed inset-0 z-[700] bg-foreground/60 backdrop-blur-[14px] flex items-center justify-center"
      onClick={onClose}
      aria-hidden="true"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="login-modal-title"
        className="bg-background rounded-[22px] w-[420px] max-w-[94vw] overflow-hidden shadow-[0_40px_80px_rgba(0,0,0,0.15)] animate-[staggerUp_0.35s_cubic-bezier(.34,1.4,.64,1)_forwards]"
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
              <div className="flex items-start gap-2 p-2.5 bg-rose-50 border border-rose-200 text-rose-700 rounded-lg text-xs">
                <AlertCircle size={13} className="flex-shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            {mode === 'signup' && (
              <input
                className="border border-border rounded-[10px] py-[11px] px-3.5 text-sm outline-none focus:border-primary bg-background"
                placeholder={lang === 'en' ? 'Full name' : 'Nom complet'}
                type="text"
                autoComplete="name"
                value={name}
                onChange={e => setName(e.target.value)}
                required
              />
            )}

            <input
              className="border border-border rounded-[10px] py-[11px] px-3.5 text-sm outline-none focus:border-primary bg-background"
              placeholder={lang === 'en' ? 'Email address' : 'Adresse courriel'}
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
              className="border border-border rounded-[10px] py-[11px] px-3.5 text-sm outline-none focus:border-primary bg-background"
              placeholder={lang === 'en' ? 'Password' : 'Mot de passe'}
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
                  className="border border-border rounded-[10px] py-[11px] px-3.5 text-sm outline-none focus:border-primary bg-background"
                  placeholder={lang === 'en' ? 'Confirm password' : 'Confirmer le mot de passe'}
                  type="password"
                  autoComplete="new-password"
                  value={password2}
                  onChange={e => setPassword2(e.target.value)}
                  required
                />
                {password && password2 && password !== password2 && (
                  <p className="text-[11px] text-rose-600 font-semibold">
                    {lang === 'en' ? 'Passwords do not match' : 'Les mots de passe ne correspondent pas'}
                  </p>
                )}
              </>
            )}

            <button
              type="submit"
              className="w-full py-3.5 gradient-navy-dark text-primary-foreground border-none rounded-[10px] text-sm font-extrabold cursor-pointer hover:opacity-[0.87] transition-opacity"
            >
              {mode === 'login'
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
                className="text-[12px] text-muted-foreground font-medium bg-transparent border-none cursor-pointer hover:text-foreground hover:underline mt-1"
              >
                {lang === 'en' ? 'Forgot password?' : 'Mot de passe oublié ?'}
              </button>
            )}

            <button
              type="button"
              onClick={() => {
                setMode(mode === 'login' ? 'signup' : 'login');
                if (error) clearError();
              }}
              className="text-[12px] text-primary font-semibold bg-transparent border-none cursor-pointer hover:underline mt-1"
            >
              {mode === 'login'
                ? lang === 'en' ? "Don't have an account? Sign up" : "Pas de compte? S'inscrire"
                : lang === 'en' ? 'Already have an account? Log in' : 'Déjà un compte? Se connecter'}
            </button>

            <button
              type="button"
              onClick={onClose}
              className="text-[12px] text-muted-foreground cursor-pointer underline bg-transparent border-none"
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
