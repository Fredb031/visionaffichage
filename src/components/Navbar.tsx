import { Link, useLocation } from 'react-router-dom';
import { ShoppingCart } from 'lucide-react';
import { useCartStore } from '@/stores/cartStore';
import { useState } from 'react';

interface NavbarProps {
  onOpenCart?: () => void;
}

export function Navbar({ onOpenCart }: NavbarProps) {
  const totalItems = useCartStore(state => state.items.reduce((sum, item) => sum + item.quantity, 0));
  const location = useLocation();

  return (
    <nav className="fixed top-0 left-0 right-0 z-[400] h-[60px] flex items-center justify-between px-6 md:px-10 bg-background/94 backdrop-blur-xl border-b border-border">
      <Link to="/" className="flex items-center">
        <span className="text-lg font-extrabold tracking-tight text-foreground">VISION</span>
      </Link>

      <div className="hidden md:flex items-center gap-8">
        <Link
          to="/"
          className={`text-[13px] transition-colors ${location.pathname === '/' ? 'text-foreground font-semibold' : 'text-muted-foreground hover:text-foreground'}`}
        >
          Accueil
        </Link>
        <Link
          to="/products"
          className={`text-[13px] transition-colors ${location.pathname === '/products' ? 'text-foreground font-semibold' : 'text-muted-foreground hover:text-foreground'}`}
        >
          Boutique
        </Link>
      </div>

      <div className="flex items-center gap-2.5">
        <button
          onClick={onOpenCart}
          className="flex items-center gap-1.5 text-[13px] text-muted-foreground bg-transparent border border-border px-4 py-[7px] rounded-full cursor-pointer transition-all hover:border-muted-foreground hover:text-foreground relative"
        >
          <ShoppingCart className="h-4 w-4" />
          <span className="hidden sm:inline">Panier</span>
          {totalItems > 0 && (
            <span className="absolute -top-1 -right-1 w-[17px] h-[17px] bg-accent rounded-full text-[9px] font-extrabold text-accent-foreground flex items-center justify-center">
              {totalItems}
            </span>
          )}
        </button>
        <Link
          to="/products"
          className="text-[13px] font-bold text-primary-foreground gradient-navy border-none px-5 py-[9px] rounded-full cursor-pointer transition-opacity hover:opacity-85 shadow-navy hidden sm:inline-block"
        >
          Voir les produits
        </Link>
      </div>
    </nav>
  );
}
