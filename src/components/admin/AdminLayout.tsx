import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { LayoutDashboard, ShoppingBag, Package, Users, FileText, Settings, LogOut, Menu, X } from 'lucide-react';
import { useState } from 'react';
import { useAuthStore } from '@/stores/authStore';

const NAV_ITEMS = [
  { to: '/admin', label: 'Tableau de bord', icon: LayoutDashboard, end: true },
  { to: '/admin/orders', label: 'Commandes', icon: ShoppingBag },
  { to: '/admin/products', label: 'Produits', icon: Package },
  { to: '/admin/quotes', label: 'Soumissions', icon: FileText },
  { to: '/admin/vendors', label: 'Vendeurs', icon: Users },
  { to: '/admin/settings', label: 'Paramètres', icon: Settings },
];

export function AdminLayout() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const user = useAuthStore(s => s.user);
  const signOut = useAuthStore(s => s.signOut);

  const handleLogout = () => {
    signOut();
    navigate('/');
  };

  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-900">
      <aside
        className={`fixed top-0 bottom-0 left-0 z-40 w-64 bg-[#0F2341] text-white flex flex-col transition-transform md:translate-x-0 ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="px-6 py-6 border-b border-white/10">
          <Link to="/admin" className="text-white font-extrabold text-lg tracking-tight flex items-center gap-2">
            <span className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#0052CC] to-[#1B3A6B] flex items-center justify-center text-xs">VA</span>
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
                  `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium mb-0.5 transition-colors ${
                    isActive
                      ? 'bg-white/10 text-white'
                      : 'text-white/70 hover:bg-white/5 hover:text-white'
                  }`
                }
              >
                <Icon size={18} strokeWidth={1.8} />
                {item.label}
              </NavLink>
            );
          })}
        </nav>

        <div className="px-3 py-4 border-t border-white/10 space-y-1">
          <Link
            to="/"
            className="flex items-center gap-3 px-3 py-2 rounded-lg text-xs text-white/60 hover:bg-white/5 hover:text-white transition-colors"
          >
            Retour au site
          </Link>
          <button
            type="button"
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-white/80 hover:bg-white/10 hover:text-white transition-colors bg-transparent border-none cursor-pointer text-left"
          >
            <LogOut size={18} strokeWidth={1.8} />
            Déconnexion
          </button>
        </div>
      </aside>

      <div className="md:pl-64">
        <header className="sticky top-0 z-30 bg-white/90 backdrop-blur-md border-b border-zinc-200 px-4 md:px-8 py-3 flex items-center justify-between">
          <button
            type="button"
            onClick={() => setMobileOpen(o => !o)}
            className="md:hidden w-10 h-10 rounded-lg hover:bg-zinc-100 flex items-center justify-center"
            aria-label="Toggle sidebar"
          >
            {mobileOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
          <div className="text-sm text-zinc-500 hidden md:block">
            {location.pathname === '/admin' ? 'Vue d\'ensemble' : 'Administration'}
          </div>
          <div className="flex items-center gap-3">
            <div className="text-right hidden md:block">
              <div className="text-[13px] font-bold leading-tight">{user?.name ?? 'Admin'}</div>
              <div className="text-[10px] text-zinc-500 leading-tight uppercase tracking-wider">{user?.role}</div>
            </div>
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[#0052CC] to-[#1B3A6B] text-white flex items-center justify-center text-sm font-bold">
              {user?.initials ?? '?'}
            </div>
          </div>
        </header>

        <main className="p-4 md:p-8 max-w-[1400px]">
          <Outlet />
        </main>
      </div>

      {mobileOpen && (
        <button
          type="button"
          className="fixed inset-0 bg-black/40 z-30 md:hidden"
          onClick={() => setMobileOpen(false)}
          aria-label="Close sidebar"
        />
      )}
    </div>
  );
}
