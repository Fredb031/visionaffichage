import { Link, useNavigate } from 'react-router-dom';
import { useCallback, useEffect, useState } from 'react';
import { LayoutDashboard, LogOut, User } from 'lucide-react';
import { useCartStore } from '@/stores/localCartStore';
import { useLang, LangToggle } from '@/lib/langContext';
import { useAuthStore } from '@/stores/authStore';
import { LoginModal } from '@/components/LoginModal';
import { useEscapeKey } from '@/hooks/useEscapeKey';

interface NavbarProps {
  onOpenCart?: () => void;
  /** Optional override — by default Navbar manages its own LoginModal */
  onOpenLogin?: () => void;
}

export function Navbar({ onOpenCart, onOpenLogin }: NavbarProps) {
  const [internalLoginOpen, setInternalLoginOpen] = useState(false);
  const openLogin = onOpenLogin ?? (() => setInternalLoginOpen(true));
  const itemCount = useCartStore((s) => s.getItemCount());
  const { lang, t } = useLang();
  const user = useAuthStore(s => s.user);
  const signOut = useAuthStore(s => s.signOut);
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);

  // Close the user menu on Escape so keyboard users can dismiss it
  // without having to click outside.
  useEscapeKey(menuOpen, useCallback(() => setMenuOpen(false), []));

  // Global Cmd/Ctrl+Shift+C opens the cart drawer from anywhere Navbar
  // is mounted (every page). Skip when focus is in a text input or
  // contentEditable so typing 'C' mid-form doesn't hijack the keystroke.
  // Chosen over plain Cmd+K (owned by admin search) and Cmd+C (system
  // copy). Shift+C is rarely bound and intentional enough to avoid
  // stealing from browser defaults.
  useEffect(() => {
    if (!onOpenCart) return;
    const onKey = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey) || !e.shiftKey) return;
      if (e.key.toLowerCase() !== 'c') return;
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
      e.preventDefault();
      onOpenCart();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onOpenCart]);

  // President is the highest admin tier — route it to the same admin
  // dashboard as 'admin'. Before this, owners signed in as 'president'
  // saw no Dashboard link in the navbar menu and had to type /admin
  // into the URL bar to reach their own console.
  const dashboardPath = user?.role === 'president' || user?.role === 'admin'
    ? '/admin'
    : user?.role === 'vendor' ? '/vendor' : null;

  return (
    <nav
      className="fixed top-0 left-0 right-0 z-[400] h-[58px] flex items-center justify-between px-6 md:px-10 bg-background/[0.93] backdrop-blur-xl border-b border-border"
      role="navigation"
      aria-label="Main navigation"
    >
      <Link
        to="/"
        aria-label="Vision Affichage — Home"
        className="rounded-md focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0052CC] focus-visible:ring-offset-2"
      >
        <img
          src="https://cdn.shopify.com/s/files/1/0578/1038/7059/files/Asset_1_d5d82510-0b83-4657-91b7-3ac1992ee697.svg?height=90&v=1769614651"
          alt="Vision Affichage"
          width={96}
          height={24}
          decoding="async"
          className="h-6 w-auto"
          onError={e => { (e.currentTarget as HTMLImageElement).style.visibility = 'hidden'; }}
        />
      </Link>

      <div className="flex items-center gap-2">
        <LangToggle />

        {user ? (
          <div className="relative">
            <button
              onClick={() => setMenuOpen(o => !o)}
              className="flex items-center gap-2 text-[12px] font-bold border border-border pl-3 pr-2 py-[5px] rounded-full transition-all hover:border-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0052CC] focus-visible:ring-offset-1"
              aria-haspopup="menu"
              aria-expanded={menuOpen}
              aria-controls="navbar-user-menu"
              aria-label={lang === 'en' ? `Account menu for ${user.name}` : `Menu compte de ${user.name}`}
            >
              <span className="hidden sm:inline text-muted-foreground" aria-hidden="true">{user.name.split(' ')[0]}</span>
              <span className="w-7 h-7 rounded-full bg-gradient-to-br from-[#0052CC] to-[#1B3A6B] text-white flex items-center justify-center text-[10px] font-extrabold" aria-hidden="true">
                {user.initials}
              </span>
            </button>

            {menuOpen && (
              <>
                <button
                  className="fixed inset-0 z-[410] bg-transparent border-none cursor-default"
                  onClick={() => setMenuOpen(false)}
                  aria-label={lang === 'en' ? 'Close menu' : 'Fermer le menu'}
                />
                <div
                  id="navbar-user-menu"
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
                      role="menuitem"
                      className="flex items-center gap-2.5 px-3 py-2.5 text-sm hover:bg-secondary transition-colors focus:outline-none focus-visible:bg-secondary"
                    >
                      <LayoutDashboard size={15} aria-hidden="true" />
                      {lang === 'en'
                        ? (user.role === 'vendor' ? 'Vendor dashboard' : 'Admin dashboard')
                        : (user.role === 'vendor' ? 'Tableau de bord vendeur' : 'Tableau de bord admin')}
                    </Link>
                  )}
                  <Link
                    to="/account"
                    onClick={() => setMenuOpen(false)}
                    role="menuitem"
                    className="flex items-center gap-2.5 px-3 py-2.5 text-sm hover:bg-secondary transition-colors focus:outline-none focus-visible:bg-secondary"
                  >
                    <User size={15} aria-hidden="true" />
                    {lang === 'en' ? 'My account' : 'Mon compte'}
                  </Link>
                  <button
                    type="button"
                    onClick={async () => {
                      // Close the menu immediately for perceived speed,
                      // then await signOut so its async in-memory store
                      // clears (cart/customizer reset via dynamic imports)
                      // finish BEFORE we navigate. Without the await, the
                      // / home page rendered briefly with the ex-user's
                      // cart badge still populated until the clears landed.
                      setMenuOpen(false);
                      await signOut();
                      navigate('/');
                    }}
                    role="menuitem"
                    className="w-full flex items-center gap-2.5 px-3 py-2.5 text-sm hover:bg-secondary transition-colors border-none bg-transparent cursor-pointer text-left text-destructive focus:outline-none focus-visible:bg-destructive/10"
                  >
                    <LogOut size={15} aria-hidden="true" />
                    {lang === 'en' ? 'Sign out' : 'Déconnexion'}
                  </button>
                </div>
              </>
            )}
          </div>
        ) : (
          <button
            onClick={openLogin}
            className="flex items-center gap-1.5 text-[12px] font-bold text-muted-foreground border border-border px-3 sm:px-4 py-[7px] rounded-full transition-all hover:border-muted-foreground hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0052CC] focus-visible:ring-offset-2"
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
            <span className="hidden sm:inline">{t('connexion')}</span>
          </button>
        )}

        <button
          onClick={onOpenCart}
          aria-label={`${t('panier')}${itemCount > 0 ? ` (${itemCount})` : ''}`}
          aria-keyshortcuts="Meta+Shift+C Control+Shift+C"
          title={`${t('panier')} (⇧⌘C)`}
          className="flex items-center gap-[7px] text-[13px] text-muted-foreground border border-border px-4 py-[7px] rounded-full transition-all hover:border-muted-foreground hover:text-foreground relative focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0052CC] focus-visible:ring-offset-2"
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
            <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-0.5 bg-accent rounded-full text-[9px] font-extrabold text-accent-foreground flex items-center justify-center">
              {itemCount > 99 ? '99+' : itemCount}
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

      {/* Internal LoginModal — every page that uses Navbar gets login for free */}
      {!user && !onOpenLogin && (
        <LoginModal isOpen={internalLoginOpen} onClose={() => setInternalLoginOpen(false)} />
      )}
    </nav>
  );
}
