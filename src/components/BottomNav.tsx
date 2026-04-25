import { useEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useLang } from '@/lib/langContext';
import { useCartStore } from '@/stores/localCartStore';
import { Home, Store, ShoppingCart } from 'lucide-react';

/**
 * BottomNav — mobile-only fixed bottom tab bar (Home / Shop / Cart) with
 * a live cart-count badge, route-aware active state, and an sr-only
 * live region that announces cart changes regardless of focus.
 */
export function BottomNav() {
  const location = useLocation();
  const { lang, t } = useLang();
  const itemCount = useCartStore(s => s.getItemCount());

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
    // Brief scale pulse so the badge "pops" when the count changes. Pure
    // CSS via a timed class toggle — avoids pulling in framer-motion for
    // a 200ms flourish.
    if (itemCount > 0) {
      setPulse(true);
      const id = window.setTimeout(() => setPulse(false), 240);
      return () => window.clearTimeout(id);
    }
  }, [itemCount, lang]);

  const items = [
    { id: 'home', label: t('accueil'),  path: '/',         icon: Home },
    { id: 'shop', label: t('boutique'), path: '/products', icon: Store },
    { id: 'cart', label: t('panier'),   path: '/cart',     icon: ShoppingCart },
  ] as const;

  return (
    <nav
      // z-[440] sits one tier below the AIChat FAB (z-[450]) so the
      // floating chat button always overlaps the nav instead of
      // fighting it.
      className="fixed bottom-0 left-0 right-0 z-[440] bg-white border-t border-zinc-100 shadow-[0_-2px_12px_rgba(0,0,0,0.06)]"
      style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
      role="navigation"
      aria-label={lang === 'en' ? 'Bottom navigation' : 'Navigation du bas'}
    >
      <div className="flex items-center justify-around h-[60px] max-w-md mx-auto">
        {items.map(item => {
          const Icon = item.icon;
          // Product detail lives at /product/<handle> (singular), but
          // that's still 'Shop' in the nav — treat it as part of the
          // /products tree so the tab actually lights up on PDPs.
          const active = item.path === '/'
            ? location.pathname === '/'
            : item.path === '/products'
              ? location.pathname.startsWith('/products') || location.pathname.startsWith('/product/')
              : location.pathname.startsWith(item.path);
          const ariaLabel = item.id === 'cart' && itemCount > 0
            ? `${item.label} (${itemCount})`
            : item.label;
          // Use Link instead of button — preserves Cmd/right-click "Open
          // in new tab", proper screen reader announcement as link, and
          // browser history works as users expect.
          return (
            <Link
              key={item.id}
              to={item.path}
              className="flex flex-col items-center justify-center gap-0.5 min-w-[60px] py-1 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0052CC] focus-visible:ring-offset-1 rounded-md no-underline"
              aria-current={active ? 'page' : undefined}
              aria-label={ariaLabel}
            >
              <span className="relative">
                <Icon
                  size={20}
                  strokeWidth={active ? 2.2 : 1.5}
                  className={`transition-colors ${active ? 'text-[#0052CC]' : 'text-zinc-400'}`}
                  aria-hidden="true"
                />
                {item.id === 'cart' && itemCount > 0 && (
                  <span
                    className={`absolute -top-1.5 -right-2 min-w-[16px] h-[16px] bg-[#0052CC] rounded-full text-[9px] font-bold text-white flex items-center justify-center px-0.5 transition-transform duration-200 ease-out ${pulse ? 'scale-125' : 'scale-100'}`}
                    aria-hidden="true"
                  >
                    {itemCount > 99 ? '99+' : itemCount}
                  </span>
                )}
              </span>
              <span className={`text-[10px] font-semibold transition-colors ${active ? 'text-[#0052CC]' : 'text-zinc-400'}`}>
                {item.label}
              </span>
              {/* 2px active indicator bar — sits under the label and only
                 renders on the active tab. Matches the brand blue used
                 elsewhere for primary active states. */}
              <span
                aria-hidden="true"
                className={`mt-0.5 h-[2px] w-4 rounded-full transition-colors ${active ? 'bg-[#0052CC]' : 'bg-transparent'}`}
              />
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
