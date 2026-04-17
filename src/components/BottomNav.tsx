import { useLocation, useNavigate } from 'react-router-dom';
import { useLang } from '@/lib/langContext';
import { useCartStore } from '@/store/cartStore';
import { Home, ShoppingBag, ShoppingCart } from 'lucide-react';

export function BottomNav() {
  const location = useLocation();
  const navigate = useNavigate();
  const { t } = useLang();
  const itemCount = useCartStore(s => s.getItemCount());

  const items = [
    { label: t('accueil'), path: '/', icon: Home },
    { label: t('boutique'), path: '/products', icon: ShoppingBag },
  ];

  const isActive = (path: string) =>
    path === '/' ? location.pathname === '/' : location.pathname.startsWith(path);

  return (
    <div className="fixed bottom-5 left-1/2 -translate-x-1/2 z-[450] bg-white/90 dark:bg-zinc-900/90 backdrop-blur-xl rounded-full px-1.5 py-1.5 flex gap-1 border border-zinc-200/60 dark:border-zinc-700/60 shadow-lg shadow-black/10">
      {items.map((item) => {
        const Icon = item.icon;
        const active = isActive(item.path);
        return (
          <button
            key={item.path}
            onClick={() => navigate(item.path)}
            className={`flex items-center gap-1.5 text-[12px] px-4 py-2 rounded-full border-none cursor-pointer transition-all font-semibold ${
              active
                ? 'bg-[#1D2B4F] text-white'
                : 'bg-transparent text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300'
            }`}
          >
            <Icon className="w-3.5 h-3.5" />
            {item.label}
          </button>
        );
      })}
      <button
        onClick={() => navigate('/cart')}
        className={`relative flex items-center gap-1.5 text-[12px] px-4 py-2 rounded-full border-none cursor-pointer transition-all font-semibold ${
          isActive('/cart')
            ? 'bg-[#1D2B4F] text-white'
            : 'bg-transparent text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300'
        }`}
      >
        <ShoppingCart className="w-3.5 h-3.5" />
        {t('panier')}
        {itemCount > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] bg-red-500 rounded-full text-[10px] font-bold text-white flex items-center justify-center px-1">
            {itemCount > 99 ? '99+' : itemCount}
          </span>
        )}
      </button>
    </div>
  );
}
