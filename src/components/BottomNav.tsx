import { useEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useLang } from '@/lib/langContext';
import { useCartStore } from '@/stores/localCartStore';
import { Home, ShoppingBag, Edit3, ShoppingCart } from 'lucide-react';

/**
 * Vision Affichage redesign Section 03 — Mobile bottom nav.
 *
 * Fixed bottom-0 white surface, md:hidden, four items (Accueil / Boutique
 * / Creer / Panier). Active item uses the brand blue, inactive uses
 * brand grey, icons are 22px, labels are 10px uppercase tracking-wide.
 *
 * Notes
 *   - "Boutique" routes to `/products` (the route the codebase actually
 *     ships; the brief used `/boutique` as a placeholder).
 *   - "Creer" routes to `/products` because the codebase has no
 *     standalone `/customizer` route — the customizer lives inside the
 *     ProductDetail page and is reached by selecting a product.
 *   - sr-only live region announces cart-count changes regardless of
 *     focus, since the badge is decorative and the link's aria-label
 *     only fires on focus.
 */
export function BottomNav() {
  const location = useLocation();
  const { lang } = useLang();
  const itemCount = useCartStore((s) => s.getItemCount());

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
    if (itemCount > 0) {
      setPulse(true);
      const id = window.setTimeout(() => setPulse(false), 240);
      return () => window.clearTimeout(id);
    }
  }, [itemCount, lang]);

  // Section 03 spec: exactly four items.
  const items = [
    {
      id: 'home',
      label: lang === 'en' ? 'Home' : 'Accueil',
      path: '/',
      icon: Home,
    },
    {
      id: 'shop',
      label: lang === 'en' ? 'Shop' : 'Boutique',
      path: '/products',
      icon: ShoppingBag,
    },
    {
      id: 'create',
      label: lang === 'en' ? 'Create' : 'Creer',
      path: '/products',
      icon: Edit3,
    },
    {
      id: 'cart',
      label: lang === 'en' ? 'Cart' : 'Panier',
      path: '/cart',
      icon: ShoppingCart,
    },
  ] as const;

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-[#E5E7EB] md:hidden"
      style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
      role="navigation"
      aria-label={lang === 'en' ? 'Bottom navigation' : 'Navigation du bas'}
    >
      <div className="flex items-center justify-around h-[60px] max-w-md mx-auto">
        {items.map((item, i) => {
          const Icon = item.icon;
          // Match `/products` and `/product/<handle>` for both the Shop
          // and Create tabs since they share the route entry point.
          const active = item.path === '/'
            ? location.pathname === '/'
            : item.path === '/products'
              ? location.pathname.startsWith('/products') || location.pathname.startsWith('/product/')
              : location.pathname.startsWith(item.path);
          const ariaLabel = item.id === 'cart' && itemCount > 0
            ? `${item.label} (${itemCount})`
            : item.label;
          // Disambiguate 'shop' and 'create' which share /products — use
          // the array index in the key so React keeps them as distinct
          // siblings.
          return (
            <Link
              key={`${item.id}-${i}`}
              to={item.path}
              className="flex flex-col items-center justify-center gap-0.5 min-w-[60px] py-1 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0052CC] focus-visible:ring-offset-1 rounded-md no-underline"
              aria-current={active ? 'page' : undefined}
              aria-label={ariaLabel}
            >
              <span className="relative">
                <Icon
                  size={22}
                  strokeWidth={active ? 2.2 : 1.6}
                  className={`transition-colors ${active ? 'text-[#0052CC]' : 'text-[#6B7280]'}`}
                  aria-hidden="true"
                />
                {item.id === 'cart' && itemCount > 0 && (
                  <span
                    className={`absolute -top-1.5 -right-2 min-w-[16px] h-[16px] bg-[#EF4444] rounded-full text-[9px] font-bold text-white flex items-center justify-center px-0.5 transition-transform duration-200 ease-out ${pulse ? 'scale-125' : 'scale-100'}`}
                    aria-hidden="true"
                  >
                    {itemCount > 99 ? '99+' : itemCount}
                  </span>
                )}
              </span>
              <span
                className={`text-[10px] font-semibold uppercase tracking-wide transition-colors ${
                  active ? 'text-[#0052CC]' : 'text-[#6B7280]'
                }`}
              >
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
