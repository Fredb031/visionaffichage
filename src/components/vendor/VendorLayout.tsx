import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { LayoutDashboard, FileText, Plus, Settings, LogOut, Menu, X, FilePlus } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { useAuthStore, type UserRole } from '@/stores/authStore';
import { useEscapeKey } from '@/hooks/useEscapeKey';
import { useBodyScrollLock } from '@/hooks/useBodyScrollLock';

// Human-readable French label for each UserRole so the sidebar/top bar can
// surface "Jean Dupont · Vendeur" instead of the raw enum. Falls back to the
// profile `title` when present (e.g. "Président"), then to a sensible
// default, so unknown roles never render as empty strings.
const ROLE_LABEL: Record<UserRole, string> = {
  president: 'Président',
  admin: 'Administrateur',
  salesman: 'Représentant',
  vendor: 'Vendeur',
  client: 'Client',
};

const NAV_ITEMS = [
  { to: '/vendor', label: 'Tableau de bord', icon: LayoutDashboard, end: true },
  { to: '/vendor/quotes', label: 'Mes soumissions', icon: FileText },
  { to: '/vendor/quotes/new', label: 'Nouvelle soumission', icon: Plus, highlight: true },
  { to: '/vendor/settings', label: 'Paramètres', icon: Settings },
];

