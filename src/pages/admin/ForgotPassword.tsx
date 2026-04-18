import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Mail, ArrowLeft, CheckCircle2, AlertCircle } from 'lucide-react';
import { useAuthStore } from '@/stores/authStore';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const sendPasswordReset = useAuthStore(s => s.sendPasswordReset);
  const error = useAuthStore(s => s.error);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    const result = await sendPasswordReset(email);
    setSubmitting(false);
    if (result.ok) setSent(true);
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
          <h1 className="text-2xl font-extrabold text-white mb-1">Réinitialiser le mot de passe</h1>
          <p className="text-sm text-white/60">On t'envoie un lien sécurisé par courriel</p>
        </div>

        {sent ? (
          <div className="bg-white rounded-2xl p-6 md:p-8 shadow-2xl text-center">
            <div className="w-14 h-14 rounded-full bg-emerald-500 text-white flex items-center justify-center mx-auto mb-4">
              <CheckCircle2 size={28} strokeWidth={2.5} />
            </div>
            <h2 className="text-lg font-extrabold mb-2">Courriel envoyé</h2>
            <p className="text-sm text-zinc-600 mb-5 leading-relaxed">
              Si un compte existe avec <strong>{email}</strong>, tu vas recevoir un lien dans quelques secondes.
              Vérifie aussi tes spams.
            </p>
            <Link to="/admin/login" className="text-sm font-bold text-[#0052CC] hover:underline">
              ← Retour à la connexion
            </Link>
          </div>
        ) : (
          <form onSubmit={onSubmit} className="bg-white rounded-2xl p-6 md:p-8 shadow-2xl space-y-4">
            {error && (
              <div className="flex items-start gap-2 p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-lg text-xs">
                <AlertCircle size={14} className="flex-shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            <label className="block">
              <span className="text-[11px] font-bold text-zinc-500 uppercase tracking-wider">Courriel du compte</span>
              <div className="mt-1.5 relative">
                <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="toi@visionaffichage.com"
                  autoComplete="email"
                  required
                  className="w-full pl-10 pr-3 py-3 border border-zinc-200 rounded-xl text-sm outline-none focus:border-[#0052CC]"
                />
              </div>
            </label>

            <button
              type="submit"
              disabled={submitting || !email}
              className="w-full py-3.5 bg-gradient-to-br from-[#0052CC] to-[#1B3A6B] text-white rounded-xl text-sm font-extrabold disabled:opacity-60 hover:shadow-xl transition-all"
            >
              {submitting ? 'Envoi…' : 'Envoyer le lien de réinitialisation'}
            </button>

            <Link to="/admin/login" className="flex items-center justify-center gap-1.5 text-xs font-bold text-zinc-600 hover:text-[#0052CC]">
              <ArrowLeft size={12} /> Retour à la connexion
            </Link>
          </form>
        )}
      </div>
    </div>
  );
}
