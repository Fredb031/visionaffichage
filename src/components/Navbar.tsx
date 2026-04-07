import { Link } from 'react-router-dom';
import { useCartStore } from '@/stores/cartStore';

interface NavbarProps {
  onOpenCart?: () => void;
}

export function Navbar({ onOpenCart }: NavbarProps) {
  const totalItems = useCartStore(state => state.items.reduce((sum, item) => sum + item.quantity, 0));

  return (
    <nav className="fixed top-0 left-0 right-0 z-[400] h-[58px] flex items-center justify-between px-6 md:px-10 bg-background/[0.93] backdrop-blur-xl border-b border-border">
      <Link to="/">
        <img
          src="https://visionaffichage.com/cdn/shop/files/Asset_1_d5d82510-0b83-4657-91b7-3ac1992ee697.svg?height=90&v=1769614651"
          alt="Vision"
          className="h-6"
        />
      </Link>

      <div className="flex items-center gap-2.5">
        <button
          onClick={onOpenCart}
          className="flex items-center gap-[7px] text-[13px] text-muted-foreground bg-transparent border border-border px-4 py-[7px] rounded-full cursor-pointer transition-all hover:border-muted-foreground hover:text-foreground relative"
        >
          <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" viewBox="0 0 24 24">
            <path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4zM3 6h18M16 10a4 4 0 01-8 0"/>
          </svg>
          <span className="hidden sm:inline">Panier</span>
          {totalItems > 0 && (
            <span className="absolute -top-1 -right-1 w-4 h-4 bg-accent rounded-full text-[9px] font-extrabold text-accent-foreground flex items-center justify-center">
              {totalItems}
            </span>
          )}
        </button>
        <Link
          to="/products"
          className="text-[13px] font-bold text-primary-foreground gradient-navy-dark border-none px-[22px] py-[9px] rounded-full cursor-pointer transition-all hover:opacity-85 hover:-translate-y-px hidden sm:inline-block"
          style={{ boxShadow: '0 4px 16px hsla(var(--navy), 0.3)' }}
        >
          Voir les produits
        </Link>
      </div>
    </nav>
  );
}