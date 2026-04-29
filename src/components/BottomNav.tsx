import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useLang } from '@/lib/langContext';
import { useCartStore } from '@/stores/localCartStore';
import { Home, ShoppingBag, Edit3, ShoppingCart } from 'lucide-react';

// Visual + animation constants kept out of JSX so they're easy to tune
// without diff noise inside the render tree.
const BADGE_MAX = 99;            // anything beyond this renders as "99+"
const PULSE_DURATION_MS = 240;   // matches the Tailwind duration-200 ease-out

/**
 * BottomNav — mobile-only fixed bottom tab bar (Master Prompt spec).
 *
 *   fixed bottom-0 inset-x-0 bg-white border-t border-va-line z-40
 *   pb-[env(safe-area-inset-bottom)]
 *
 * Four tabs in spec order:
 *   1. Accueil  (Home,         /)
 *   2. Boutique (ShoppingBag,  /boutique)
 *   3. Créer    (Edit3,        /customizer)
 *   4. Panier   (ShoppingCart, /panier) — with cart-count badge
 *
 * Active tab uses text-va-blue. Inactive uses text-va-muted. The cart
 * pulse respects prefers-reduced-motion (commit 4183f34): users who
 * opted out of motion get the live-region announcement only — no scale
 * keyframe, no flash.
 */
export function BottomNav() {
  const location = useLocation();
  const { lang, t } = useLang();
  const rawCount = useCartStore(s => s.getItemCount());
  // Defensive guard: even though localCartStore.getItemCount() already
  // filters non-finite quantities, a downstream consumer rendering "NaN"
  // inside a live region (announced to AT users) is a much worse
  // failure mode than silently clamping to 0 here.
  const itemCount = Number.isFinite(rawCount) && rawCount > 0 ? Math.floor(rawCount) : 0;

  // Announce cart count changes to screen readers. The badge itself is
  // aria-hidden (purely decorative) and the link's aria-label is only
  // read when it receives focus, so counting changes (item added from
  // another page, cart cleared, etc.) go silent without a live region.
  const [announcement, setAnnouncement] = useState('');
  const [pulse, setPulse] = useState(false);
  const prevCountRef = useRef(itemCount);
  useEffect(() => {
    const prev = prevCountRef.current;
    if (prev === itemCount) return;
    prevCountRef.current = itemCount;
    if (itemCount === 0) {
      setAnnouncement(lang === 'en' ? 'Cart is empty' : 'Panier vide');
    } else if (lang === 'en') {
      setAnnouncement(`Cart: ${itemCount} ${itemCount === 1 ? 'item' : 'items'}`);
    } else {
      setAnnouncement(`Panier : ${itemCount} ${itemCount === 1 ? 'article' : 'articles'}`);
    }
    // Pure-CSS scale pulse so the badge "pops" when the count changes.
    // Respect prefers-reduced-motion (WCAG 2.3.3): users who've opted
    // out of motion shouldn't get a scale animation, even a small one
    // — the live-region announcement above already conveys the change
    // non-visually. (Commit 4183f34.)
    if (itemCount > 0) {
      const prefersReducedMotion =
        typeof window !== 'undefined' &&
        typeof window.matchMedia === 'function' &&
        window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      if (prefersReducedMotion) return;
      setPulse(true);
      const id = window.setTimeout(() => setPulse(false), PULSE_DURATION_MS);
      return () => window.clearTimeout(id);
    }
  }, [itemCount, lang]);

  // Memoised so the items array isn't recreated on every cart update.
  // Order is canonical per Master Prompt — do not reorder.
  const items = useMemo(() => ([
    { id: 'home', label: t('accueil'),       path: '/',           icon: Home },
    { id: 'shop', label: t('boutique'),      path: '/boutique',   icon: ShoppingBag },
    { id: 'make', label: t('creer'),         path: '/customizer', icon: Edit3 },
    { id: 'cart', label: t('panier'),        path: '/panier',     icon: ShoppingCart },
  ] as const), [t]);

  return (
    <nav
      // z-40 per spec. Sits below the AIChat FAB which uses z-[450].
      className="fixed bottom-0 inset-x-0 bg-white border-t border-va-line z-40"
      style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
      role="navigation"
      aria-label={lang === 'en' ? 'Bottom navigation' : 'Navigation du bas'}
    >
      <div className="flex items-stretch">
        {items.map(item => {
          const Icon = item.icon;
          // Boundary checks (exact, or trailing "/") so a future route
          // like "/boutique-export" wouldn't accidentally light up the
          // Boutique tab.
          const path = location.pathname;
          const startsWithBoundary = (prefix: string) =>
            path === prefix || path.startsWith(`${prefix}/`);
          const active = item.id === 'home'
            ? path === '/'
            : item.id === 'shop'
              // Treat the existing /products tree (and singular /product
              // PDPs) as part of Boutique too, until those routes are
              // migrated to the spec /boutique path.
              ? startsWithBoundary('/boutique')
                || startsWithBoundary('/products')
                || startsWithBoundary('/product')
              : item.id === 'make'
                ? startsWithBoundary('/customizer')
                // Cart tab: spec /panier plus existing /cart route.
                : startsWithBoundary('/panier') || startsWithBoundary('/cart');
          const ariaLabel = item.id === 'cart' && itemCount > 0
            ? lang === 'en'
              ? `${item.label}, ${itemCount} ${itemCount === 1 ? 'item' : 'items'}`
              : `${item.label}, ${itemCount} ${itemCount === 1 ? 'article' : 'articles'}`
            : item.label;
          // Use Link instead of button — preserves Cmd/right-click "Open
          // in new tab", proper screen reader announcement as link, and
          // browser history works as users expect.
          return (
            <Link
              key={item.id}
              to={item.path}
              className={`flex-1 flex flex-col items-center gap-1 py-2 text-xs transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-va-blue focus-visible:ring-offset-1 no-underline ${
                active ? 'text-va-blue' : 'text-va-muted'
              }`}
              aria-current={active ? 'page' : undefined}
              aria-label={ariaLabel}
            >
              <span className="relative">
                <Icon
                  size={20}
                  strokeWidth={active ? 2.2 : 1.5}
                  aria-hidden="true"
                />
                {item.id === 'cart' && itemCount > 0 && (
                  <span
                    className={`absolute -top-0.5 -right-1 bg-red-500 text-white rounded-full text-[10px] font-bold w-4 h-4 flex items-center justify-center transition-transform duration-200 ease-out ${pulse ? 'scale-125' : 'scale-100'}`}
                    aria-hidden="true"
                  >
                    {itemCount > BADGE_MAX ? `${BADGE_MAX}+` : itemCount}
                  </span>
                )}
              </span>
              <span className="font-medium">
                {item.label}
              </span>
            </Link>
          );
        })}
      </div>
      <span role="status" aria-live="polite" aria-atomic="true" className="sr-only">
        {announcement}
      </span>
    </nav>
  );
}
