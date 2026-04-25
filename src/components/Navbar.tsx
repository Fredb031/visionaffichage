import { Link, useNavigate } from 'react-router-dom';
import { useCallback, useEffect, useRef, useState } from 'react';
import { LayoutDashboard, LogOut, ShoppingCart, User } from 'lucide-react';
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

/**
 * Vision Affichage redesign Section 03 — Desktop Navbar.
 *
 * Sticky white bar with a left logo, three centered links
 * (Accueil / Boutique / Personnaliser), and a right-side cluster of
 * Connexion + Cart icon (red badge for cartCount) + Commander CTA.
 *
 * Routes
 *   - "Boutique" -> `/products` (the existing brief route; the spec
 *     placeholder of `/boutique` doesn't exist in App.tsx).
 *   - "Personnaliser" -> `/products` since the codebase has no standalone
 *     `/customizer` route — the customizer lives inside ProductDetail
 *     and is reached by picking a product. Wiring the link to the shop
 *     keeps users on a real route while still surfacing the entry point.
 *
 * Brand tokens are written as arbitrary Tailwind values referencing the
 * hex palette already used elsewhere in the app (#0052CC blue,
 * #E5E7EB grey border, #6B7280 grey text, #EF4444 red badge). The rule
 * "no navy/gold/cream" is honoured — no semantic navy/gold/cream classes
 * appear here.
 */
