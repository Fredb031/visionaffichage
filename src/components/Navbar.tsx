import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useCallback, useEffect, useRef, useState } from 'react';
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

/**
 * Desktop primary navbar — Master Prompt spec.
 *
 *   sticky top-0 · bg-white/95 backdrop-blur-md · border-b border-va-line
 *   z-50 h-16
 *
 * Layout:
 *   [logo]   [Accueil · Boutique · Personnaliser]   [LangToggle · Connexion · Cart · Commander]
 *
 * Active route gets `text-va-ink` + `aria-current="page"`. Cart-add pulse
 * collapses to a near-instant blip under prefers-reduced-motion via the
 * global rule in index.css. Scroll listener kept (toggles a heavier
 * shadow once the user scrolls past the hero) so the bar still feels
 * connected to scroll position even though the base treatment is now
 * always-opaque per spec.
 */
export function Navbar({ onOpenCart, onOpenLogin }: NavbarProps) {
  const [internalLoginOpen, setInternalLoginOpen] = useState(false);
  const openLogin = onOpenLogin ?? (() => setInternalLoginOpen(true));
  const itemCount = useCartStore((s) => s.getItemCount());
  const { lang, t } = useLang();
  const location = useLocation();

  // Cart-badge pulse on increase. We replay a 400ms scale+gold-flash
  // keyframe whenever a new item lands in the cart — silent numeric
  // bumps used to fly under the eye and leave shoppers unsure whether
  // their click registered. Rules:
  //   • Only increases pulse (decrement/clear is silent).
  //   • First mount is silent even if the persisted cart is non-empty —
  //     arriving on a page with 3 items already in cart shouldn't flash.
  //   • Showing the badge for the first time (0 -> n) counts as an
  //     increase so the very first add-to-cart of a session is loud.
  //   • prefers-reduced-motion collapses the keyframe to ~0ms via the
  //     global rule in index.css, so motion-sensitive users are spared.
  const prevCountRef = useRef(itemCount);
  const [pulseId, setPulseId] = useState(0);
  useEffect(() => {
    if (itemCount > prevCountRef.current) {
      setPulseId((n) => n + 1);
    }
    prevCountRef.current = itemCount;
  }, [itemCount]);
  const user = useAuthStore(s => s.user);
  const signOut = useAuthStore(s => s.signOut);
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuTriggerRef = useRef<HTMLButtonElement | null>(null);
  const wasMenuOpenRef = useRef(false);

  // Close the user menu on Escape so keyboard users can dismiss it
  // without having to click outside.
  useEscapeKey(menuOpen, useCallback(() => setMenuOpen(false), []));

  // Return focus to the avatar trigger when the menu closes.
  useEffect(() => {
    if (wasMenuOpenRef.current && !menuOpen) {
      menuTriggerRef.current?.focus({ preventScroll: true });
    }
    wasMenuOpenRef.current = menuOpen;
  }, [menuOpen]);

  // Global Cmd/Ctrl+Shift+C opens the cart drawer from anywhere Navbar
  // is mounted (every page). Skip when focus is in a text input or
  // contentEditable so typing 'C' mid-form doesn't hijack the keystroke.
  useEffect(() => {
    if (!onOpenCart) return;
    const onKey = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey) || !e.shiftKey) return;
      if (e.key.toLowerCase() !== 'c') return;
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) return;
      e.preventDefault();
      onOpenCart();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onOpenCart]);

  // President is the highest admin tier — route it to the same admin
  // dashboard as 'admin'.
  const dashboardPath = user?.role === 'president' || user?.role === 'admin'
    ? '/admin'
    : user?.role === 'vendor' ? '/vendor' : null;

  // Scroll listener kept (per spec: "KEEP scroll listener"). Adds a
  // subtle drop shadow once we're past the hero so the bar still
  // feels alive without competing with the spec's flat backdrop-blur
  // treatment when at the very top.
  const [scrolled, setScrolled] = useState(() =>
    typeof window !== 'undefined' ? window.scrollY > 8 : false
  );
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Boundary-aware active matcher so e.g. /products-export wouldn't
  // spuriously light up the Boutique tab.
  const path = location.pathname;
  const startsWithBoundary = (prefix: string) =>
    path === prefix || path.startsWith(`${prefix}/`);
  const isHomeActive = path === '/';
  // Boutique covers both the spec route /boutique and the existing
  // /products tree (/product/:handle on PDPs).
  const isShopActive = startsWithBoundary('/boutique')
    || startsWithBoundary('/products')
    || startsWithBoundary('/product');
  // Personnaliser covers the spec /customizer route plus any PDP that
  // currently mounts the customizer sheet inline.
  const isCustomizerActive = startsWithBoundary('/customizer');

  const links: Array<{ label: string; to: string; active: boolean }> = [
    { label: t('accueil'),       to: '/',           active: isHomeActive },
    { label: t('boutique'),      to: '/boutique',   active: isShopActive },
    { label: t('personnaliser'), to: '/customizer', active: isCustomizerActive },
  ];

  return (
    <nav
      className={`sticky top-0 bg-white/95 backdrop-blur-md border-b border-va-line z-50 h-16 flex items-center justify-between px-6 md:px-10 transition-shadow duration-200 ${
        scrolled ? 'shadow-[0_2px_8px_rgba(10,10,10,0.04)]' : ''
      }`}
      style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}
      role="navigation"
      aria-label="Main navigation"
    >
      <Link
        to="/"
        aria-label="Vision Affichage — Home"
        className="flex items-center rounded-md focus:outline-none focus-visible:ring-2 focus-visible:ring-va-blue focus-visible:ring-offset-2"
      >
        <img
          src="https://cdn.shopify.com/s/files/1/0578/1038/7059/files/Asset_1_d5d82510-0b83-4657-91b7-3ac1992ee697.svg?height=90&v=1769614651"
          alt="Vision Affichage"
          width={96}
          height={32}
          loading="eager"
          fetchPriority="high"
          decoding="async"
          className="block max-h-8 w-auto"
          onError={e => { (e.currentTarget as HTMLImageElement).style.visibility = 'hidden'; }}
        />
      </Link>

      {/* Center links — desktop only. Active route is text-va-ink with
          aria-current="page"; inactive links are text-va-dim and
          deepen to text-va-ink on hover. */}
      <div className="hidden md:flex gap-6">
        {links.map(link => (
          <Link
            key={link.to}
            to={link.to}
            aria-current={link.active ? 'page' : undefined}
            className={`font-medium text-sm transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-va-blue focus-visible:ring-offset-2 rounded-sm ${
              link.active ? 'text-va-ink' : 'text-va-dim hover:text-va-ink'
            }`}
          >
            {link.label}
          </Link>
        ))}
      </div>

      <div className="flex items-center gap-2">
        <LangToggle />

        {user ? (
          <div className="relative">
            <button
              type="button"
              ref={menuTriggerRef}
              onClick={() => setMenuOpen(o => !o)}
              className="flex items-center gap-2 text-[12px] font-bold border border-va-line pl-3 pr-2 py-[5px] rounded-full transition-all hover:border-va-line-h focus:outline-none focus-visible:ring-2 focus-visible:ring-va-blue focus-visible:ring-offset-1"
              aria-haspopup="menu"
              aria-expanded={menuOpen}
              aria-controls="navbar-user-menu"
              aria-label={lang === 'en' ? `Account menu for ${user.name}` : `Menu compte de ${user.name}`}
            >
              <span className="hidden sm:inline text-va-muted" aria-hidden="true">{user.name.split(' ')[0]}</span>
              <span className="w-7 h-7 rounded-full bg-gradient-to-br from-va-blue to-va-blue-h text-white flex items-center justify-center text-[10px] font-extrabold" aria-hidden="true">
                {user.initials}
              </span>
            </button>

            {menuOpen && (
              <>
                <button
                  type="button"
                  className="fixed inset-0 z-[410] bg-transparent border-none cursor-default"
                  onClick={() => setMenuOpen(false)}
                  aria-label={lang === 'en' ? 'Close menu' : 'Fermer le menu'}
                />
                <div
                  id="navbar-user-menu"
                  className="absolute right-0 mt-2 w-56 bg-white border border-va-line rounded-xl shadow-xl z-[420] overflow-hidden"
                  role="menu"
                >
                  <div className="p-3 border-b border-va-line">
                    <div className="text-sm font-bold truncate text-va-ink">{user.name}</div>
                    <div className="text-[11px] text-va-muted truncate">{user.email}</div>
                    <div className="text-[10px] text-va-blue font-bold uppercase tracking-wider mt-1">
                      {user.role}
                    </div>
                  </div>

                  {dashboardPath && (
                    <Link
                      to={dashboardPath}
                      onClick={() => setMenuOpen(false)}
                      role="menuitem"
                      className="flex items-center gap-2.5 px-3 py-2.5 text-sm text-va-ink hover:bg-va-bg-2 transition-colors focus:outline-none focus-visible:bg-va-bg-2"
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
                    className="flex items-center gap-2.5 px-3 py-2.5 text-sm text-va-ink hover:bg-va-bg-2 transition-colors focus:outline-none focus-visible:bg-va-bg-2"
                  >
                    <User size={15} aria-hidden="true" />
                    {lang === 'en' ? 'My account' : 'Mon compte'}
                  </Link>
                  <button
                    type="button"
                    onClick={async () => {
                      // Close the menu immediately for perceived speed,
                      // then await signOut so its async in-memory store
                      // clears finish BEFORE we navigate.
                      setMenuOpen(false);
                      await signOut();
                      navigate('/');
                    }}
                    role="menuitem"
                    className="w-full flex items-center gap-2.5 px-3 py-2.5 text-sm hover:bg-va-bg-2 transition-colors border-none bg-transparent cursor-pointer text-left text-va-err focus:outline-none focus-visible:bg-va-err/10"
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
            type="button"
            onClick={openLogin}
            // Below the sm breakpoint the visible label span is hidden, leaving
            // the button as an icon-only control. The <svg> is aria-hidden, so
            // without an explicit aria-label, mobile screen-reader users hear
            // an unlabeled "button" in the navbar (commit f36d2e9 fix).
            aria-label={t('connexion')}
            className="flex items-center gap-1.5 text-[12px] font-bold text-va-ink border border-va-line px-3 sm:px-4 py-[7px] rounded-full transition-all hover:border-va-line-h focus:outline-none focus-visible:ring-2 focus-visible:ring-va-blue focus-visible:ring-offset-2"
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
          type="button"
          onClick={onOpenCart}
          aria-label={`${t('panier')}${itemCount > 0 ? ` (${itemCount})` : ''}`}
          aria-keyshortcuts="Meta+Shift+C Control+Shift+C"
          title={`${t('panier')} (⇧⌘C)`}
          className="flex items-center gap-[7px] text-[13px] text-va-ink border border-va-line px-4 py-[7px] rounded-full transition-all hover:border-va-line-h relative focus:outline-none focus-visible:ring-2 focus-visible:ring-va-blue focus-visible:ring-offset-2"
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
            // key={pulseId} remounts the span each time the count INCREASES
            // so the keyframe replays from frame 0. pulseId stays at 0 on
            // first mount, which keeps the initial render of a persisted
            // cart quiet. prefers-reduced-motion collapses the keyframe to
            // ~0ms via the global rule in index.css.
            <>
              <style>{`
                @keyframes cartAddPulse {
                  0%   { transform: scale(1);    box-shadow: 0 0 0 0 rgba(0, 82, 204, 0.0); }
                  45%  { transform: scale(1.25); box-shadow: 0 0 0 6px rgba(0, 82, 204, 0.55); background-color: #0052CC; }
                  100% { transform: scale(1);    box-shadow: 0 0 0 0 rgba(0, 82, 204, 0.0); }
                }
              `}</style>
              <span
                key={pulseId}
                style={{
                  animation: pulseId > 0
                    ? 'cartAddPulse 400ms cubic-bezier(.34,1.56,.64,1)'
                    : undefined,
                }}
                className="absolute -top-1 -right-1 min-w-[16px] h-4 px-0.5 bg-va-blue rounded-full text-[9px] font-extrabold text-white flex items-center justify-center"
              >
                {itemCount > 99 ? '99+' : itemCount}
              </span>
            </>
          )}
        </button>

        {/* Primary "Commander" CTA — bg-va-blue, hover bg-va-blue-h.
            Routes to /boutique per spec (the discovery surface where
            the actual order flow begins). */}
        <Link
          to="/boutique"
          className="hidden sm:inline-block bg-va-blue hover:bg-va-blue-h text-white font-semibold text-sm px-5 py-2 rounded-xl transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-va-blue focus-visible:ring-offset-2"
        >
          {t('commander')}
        </Link>
      </div>

      {/* Internal LoginModal — every page that uses Navbar gets login for free */}
      {!user && !onOpenLogin && (
        <LoginModal isOpen={internalLoginOpen} onClose={() => setInternalLoginOpen(false)} />
      )}
    </nav>
  );
}
