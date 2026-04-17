import { useLocation, useNavigate } from 'react-router-dom';
import { useLang } from '@/lib/langContext';
import { useCartStore } from '@/store/cartStore';
import { Home, Store, Palette, ShoppingCart } from 'lucide-react';

export function BottomNav() {
  const location = useLocation();
  const navigate = useNavigate();
  const { t } = useLang();
  const itemCount = useCartStore(s => s.getItemCount());

  const items = [
    { id: 'home',      label: t('accueil'),   path: '/',         icon: Home },
    { id: 'shop',      label: t('boutique'),   path: '/products', icon: Store },
    { id: 'customize', label: t('personnaliserProduit').split(' ')[0], path: '/products', icon: Palette },
    { id: 'cart',      label: t('panier'),     path: '/cart',     icon: ShoppingCart },
  ];

  const isActive = (path: string) =>
    path === '/' ? location.pathname === '/' : location.pathname.startsWith(path);

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-[450] bg-white border-t border-zinc-100 shadow-[0_-2px_12px_rgba(0,0,0,0.06)]"
      style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
      role="navigation"
      aria-label="Bottom navigation"
    >
      <div className="flex items-center justify-around h-[60px] max-w-md mx-auto">
        {items.map(item => {
          const Icon = item.icon;
          const active = item.id === 'cart' ? location.pathname === '/cart'
            : item.id === 'home' ? location.pathname === '/'
            : location.pathname.startsWith(item.path);
          return (
            <button
              key={item.id}
              onClick={() => navigate(item.path)}
              className="flex flex-col items-center justify-center gap-0.5 min-w-[60px] py-1 bg-transparent border-none cursor-pointer transition-colors"
              aria-current={active ? 'page' : undefined}
            >
              <span className="relative">
                <Icon
                  size={20}
                  strokeWidth={active ? 2.2 : 1.5}
                  className={`transition-colors ${active ? 'text-[#0052CC]' : 'text-zinc-400'}`}
                />
                {item.id === 'cart' && itemCount > 0 && (
                  <span className="absolute -top-1.5 -right-2 min-w-[16px] h-[16px] bg-[#0052CC] rounded-full text-[9px] font-bold text-white flex items-center justify-center px-0.5">
                    {itemCount > 99 ? '99+' : itemCount}
                  </span>
                )}
              </span>
              <span className={`text-[10px] font-semibold transition-colors ${active ? 'text-[#0052CC]' : 'text-zinc-400'}`}>
                {item.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
