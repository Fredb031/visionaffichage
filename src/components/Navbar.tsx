import { Link } from 'react-router-dom';
import { useCartStore } from '@/store/cartStore';
import { useLang, LangToggle } from '@/lib/langContext';

interface NavbarProps {
  onOpenCart?: () => void;
  onOpenLogin?: () => void;
}

export function Navbar({ onOpenCart, onOpenLogin }: NavbarProps) {
  const itemCount = useCartStore((s) => s.getItemCount());
  const { t } = useLang();

  return (
    <nav className="fixed top-0 left-0 right-0 z-[400] h-[58px] flex items-center justify-between px-6 md:px-10 bg-background/[0.93] backdrop-blur-xl border-b border-border">
      <Link to="/">
        <img src="https://visionaffichage.com/cdn/shop/files/Asset_1_d5d82510-0b83-4657-91b7-3ac1992ee697.svg?height=90&v=1769614651" alt="Vision" className="h-6" />
      </Link>

      <div className="flex items-center gap-2">
        <LangToggle />
        {onOpenLogin && (
          <button onClick={onOpenLogin} className="hidden sm:flex items-center gap-1.5 text-[12px] font-bold text-muted-foreground border border-border px-4 py-[7px] rounded-full transition-all hover:border-muted-foreground hover:text-foreground">
            <svg className="w-[13px] h-[13px]" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" viewBox="0 0 24 24"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2M12 11a4 4 0 100-8 4 4 0 000 8z"/></svg>
            {t('connexion')}
          </button>
        )}
        <button onClick={onOpenCart} className="flex items-center gap-[7px] text-[13px] text-muted-foreground border border-border px-4 py-[7px] rounded-full transition-all hover:border-muted-foreground hover:text-foreground relative">
          <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" viewBox="0 0 24 24"><path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4zM3 6h18M16 10a4 4 0 01-8 0"/></svg>
          <span className="hidden sm:inline">{t('panier')}</span>
          {itemCount > 0 && (
            <span className="absolute -top-1 -right-1 w-4 h-4 bg-accent rounded-full text-[9px] font-extrabold text-accent-foreground flex items-center justify-center">{itemCount}</span>
          )}
        </button>
        <Link to="/products" className="hidden sm:inline-block text-[13px] font-bold text-primary-foreground gradient-navy-dark border-none px-[22px] py-[9px] rounded-full transition-all hover:opacity-85 hover:-translate-y-px" style={{ boxShadow: '0 4px 16px hsla(var(--navy), 0.3)' }}>
          {t('voirProduits')}
        </Link>
      </div>
    </nav>
  );
}
