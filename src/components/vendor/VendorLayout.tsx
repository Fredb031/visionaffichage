import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';
import { LayoutDashboard, FileText, Plus, Settings, LogOut, Menu, X } from 'lucide-react';
import { useState } from 'react';
import { useAuthStore } from '@/stores/authStore';

const NAV_ITEMS = [
  { to: '/vendor', label: 'Tableau de bord', icon: LayoutDashboard, end: true },
  { to: '/vendor/quotes', label: 'Mes soumissions', icon: FileText },
  { to: '/vendor/quotes/new', label: 'Nouvelle soumission', icon: Plus, highlight: true },
  { to: '/vendor/settings', label: 'Paramètres', icon: Settings },
];

export function VendorLayout() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const navigate = useNavigate();
  const user = useAuthStore(s => s.user);
  const signOut = useAuthStore(s => s.signOut);

  const handleLogout = () => {
    signOut();
    navigate('/');
  };

  const firstName = user?.name?.split(' ')[0] ?? 'Vendeur';

  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-900">
      <aside
        className={`fixed top-0 bottom-0 left-0 z-40 w-64 bg-white border-r border-zinc-200 flex flex-col transition-transform md:translate-x-0 ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="px-6 py-6 border-b border-zinc-100">
          <Link to="/vendor" className="font-extrabold text-lg tracking-tight flex items-center gap-2">
            <span className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#E8A838] to-[#B37D10] text-white flex items-center justify-center text-xs">V</span>
            Espace vendeur
          </Link>
          <div className="text-[11px] text-zinc-500 mt-1">Vision Affichage</div>
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
                className={({ isActive }) => {
                  const base = 'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-semibold mb-0.5 transition-colors';
                  if (item.highlight) {
                    return `${base} bg-[#0052CC] text-white hover:bg-[#0052CC]/90`;
                  }
                  return `${base} ${
                    isActive ? 'bg-[#0052CC]/8 text-[#0052CC]' : 'text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900'
                  }`;
                }}
              >
                <Icon size={17} strokeWidth={1.8} />
                {item.label}
              </NavLink>
            );
          })}
        </nav>

        <div className="px-3 py-4 border-t border-zinc-100 space-y-1">
          <Link to="/" className="flex items-center gap-3 px-3 py-2 rounded-lg text-xs text-zinc-500 hover:bg-zinc-50 hover:text-zinc-900 transition-colors">
            Retour au site
          </Link>
          <button
            type="button"
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900 transition-colors bg-transparent border-none cursor-pointer text-left"
          >
            <LogOut size={17} strokeWidth={1.8} />
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
          <div className="text-sm text-zinc-500 hidden md:block font-semibold">Bonjour, {firstName}</div>
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[#E8A838] to-[#B37D10] text-white flex items-center justify-center text-sm font-bold">
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
          className="fixed inset-0 bg-black/40 z-30 md:hidden border-none"
          onClick={() => setMobileOpen(false)}
          aria-label="Close sidebar"
        />
      )}
    </div>
  );
}
