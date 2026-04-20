import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { LayoutDashboard, ShoppingBag, Package, Users, FileText, Settings, LogOut, Menu, X, Mail, Sparkles, UserCircle, ShoppingCart, BarChart3, KeyRound } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { useAuthStore } from '@/stores/authStore';
import { SHOPIFY_STATS } from '@/data/shopifySnapshot';
import { useEscapeKey } from '@/hooks/useEscapeKey';
import { useBodyScrollLock } from '@/hooks/useBodyScrollLock';

const NAV_ITEMS = [
  { to: '/admin', label: 'Tableau de bord', icon: LayoutDashboard, end: true },
  { to: '/admin/analytics', label: 'Analytique', icon: BarChart3 },
  { to: '/admin/orders', label: 'Commandes', icon: ShoppingBag, badge: 'pendingFulfillment' as const },
  { to: '/admin/abandoned-carts', label: 'Paniers abandonnés', icon: ShoppingCart },
  { to: '/admin/products', label: 'Produits', icon: Package },
  { to: '/admin/customers', label: 'Clients', icon: UserCircle },
  { to: '/admin/quotes', label: 'Soumissions', icon: FileText },
  { to: '/admin/vendors', label: 'Vendeurs', icon: Users },
  { to: '/admin/users', label: 'Comptes & accès', icon: KeyRound },
  { to: '/admin/emails', label: 'Courriels', icon: Mail },
  { to: '/admin/images', label: 'Génération d\'images', icon: Sparkles },
  { to: '/admin/settings', label: 'Paramètres', icon: Settings },
];

export function AdminLayout() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const user = useAuthStore(s => s.user);
  const signOut = useAuthStore(s => s.signOut);

  // Close the mobile sidebar when the route changes (user clicked a
  // link) and when Escape is pressed, so keyboard users can dismiss
  // the overlay without hunting for the close button.
  useEffect(() => { setMobileOpen(false); }, [location.pathname]);
  useEscapeKey(mobileOpen, useCallback(() => setMobileOpen(false), []));
  // Lock body scroll while the mobile sidebar is open. Without this,
  // momentum scroll on iOS leaks through the backdrop and the page
  // behind keeps moving while the menu sits frozen on top.
  useBodyScrollLock(mobileOpen);

  const handleLogout = async () => {
    // Await the async signOut so the dynamic-import chain finishes
    // clearing cart + customizer stores BEFORE we navigate home.
    // Mirrors the Navbar + VendorLayout fixes.
    await signOut();
    navigate('/');
  };

  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-900">
      <aside
        id="admin-sidebar"
        className={`fixed top-0 bottom-0 left-0 z-40 w-64 bg-[#0F2341] text-white flex flex-col transition-transform md:translate-x-0 ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
        aria-label="Admin navigation"
      >
        <div className="px-6 py-6 border-b border-white/10">
          <Link
            to="/admin"
            aria-label="Vision Affichage — Admin dashboard"
            className="text-white font-extrabold text-lg tracking-tight flex items-center gap-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#E8A838]/70 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0F2341] rounded"
          >
            <span className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#0052CC] to-[#1B3A6B] flex items-center justify-center text-xs" aria-hidden="true">VA</span>
            Admin
          </Link>
          <div className="text-[11px] text-white/50 mt-1">Vision Affichage</div>
        </div>

        <nav className="flex-1 px-3 py-5 overflow-y-auto">
          {NAV_ITEMS.map(item => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                onClick={() => setMobileOpen(false)}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium mb-0.5 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#E8A838]/70 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0F2341] ${
                    isActive
                      ? 'bg-white/10 text-white'
                      : 'text-white/70 hover:bg-white/5 hover:text-white'
                  }`
                }
              >
                <Icon size={18} strokeWidth={1.8} aria-hidden="true" />
                <span className="flex-1">{item.label}</span>
                {'badge' in item && item.badge === 'pendingFulfillment' && SHOPIFY_STATS.awaitingFulfillment > 0 && (
                  <span
                    className="text-[10px] font-extrabold bg-[#E8A838] text-[#1B3A6B] px-1.5 py-0.5 rounded-full min-w-[20px] text-center"
                    aria-label={`${SHOPIFY_STATS.awaitingFulfillment} commande${SHOPIFY_STATS.awaitingFulfillment > 1 ? 's' : ''} à expédier`}
                  >
                    {SHOPIFY_STATS.awaitingFulfillment}
                  </span>
                )}
              </NavLink>
            );
          })}
        </nav>

        <div className="px-3 py-4 border-t border-white/10 space-y-1">
          <Link
            to="/"
            className="flex items-center gap-3 px-3 py-2 rounded-lg text-xs text-white/60 hover:bg-white/5 hover:text-white transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#E8A838]/70 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0F2341]"
          >
            Retour au site
          </Link>
          <button
            type="button"
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-white/80 hover:bg-white/10 hover:text-white transition-colors bg-transparent border-none cursor-pointer text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-[#E8A838]/70 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0F2341]"
          >
            <LogOut size={18} strokeWidth={1.8} aria-hidden="true" />
            Déconnexion
          </button>
        </div>
      </aside>

      <div className="md:pl-64">
        <header className="sticky top-0 z-30 bg-white/90 backdrop-blur-md border-b border-zinc-200 px-4 md:px-8 py-3 flex items-center justify-between">
          <button
            type="button"
            onClick={() => setMobileOpen(o => !o)}
            className="md:hidden w-10 h-10 rounded-lg hover:bg-zinc-100 flex items-center justify-center focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0052CC] focus-visible:ring-offset-1 transition-colors"
            aria-label={mobileOpen ? 'Fermer le menu latéral' : 'Ouvrir le menu latéral'}
            aria-expanded={mobileOpen}
            aria-controls="admin-sidebar"
          >
            {mobileOpen ? <X size={20} aria-hidden="true" /> : <Menu size={20} aria-hidden="true" />}
          </button>
          <div className="text-sm text-zinc-500 hidden md:block">
            {location.pathname === '/admin' ? 'Vue d\'ensemble' : 'Administration'}
          </div>
          <div className="flex items-center gap-3">
            <div className="text-right hidden md:block">
              <div className="text-[13px] font-bold leading-tight flex items-center justify-end gap-1">
                {user?.role === 'president' && (
                  <span role="img" aria-label="Président" title="Président">👑</span>
                )}
                {user?.name ?? 'Admin'}
              </div>
              <div className="text-[10px] text-zinc-500 leading-tight uppercase tracking-wider">
                {user?.title ?? user?.role}
              </div>
            </div>
            <div className={`w-9 h-9 rounded-full text-white flex items-center justify-center text-sm font-bold ${
              user?.role === 'president'
                ? 'bg-gradient-to-br from-[#E8A838] to-[#B37D10] ring-2 ring-[#E8A838]/30'
                : 'bg-gradient-to-br from-[#0052CC] to-[#1B3A6B]'
            }`}>
              {user?.initials ?? '?'}
            </div>
          </div>
        </header>

        <main id="main-content" tabIndex={-1} className="p-4 md:p-8 max-w-[1400px] focus:outline-none">
          <Outlet />
        </main>
      </div>

      {mobileOpen && (
        <button
          type="button"
          className="fixed inset-0 bg-black/40 z-30 md:hidden"
          onClick={() => setMobileOpen(false)}
          aria-label="Fermer le menu latéral"
        />
      )}
    </div>
  );
}
