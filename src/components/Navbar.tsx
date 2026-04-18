import { Link, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { LayoutDashboard, LogOut, User } from 'lucide-react';
import { useCartStore } from '@/store/cartStore';
import { useLang, LangToggle } from '@/lib/langContext';
import { useAuthStore } from '@/stores/authStore';

interface NavbarProps {
  onOpenCart?: () => void;
  onOpenLogin?: () => void;
}

export function Navbar({ onOpenCart, onOpenLogin }: NavbarProps) {
  const itemCount = useCartStore((s) => s.getItemCount());
  const { t } = useLang();
  const user = useAuthStore(s => s.user);
  const signOut = useAuthStore(s => s.signOut);
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);

  const dashboardPath = user?.role === 'admin' ? '/admin' : user?.role === 'vendor' ? '/vendor' : null;

  return (
    <nav
      className="fixed top-0 left-0 right-0 z-[400] h-[58px] flex items-center justify-between px-6 md:px-10 bg-background/[0.93] backdrop-blur-xl border-b border-border"
      role="navigation"
      aria-label="Main navigation"
    >
      <Link to="/" aria-label="Vision Affichage — Home">
        <img
          src="https://cdn.shopify.com/s/files/1/0578/1038/7059/files/Asset_1_d5d82510-0b83-4657-91b7-3ac1992ee697.svg?height=90&v=1769614651"
          alt="Vision Affichage"
          className="h-6"
        />
      </Link>

      <div className="flex items-center gap-2">
        <LangToggle />

        {user ? (
          <div className="relative">
            <button
              onClick={() => setMenuOpen(o => !o)}
              className="flex items-center gap-2 text-[12px] font-bold border border-border pl-3 pr-2 py-[5px] rounded-full transition-all hover:border-foreground"
              aria-haspopup="menu"
              aria-expanded={menuOpen}
            >
              <span className="hidden sm:inline text-muted-foreground">{user.name.split(' ')[0]}</span>
              <span className="w-7 h-7 rounded-full bg-gradient-to-br from-[#0052CC] to-[#1B3A6B] text-white flex items-center justify-center text-[10px] font-extrabold">
                {user.initials}
              </span>
            </button>

            {menuOpen && (
              <>
                <button
                  className="fixed inset-0 z-[410] bg-transparent border-none cursor-default"
                  onClick={() => setMenuOpen(false)}
                  aria-label="Close menu"
                />
                <div
                  className="absolute right-0 mt-2 w-56 bg-background border border-border rounded-xl shadow-xl z-[420] overflow-hidden"
                  role="menu"
                >
                  <div className="p-3 border-b border-border">
                    <div className="text-sm font-bold truncate">{user.name}</div>
                    <div className="text-[11px] text-muted-foreground truncate">{user.email}</div>
                    <div className="text-[10px] text-[#0052CC] font-bold uppercase tracking-wider mt-1">
                      {user.role}
                    </div>
                  </div>

                  {dashboardPath && (
                    <Link
                      to={dashboardPath}
                      onClick={() => setMenuOpen(false)}
                      className="flex items-center gap-2.5 px-3 py-2.5 text-sm hover:bg-secondary transition-colors"
                    >
                      <LayoutDashboard size={15} />
                      {user.role === 'admin' ? 'Tableau de bord admin' : 'Tableau de bord vendeur'}
                    </Link>
                  )}
                  <Link
                    to="/account"
                    onClick={() => setMenuOpen(false)}
                    className="flex items-center gap-2.5 px-3 py-2.5 text-sm hover:bg-secondary transition-colors"
                  >
                    <User size={15} />
                    Mon compte
                  </Link>
                  <button
                    type="button"
                    onClick={() => {
                      signOut();
                      setMenuOpen(false);
                      navigate('/');
                    }}
                    className="w-full flex items-center gap-2.5 px-3 py-2.5 text-sm hover:bg-secondary transition-colors border-none bg-transparent cursor-pointer text-left text-destructive"
                  >
                    <LogOut size={15} />
                    Déconnexion
                  </button>
                </div>
              </>
            )}
          </div>
        ) : (
          onOpenLogin && (
            <button
              onClick={onOpenLogin}
              className="hidden sm:flex items-center gap-1.5 text-[12px] font-bold text-muted-foreground border border-border px-4 py-[7px] rounded-full transition-all hover:border-muted-foreground hover:text-foreground"
            >
              <svg
                className="w-[13px] h-[13px]"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2M12 11a4 4 0 100-8 4 4 0 000 8z" />
              </svg>
              {t('connexion')}
            </button>
          )
        )}

        <button
          onClick={onOpenCart}
          aria-label={`${t('panier')}${itemCount > 0 ? ` (${itemCount})` : ''}`}
          className="flex items-center gap-[7px] text-[13px] text-muted-foreground border border-border px-4 py-[7px] rounded-full transition-all hover:border-muted-foreground hover:text-foreground relative"
        >
          <svg
            width="15"
            height="15"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4zM3 6h18M16 10a4 4 0 01-8 0" />
          </svg>
          <span className="hidden sm:inline">{t('panier')}</span>
          {itemCount > 0 && (
            <span className="absolute -top-1 -right-1 w-4 h-4 bg-accent rounded-full text-[9px] font-extrabold text-accent-foreground flex items-center justify-center">
              {itemCount}
            </span>
          )}
        </button>

        <Link
          to="/products"
          className="hidden sm:inline-block text-[13px] font-bold text-primary-foreground gradient-navy-dark border-none px-[22px] py-[9px] rounded-full transition-all hover:opacity-85 hover:-translate-y-px"
          style={{ boxShadow: '0 4px 16px hsla(var(--navy), 0.3)' }}
        >
          {t('voirProduits')}
        </Link>
      </div>
    </nav>
  );
}
