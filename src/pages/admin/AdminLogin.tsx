import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Mail, Lock, ArrowRight, AlertCircle } from 'lucide-react';
import { useAuthStore } from '@/stores/authStore';

export default function AdminLogin() {
  const navigate = useNavigate();
  const location = useLocation();
  const signIn = useAuthStore(s => s.signIn);
  const error = useAuthStore(s => s.error);
  const clearError = useAuthStore(s => s.clearError);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPwd, setShowPwd] = useState(false);

  const redirectTo = (location.state as { from?: string } | null)?.from;

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const result = signIn(email, password);
    if (!result.ok) return;
    if (redirectTo && redirectTo.startsWith(result.role === 'admin' ? '/admin' : '/vendor')) {
      navigate(redirectTo, { replace: true });
      return;
    }
    if (result.role === 'admin') navigate('/admin', { replace: true });
    else if (result.role === 'vendor') navigate('/vendor', { replace: true });
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
          />
          <h1 className="text-2xl font-extrabold text-white mb-1">Espace administration</h1>
          <p className="text-sm text-white/60">Connecte-toi pour gérer ton entreprise</p>
        </div>

        <form onSubmit={onSubmit} className="bg-white rounded-2xl p-6 md:p-8 shadow-2xl space-y-4">
          {error && (
            <div className="flex items-start gap-2 p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-lg text-xs">
              <AlertCircle size={14} className="flex-shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <label className="block">
            <span className="text-[11px] font-bold text-zinc-500 uppercase tracking-wider">Courriel</span>
            <div className="mt-1.5 relative">
              <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" aria-hidden="true" />
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
                className="w-full pl-10 pr-3 py-3 border border-zinc-200 rounded-xl text-sm outline-none focus:border-[#0052CC] focus:ring-2 focus:ring-[#0052CC]/10"
              />
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
                placeholder="••••••••"
                autoComplete="current-password"
                required
                className="w-full pl-10 pr-16 py-3 border border-zinc-200 rounded-xl text-sm outline-none focus:border-[#0052CC] focus:ring-2 focus:ring-[#0052CC]/10"
              />
              <button
                type="button"
                onClick={() => setShowPwd(s => !s)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-[#0052CC] hover:underline"
              >
                {showPwd ? 'Cacher' : 'Voir'}
              </button>
            </div>
          </label>

          <div className="flex items-center justify-between pt-1">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" defaultChecked className="w-4 h-4 accent-[#0052CC]" />
              <span className="text-xs text-zinc-600">Rester connecté</span>
            </label>
            <button type="button" className="text-xs font-bold text-[#0052CC] hover:underline">
              Mot de passe oublié ?
            </button>
          </div>

          <button
            type="submit"
            className="w-full py-3.5 bg-gradient-to-br from-[#0052CC] to-[#1B3A6B] text-white rounded-xl text-sm font-extrabold flex items-center justify-center gap-2 hover:shadow-xl transition-all"
          >
            Se connecter
            <ArrowRight size={16} />
          </button>

          <div className="bg-zinc-50 rounded-lg p-3 text-[11px] text-zinc-600 leading-relaxed">
            <div className="font-bold text-zinc-700 mb-1">Comptes</div>
            <div>👑 Président : <code className="bg-white px-1 rounded">contact@fredbouchard.ca</code> / <code className="bg-white px-1 rounded">president</code></div>
            <div>Admin : <code className="bg-white px-1 rounded">admin@visionaffichage.com</code> / <code className="bg-white px-1 rounded">admin123</code></div>
            <div>Vendeur : <code className="bg-white px-1 rounded">sophie@visionaffichage.com</code> / <code className="bg-white px-1 rounded">vendeur123</code></div>
          </div>

          <div className="text-center pt-2 border-t border-zinc-100">
            <span className="text-xs text-zinc-500">Pas d'accès admin ? </span>
            <Link to="/" className="text-xs font-bold text-[#0052CC] hover:underline">
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
