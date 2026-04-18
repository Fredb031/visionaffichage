import { useState } from 'react';
import { useLang } from '@/lib/langContext';

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function LoginModal({ isOpen, onClose }: LoginModalProps) {
  const { lang } = useLang();
  const [accountType, setAccountType] = useState<'client' | 'admin' | null>(null);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[700] bg-foreground/60 backdrop-blur-[14px] flex items-center justify-center" onClick={onClose}>
      <div
        className="bg-background rounded-[22px] w-[400px] max-w-[94vw] overflow-hidden shadow-[0_40px_80px_rgba(0,0,0,0.15)] animate-[staggerUp_0.35s_cubic-bezier(.34,1.4,.64,1)_forwards]"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="pt-7 px-7 text-center">
          <img
            src="https://visionaffichage.com/cdn/shop/files/Asset_1_d5d82510-0b83-4657-91b7-3ac1992ee697.svg?height=90&v=1769614651"
            alt="Vision"
            className="h-[22px] mx-auto mb-[18px] opacity-70"
          />
          <h2 className="text-xl font-extrabold text-foreground mb-[5px]">
            {lang === 'en' ? 'Log in' : 'Connexion'}
          </h2>
          <p className="text-[13px] text-muted-foreground mb-5">
            {lang === 'en' ? 'Choose your account type' : 'Choisissez votre type de compte'}
          </p>
        </div>

        {/* Account types */}
        <div className="grid grid-cols-2 gap-2.5 px-6 pb-5">
          {[
            { id: 'client' as const, icon: (
              <svg className="w-[18px] h-[18px] stroke-primary fill-none" strokeWidth="1.5" strokeLinecap="round" viewBox="0 0 24 24"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2M12 11a4 4 0 100-8 4 4 0 000 8z"/></svg>
            ), name: 'Client', desc: lang === 'en' ? 'Order tracking' : 'Suivi de commandes' },
            { id: 'admin' as const, icon: (
              <svg className="w-[18px] h-[18px] stroke-primary fill-none" strokeWidth="1.5" strokeLinecap="round" viewBox="0 0 24 24"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
            ), name: 'Admin', desc: lang === 'en' ? 'Management & orders' : 'Gestion & commandes' },
          ].map(t => (
            <div
              key={t.id}
              onClick={() => setAccountType(t.id)}
              className={`border-[1.5px] rounded-[14px] p-[18px] text-center cursor-pointer transition-all ${
                accountType === t.id ? 'border-primary bg-primary/[0.06]' : 'border-border hover:border-primary/50 hover:bg-primary/[0.03]'
              }`}
            >
              <div className="w-[38px] h-[38px] rounded-[10px] bg-secondary flex items-center justify-center mx-auto mb-2.5">
                {t.icon}
              </div>
              <div className="text-[13px] font-bold text-foreground">{t.name}</div>
              <div className="text-[11px] text-muted-foreground mt-0.5">{t.desc}</div>
            </div>
          ))}
        </div>

        {/* Form — shown after selecting type */}
        {accountType ? (
          <div className="px-6 pb-6 flex flex-col gap-2.5">
            <input className="border border-border rounded-[10px] py-[11px] px-3.5 text-sm outline-none focus:border-primary bg-background" placeholder={lang === 'en' ? 'Email address' : 'Adresse courriel'} type="email" />
            <input className="border border-border rounded-[10px] py-[11px] px-3.5 text-sm outline-none focus:border-primary bg-background" placeholder={lang === 'en' ? 'Password' : 'Mot de passe'} type="password" />
            <button className="w-full py-3.5 gradient-navy-dark text-primary-foreground border-none rounded-[10px] text-sm font-extrabold cursor-pointer hover:opacity-[0.87] transition-opacity">
              {lang === 'en' ? 'Log in' : 'Se connecter'}
            </button>
            <div className="text-[12px] text-muted-foreground text-center cursor-pointer underline" onClick={onClose}>
              {lang === 'en' ? 'Cancel' : 'Annuler'}
            </div>
          </div>
        ) : (
          <div className="px-6 pb-5 text-center">
            <span className="text-[12px] text-muted-foreground">
              {lang === 'en' ? 'Select an account type to continue' : 'Sélectionne un type de compte pour continuer'}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
