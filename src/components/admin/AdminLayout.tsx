import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { LayoutDashboard, ShoppingBag, Package, Users, FileText, Settings, LogOut, Menu, X, Mail, Sparkles, UserCircle, ShoppingCart, BarChart3, KeyRound, ChevronLeft, ChevronRight } from 'lucide-react';
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

// Persist the desktop sidebar collapsed/expanded state across reloads.
// Wrapped in try/catch because localStorage can throw in private-mode
// Safari or when the storage quota is exhausted — we fall back to the
// default expanded state rather than crashing the whole admin shell.
const COLLAPSE_KEY = 'admin:sidebarCollapsed';

function readInitialCollapsed(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return window.localStorage.getItem(COLLAPSE_KEY) === '1';
  } catch {
    return false;
  }
}

export function AdminLayout() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [desktopCollapsed, setDesktopCollapsed] = useState<boolean>(readInitialCollapsed);
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

  // Persist collapsed state. Guarded so SSR / locked-down browsers
  // don't blow up when localStorage is unavailable.
  useEffect(() => {
    try {
      window.localStorage.setItem(COLLAPSE_KEY, desktopCollapsed ? '1' : '0');
    } catch {
      /* ignore */
    }
  }, [desktopCollapsed]);

  const handleLogout = async () => {
    // Await the async signOut so the dynamic-import chain finishes
    // clearing cart + customizer stores BEFORE we navigate home.
    // Mirrors the Navbar + VendorLayout fixes.
    await signOut();
    navigate('/');
  };

  // On mobile the sidebar is always shown full-width (w-64) when open,
  // so the collapse toggle only applies at md+ breakpoints. The mobile
  // overlay ignores desktopCollapsed.
  const sidebarWidthClass = desktopCollapsed ? 'w-64 md:w-16' : 'w-64';
  const mainPaddingClass = desktopCollapsed ? 'md:pl-16' : 'md:pl-64';

  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-900">
      <aside
        id="admin-sidebar"
        className={`fixed top-0 bottom-0 left-0 z-40 ${sidebarWidthClass} bg-[#0F2341] text-white flex flex-col transition-[transform,width] duration-200 md:translate-x-0 ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
        aria-label="Admin navigation"
      >
        <div className={`border-b border-white/10 ${desktopCollapsed ? 'px-6 md:px-3' : 'px-6'} py-6`}>
          <Link
            to="/admin"
            aria-label="Vision Affichage — Admin dashboard"
            className="text-white font-extrabold text-lg tracking-tight flex items-center gap-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#E8A838]/70 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0F2341] rounded"
          >
            <span className="w-8 h-8 shrink-0 rounded-lg bg-gradient-to-br from-[#0052CC] to-[#1B3A6B] flex items-center justify-center text-xs" aria-hidden="true">VA</span>
            <span className={desktopCollapsed ? 'md:hidden' : ''}>Admin</span>
          </Link>
          <div className={`text-[11px] text-white/50 mt-1 ${desktopCollapsed ? 'md:hidden' : ''}`}>Vision Affichage</div>
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
                title={desktopCollapsed ? item.label : undefined}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium mb-0.5 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#E8A838]/70 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0F2341] ${
                    desktopCollapsed ? 'md:justify-center' : ''
                  } ${
                    isActive
                      ? 'bg-white/10 text-white'
                      : 'text-white/70 hover:bg-white/5 hover:text-white'
                  }`
                }
              >
                <Icon size={18} strokeWidth={1.8} aria-hidden="true" className="shrink-0" />
                <span className={`flex-1 ${desktopCollapsed ? 'md:hidden' : ''}`}>{item.label}</span>
                {'badge' in item && item.badge === 'pendingFulfillment' && SHOPIFY_STATS.awaitingFulfillment > 0 && (
                  <span
                    className={`text-[10px] font-extrabold bg-[#E8A838] text-[#1B3A6B] px-1.5 py-0.5 rounded-full min-w-[20px] text-center ${desktopCollapsed ? 'md:hidden' : ''}`}
                    aria-label={`${SHOPIFY_STATS.awaitingFulfillment} commande${SHOPIFY_STATS.awaitingFulfillment > 1 ? 's' : ''} à expédier`}
                    aria-live="polite"
                    aria-atomic="true"
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
            title={desktopCollapsed ? 'Retour au site' : undefined}
            className={`flex items-center gap-3 px-3 py-2 rounded-lg text-xs text-white/60 hover:bg-white/5 hover:text-white transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#E8A838]/70 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0F2341] ${desktopCollapsed ? 'md:justify-center md:text-[10px]' : ''}`}
          >
            <span className={desktopCollapsed ? 'md:hidden' : ''}>Retour au site</span>
            <span className={desktopCollapsed ? 'hidden md:inline' : 'hidden'} aria-hidden="true">←</span>
          </Link>
          <button
            type="button"
            onClick={handleLogout}
            title={desktopCollapsed ? 'Déconnexion' : undefined}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-white/80 hover:bg-white/10 hover:text-white transition-colors bg-transparent border-none cursor-pointer text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-[#E8A838]/70 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0F2341] ${desktopCollapsed ? 'md:justify-center' : ''}`}
          >
            <LogOut size={18} strokeWidth={1.8} aria-hidden="true" className="shrink-0" />
            <span className={desktopCollapsed ? 'md:hidden' : ''}>Déconnexion</span>
          </button>
          {/* Desktop-only collapse/expand toggle. Hidden on mobile because
              the mobile sidebar is always full-width when visible. */}
          <button
            type="button"
            onClick={() => setDesktopCollapsed(c => !c)}
            aria-label={desktopCollapsed ? 'Déployer le menu latéral' : 'Réduire le menu latéral'}
            aria-expanded={!desktopCollapsed}
            aria-controls="admin-sidebar"
            title={desktopCollapsed ? 'Déployer' : 'Réduire'}
            className={`hidden md:flex w-full items-center gap-2 px-3 py-2 mt-1 rounded-lg text-xs text-white/60 hover:bg-white/5 hover:text-white transition-colors bg-transparent border-none cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[#E8A838]/70 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0F2341] ${desktopCollapsed ? 'justify-center' : 'justify-start'}`}
          >
            {desktopCollapsed ? (
              <ChevronRight size={16} strokeWidth={2} aria-hidden="true" className="shrink-0" />
            ) : (
              <ChevronLeft size={16} strokeWidth={2} aria-hidden="true" className="shrink-0" />
            )}
            <span className={desktopCollapsed ? 'hidden' : ''}>Réduire</span>
          </button>
        </div>
      </aside>

      <div className={`transition-[padding] duration-200 ${mainPaddingClass}`}>
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