export function Navbar({ onOpenCart, onOpenLogin }: NavbarProps) {
  const [internalLoginOpen, setInternalLoginOpen] = useState(false);
  const openLogin = onOpenLogin ?? (() => setInternalLoginOpen(true));
  const itemCount = useCartStore((s) => s.getItemCount());
  const { lang, t } = useLang();

  // Cart-badge pulse on increase. We replay a 400ms scale keyframe whenever
  // a new item lands in the cart so silent numeric bumps don't fly under
  // the eye. First mount stays silent (pulseId=0) even with a non-empty
  // persisted cart.
  const prevCountRef = useRef(itemCount);
  const [pulseId, setPulseId] = useState(0);
  useEffect(() => {
    if (itemCount > prevCountRef.current) {
      setPulseId((n) => n + 1);
    }
    prevCountRef.current = itemCount;
  }, [itemCount]);

  const user = useAuthStore((s) => s.user);
  const signOut = useAuthStore((s) => s.signOut);
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuTriggerRef = useRef<HTMLButtonElement | null>(null);
  const wasMenuOpenRef = useRef(false);

  useEscapeKey(menuOpen, useCallback(() => setMenuOpen(false), []));

  // Return focus to the avatar trigger when the menu closes so keyboard
  // users aren't stranded on a vanished menu item.
  useEffect(() => {
    if (wasMenuOpenRef.current && !menuOpen) {
      menuTriggerRef.current?.focus({ preventScroll: true });
    }
    wasMenuOpenRef.current = menuOpen;
  }, [menuOpen]);

  // Global Cmd/Ctrl+Shift+C opens the cart drawer from anywhere Navbar is
  // mounted. Skip when focus is in a text input so typing 'C' mid-form
  // doesn't hijack the keystroke.
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

  const dashboardPath = user?.role === 'president' || user?.role === 'admin'
    ? '/admin'
    : user?.role === 'vendor' ? '/vendor' : null;

  // Three center links — keys map to the existing i18n strings.
  const centerLinks = [
    { to: '/', label: t('accueil') },
    { to: '/products', label: t('boutique') },
    { to: '/products', label: lang === 'en' ? 'Customize' : 'Personnaliser' },
  ] as const;

  return (
    <nav
      className="sticky top-0 z-50 bg-white border-b border-[#E5E7EB]"
      style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}
      role="navigation"
      aria-label="Main navigation"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Logo */}
        <Link
          to="/"
          aria-label="Vision Affichage — Home"
          className="flex items-center rounded-md focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0052CC] focus-visible:ring-offset-2"
        >
          <img
            src="/logo-va-black.svg"
            alt="Vision Affichage"
            width={120}
            height={32}
            loading="eager"
            fetchPriority="high"
            decoding="async"
            className="block h-8 w-auto"
            onError={(e) => {
              // Fallback to the production CDN logo if the local
              // /logo-va-black.svg placeholder isn't deployed yet — keeps
              // the brand mark visible in every environment.
              const img = e.currentTarget as HTMLImageElement;
              if (!img.dataset.fallback) {
                img.dataset.fallback = '1';
                img.src =
                  'https://cdn.shopify.com/s/files/1/0578/1038/7059/files/Asset_1_d5d82510-0b83-4657-91b7-3ac1992ee697.svg?height=90&v=1769614651';
              } else {
                img.style.visibility = 'hidden';
              }
            }}
          />
        </Link>

        {/* Center links — hidden on mobile (mobile uses BottomNav) */}
        <div className="hidden md:flex items-center gap-8">
          {centerLinks.map((link, i) => (
            <Link
              key={`${link.to}-${i}`}
              to={link.to}
              className="text-[14px] font-semibold text-zinc-900 hover:text-[#0052CC] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0052CC] focus-visible:ring-offset-2 rounded-md"
            >
              {link.label}
            </Link>
          ))}
        </div>

        {/* Right cluster */}
        <div className="flex items-center gap-2 sm:gap-3">
          <LangToggle />

          {user ? (
            <div className="relative">
              <button
                ref={menuTriggerRef}
                onClick={() => setMenuOpen((o) => !o)}
                className="flex items-center gap-2 text-[12px] font-bold border border-[#E5E7EB] pl-3 pr-2 py-[5px] rounded-full transition-all hover:border-zinc-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0052CC] focus-visible:ring-offset-1"
                aria-haspopup="menu"
                aria-expanded={menuOpen}
                aria-controls="navbar-user-menu"
                aria-label={lang === 'en' ? `Account menu for ${user.name}` : `Menu compte de ${user.name}`}
              >
                <span className="hidden sm:inline text-[#6B7280]" aria-hidden="true">{user.name.split(' ')[0]}</span>
                <span className="w-7 h-7 rounded-full bg-[#0052CC] text-white flex items-center justify-center text-[10px] font-extrabold" aria-hidden="true">
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
                    className="absolute right-0 mt-2 w-56 bg-white border border-[#E5E7EB] rounded-xl shadow-xl z-[420] overflow-hidden"
                    role="menu"
                  >
                    <div className="p-3 border-b border-[#E5E7EB]">
                      <div className="text-sm font-bold truncate">{user.name}</div>
                      <div className="text-[11px] text-[#6B7280] truncate">{user.email}</div>
                      <div className="text-[10px] text-[#0052CC] font-bold uppercase tracking-wider mt-1">
                        {user.role}
                      </div>
                    </div>

                    {dashboardPath && (
                      <Link
                        to={dashboardPath}
                        onClick={() => setMenuOpen(false)}
                        role="menuitem"
                        className="flex items-center gap-2.5 px-3 py-2.5 text-sm hover:bg-zinc-50 transition-colors focus:outline-none focus-visible:bg-zinc-50"
                      >
                        <LayoutDashboard size={15} aria-hidden="true" />
                        {lang === 'en'
                          ? user.role === 'vendor' ? 'Vendor dashboard' : 'Admin dashboard'
                          : user.role === 'vendor' ? 'Tableau de bord vendeur' : 'Tableau de bord admin'}
                      </Link>
                    )}
                    <Link
                      to="/account"
                      onClick={() => setMenuOpen(false)}
                      role="menuitem"
                      className="flex items-center gap-2.5 px-3 py-2.5 text-sm hover:bg-zinc-50 transition-colors focus:outline-none focus-visible:bg-zinc-50"
                    >
                      <User size={15} aria-hidden="true" />
                      {lang === 'en' ? 'My account' : 'Mon compte'}
                    </Link>
                    <button
                      type="button"
                      onClick={async () => {
                        // Close menu first for perceived speed, then await
                        // signOut so its async store clears finish before we
                        // navigate (otherwise the home page briefly renders
                        // with the ex-user's cart badge).
                        setMenuOpen(false);
                        await signOut();
                        navigate('/');
                      }}
                      role="menuitem"
                      className="w-full flex items-center gap-2.5 px-3 py-2.5 text-sm hover:bg-zinc-50 transition-colors border-none bg-transparent cursor-pointer text-left text-[#EF4444] focus:outline-none focus-visible:bg-red-50"
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
              className="hidden sm:inline-flex items-center text-[13px] font-semibold text-zinc-900 hover:text-[#0052CC] transition-colors px-2 py-1 rounded-md focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0052CC] focus-visible:ring-offset-2"
            >
              {t('connexion')}
            </button>
          )}

          {/* Cart icon button with red badge */}
          <button
            onClick={onOpenCart}
            aria-label={`${t('panier')}${itemCount > 0 ? ` (${itemCount})` : ''}`}
            aria-keyshortcuts="Meta+Shift+C Control+Shift+C"
            title={`${t('panier')} (⇧⌘C)`}
            className="relative p-2 rounded-full text-zinc-900 hover:bg-zinc-100 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0052CC] focus-visible:ring-offset-2"
          >
            <ShoppingCart size={20} strokeWidth={1.75} aria-hidden="true" />
            {itemCount > 0 && (
              <>
                <style>{`
                  @keyframes navCartPulse {
                    0%   { transform: scale(1); }
                    45%  { transform: scale(1.25); }
                    100% { transform: scale(1); }
                  }
                `}</style>
                <span
                  key={pulseId}
                  style={{
                    animation: pulseId > 0 ? 'navCartPulse 400ms cubic-bezier(.34,1.56,.64,1)' : undefined,
                  }}
                  className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 bg-[#EF4444] rounded-full text-[10px] font-bold text-white flex items-center justify-center"
                  aria-hidden="true"
                >
                  {itemCount > 99 ? '99+' : itemCount}
                </span>
              </>
            )}
          </button>

          {/* Commander CTA */}
          <Link
            to="/products"
            className="hidden md:inline-flex items-center text-[13px] font-bold text-white bg-[#0052CC] hover:bg-[#003F9E] px-5 py-2 rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0052CC] focus-visible:ring-offset-2"
          >
            {lang === 'en' ? 'Order' : 'Commander'}
          </Link>
        </div>
      </div>

      {/* Internal LoginModal — every page that uses Navbar gets login for free */}
      {!user && !onOpenLogin && (
        <LoginModal isOpen={internalLoginOpen} onClose={() => setInternalLoginOpen(false)} />
      )}
    </nav>
  );
}