export function VendorLayout() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const user = useAuthStore(s => s.user);
  const signOut = useAuthStore(s => s.signOut);

  // Match AdminLayout's keyboard support: Escape + auto-close on route.
  useEffect(() => { setMobileOpen(false); }, [location.pathname]);
  useEscapeKey(mobileOpen, useCallback(() => setMobileOpen(false), []));
  // Match AdminLayout: lock body scroll while the slide-in menu is up so
  // iOS momentum scroll doesn't drag the page behind the backdrop.
  useBodyScrollLock(mobileOpen);

  const handleLogout = async () => {
    // Await so the async in-memory store clears (cart/customizer reset
    // via dynamic imports inside authStore.signOut) finish BEFORE we
    // navigate. Mirrors the Navbar fix — without it, the home page
    // briefly rendered with the ex-vendor's cart badge still populated.
    await signOut();
    navigate('/');
  };

  const firstName = user?.name?.trim().split(/\s+/)[0] || 'Vendeur';
  const roleLabel = user?.title ?? (user?.role ? ROLE_LABEL[user.role] : 'Vendeur');

  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-900">
      {/* Skip link for keyboard users — invisible until focused, then pins to
          the top-left so Tab as the first action jumps past the sidebar
          straight into the main region. `#main-content` is the <main> id
          below, which is already `tabIndex={-1}` so focus lands cleanly. */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:px-4 focus:py-2 focus:rounded-lg focus:bg-[#0052CC] focus:text-white focus:font-semibold focus:shadow-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-[#0052CC]"
      >
        Aller au contenu principal
      </a>
      <aside
        id="vendor-sidebar"
        className={`fixed top-0 bottom-0 left-0 z-40 w-64 bg-white border-r border-zinc-200 flex flex-col transition-transform md:translate-x-0 ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
        aria-label="Navigation vendeur"
      >
        <div className="px-6 py-6 border-b border-zinc-100">
          <Link
            to="/vendor"
            aria-label="Vision Affichage — Espace vendeur"
            className="font-extrabold text-lg tracking-tight flex items-center gap-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0052CC] focus-visible:ring-offset-1 rounded"
          >
            <span className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#E8A838] to-[#B37D10] text-white flex items-center justify-center text-xs" aria-hidden="true">V</span>
            Espace vendeur
          </Link>
          <div className="text-[11px] text-zinc-500 mt-1">Vision Affichage</div>
        </div>

        <nav className="flex-1 px-3 py-5 overflow-y-auto">
          {NAV_ITEMS.map(item => {
            const Icon = item.icon;
            // Mirror NavLink's `end` matching so we can set aria-current on
            // the <a> itself — NavLink v6 only auto-applies aria-current when
            // nothing is overridden, and we want it explicit alongside the
            // stronger sighted-user treatment (bold + left border).
            const isActive = item.end
              ? location.pathname === item.to
              : location.pathname === item.to || location.pathname.startsWith(`${item.to}/`);
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                onClick={() => setMobileOpen(false)}
                aria-current={isActive && !item.highlight ? 'page' : undefined}
                className={({ isActive: navActive }) => {
                  const base = 'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-semibold mb-0.5 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0052CC] focus-visible:ring-offset-1';
                  if (item.highlight) {
                    return `${base} bg-[#0052CC] text-white hover:bg-[#0052CC]/90`;
                  }
                  return `${base} ${
                    navActive
                      ? 'bg-[#0052CC]/8 text-[#0052CC] font-bold border-l-4 border-[#0052CC] pl-2'
                      : 'text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900'
                  }`;
                }}
              >
                <Icon size={17} strokeWidth={1.8} aria-hidden="true" />
                {item.label}
              </NavLink>
            );
          })}
        </nav>

        <div className="px-3 py-4 border-t border-zinc-100 space-y-1">
          {/* Logged-in vendor profile strip — name + role label pulled from
              the auth store. Kept compact so it reads like a signature at
              the bottom of the sidebar rather than a second nav block. */}
          {user && (
            <div className="px-3 py-2 mb-1 flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#E8A838] to-[#B37D10] text-white flex items-center justify-center text-xs font-bold flex-shrink-0" aria-hidden="true">
                {user.initials || '?'}
              </div>
              <div className="min-w-0">
                <div className="text-sm font-semibold text-zinc-900 truncate">{user.name}</div>
                <div className="text-[11px] text-zinc-500 truncate">{roleLabel}</div>
              </div>
            </div>
          )}
          <Link
            to="/"
            className="flex items-center gap-3 px-3 py-2 rounded-lg text-xs text-zinc-500 hover:bg-zinc-50 hover:text-zinc-900 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0052CC] focus-visible:ring-offset-1"
          >
            Retour au site
          </Link>
          <button
            type="button"
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900 transition-colors bg-transparent border-none cursor-pointer text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0052CC] focus-visible:ring-offset-1"
          >
            <LogOut size={17} strokeWidth={1.8} aria-hidden="true" />
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
            aria-controls="vendor-sidebar"
          >
            {mobileOpen ? <X size={20} aria-hidden="true" /> : <Menu size={20} aria-hidden="true" />}
          </button>
          <div className="text-sm text-zinc-500 hidden md:block font-semibold">Bonjour, {firstName}</div>
          <div className="flex items-center gap-3">
            {/* Primary quick-CTA: pinned to the top bar so a vendor can
                start a new quote from any page in one click. Route target
                matches the existing sidebar "Nouvelle soumission" entry so
                this is purely an accelerator, not a new surface. */}
            <Link
              to="/vendor/quotes/new"
              className="hidden sm:inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-[#0052CC] text-white text-sm font-semibold hover:bg-[#0052CC]/90 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0052CC] focus-visible:ring-offset-2"
            >
              <FilePlus size={16} strokeWidth={2} aria-hidden="true" />
              Nouveau devis
            </Link>
            {/* Mobile-only icon version so the CTA stays one-tap reachable
                but doesn't shove the avatar off-screen on narrow phones. */}
            <Link
              to="/vendor/quotes/new"
              aria-label="Nouveau devis"
              className="sm:hidden inline-flex items-center justify-center w-10 h-10 rounded-lg bg-[#0052CC] text-white hover:bg-[#0052CC]/90 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0052CC] focus-visible:ring-offset-2"
            >
              <FilePlus size={18} strokeWidth={2} aria-hidden="true" />
            </Link>
            <div
              className="w-9 h-9 rounded-full bg-gradient-to-br from-[#E8A838] to-[#B37D10] text-white flex items-center justify-center text-sm font-bold"
              aria-label={user ? `${user.name} — ${roleLabel}` : undefined}
              title={user ? `${user.name} — ${roleLabel}` : undefined}
            >
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
          className="fixed inset-0 bg-black/40 z-30 md:hidden border-none"
          onClick={() => setMobileOpen(false)}
          aria-label="Fermer le menu latéral"
        />
      )}
    </div>
  );
}
