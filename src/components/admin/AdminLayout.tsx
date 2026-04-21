import { Link, NavLink, Navigate, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { LayoutDashboard, ShoppingBag, Package, Users, FileText, Settings, LogOut, Menu, X, Mail, Sparkles, UserCircle, ShoppingCart, BarChart3, KeyRound, ChevronLeft, ChevronRight, Bell, CreditCard, Zap, Lock, Keyboard } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuthStore } from '@/stores/authStore';
import { SHOPIFY_STATS } from '@/data/shopifySnapshot';
import { useEscapeKey } from '@/hooks/useEscapeKey';
import { useFocusTrap } from '@/hooks/useFocusTrap';
import { useBodyScrollLock } from '@/hooks/useBodyScrollLock';
import { CommandPalette } from './CommandPalette';

// Categorised shortcut reference rendered inside the cheatsheet modal.
// Kept co-located with AdminLayout because the shell is the single
// source of truth for every global hotkey it binds (Cmd+K, ?). A later
// extraction into its own component would only fire if a second surface
// needed the same list; until then this lives here so the docs and the
// behaviour stay in lockstep.
type ShortcutRow = { keys: string[]; label: string };
type ShortcutGroup = { title: string; rows: ShortcutRow[] };

const SHORTCUT_GROUPS: ShortcutGroup[] = [
  {
    title: 'Navigation',
    rows: [
      { keys: ['Cmd/Ctrl', 'K'], label: 'Ouvrir la palette de commandes' },
      { keys: ['?'], label: 'Afficher cet aide-mémoire' },
      { keys: ['Esc'], label: 'Fermer la fenêtre / le menu actif' },
    ],
  },
  {
    title: 'Commandes',
    rows: [
      { keys: ['Click'], label: 'Cocher une commande (actions groupées)' },
      { keys: ['Shift', 'Click'], label: 'Sélectionner une plage de commandes' },
    ],
  },
  {
    title: 'Personnalisateur',
    rows: [
      { keys: ['←', '↑', '→', '↓'], label: 'Déplacer l\'élément sélectionné (1 px)' },
      { keys: ['Shift', '←/↑/→/↓'], label: 'Déplacer par pas de 5 px' },
      { keys: ['Cmd/Ctrl', '←/↑/→/↓'], label: 'Déplacer par pas de 10 px' },
      { keys: ['Delete'], label: 'Supprimer l\'élément sélectionné' },
      { keys: ['Backspace'], label: 'Supprimer l\'élément sélectionné' },
    ],
  },
  {
    title: 'Général',
    rows: [
      { keys: ['Enter'], label: 'Confirmer / valider' },
      { keys: ['Esc'], label: 'Annuler' },
      { keys: ['Tab'], label: 'Focus suivant' },
      { keys: ['Shift', 'Tab'], label: 'Focus précédent' },
    ],
  },
];

type ShortcutsDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

// Discoverable keyboard shortcut reference. Pressing "?" anywhere in
// /admin/* opens this; Esc, backdrop click, and the corner close button
// all dismiss. Chrome matches CommandPalette: white rounded card with a
// navy (#0F2341) header strip so the docs modal reads as part of the
// same admin surface. Focus is trapped so Tab can't leak to the dimmed
// page underneath.
function ShortcutsDialog({ open, onOpenChange }: ShortcutsDialogProps) {
  const close = useCallback(() => onOpenChange(false), [onOpenChange]);
  const trapRef = useFocusTrap<HTMLDivElement>(open);
  useEscapeKey(open, close);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-start justify-center pt-[10vh] px-4"
      role="presentation"
    >
      <button
        type="button"
        aria-label="Fermer l'aide-mémoire des raccourcis"
        className="absolute inset-0 bg-black/40"
        onClick={close}
      />
      <div
        ref={trapRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="admin-shortcuts-title"
        tabIndex={-1}
        className="relative w-full max-w-2xl bg-white rounded-xl shadow-2xl border border-zinc-200 overflow-hidden max-h-[80vh] flex flex-col"
      >
        {/* Brand-navy header strip to match CommandPalette / notifications. */}
        <div className="px-5 py-4 bg-[#0F2341] text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <Keyboard size={18} aria-hidden="true" />
            <h2 id="admin-shortcuts-title" className="text-sm font-bold">
              Raccourcis clavier
            </h2>
          </div>
          <div className="flex items-center gap-3">
            <kbd className="hidden sm:inline-block text-[10px] font-semibold text-white/80 bg-white/10 border border-white/20 rounded px-1.5 py-0.5">
              Esc
            </kbd>
            <button
              type="button"
              onClick={close}
              aria-label="Fermer"
              className="w-7 h-7 rounded-md hover:bg-white/10 flex items-center justify-center focus:outline-none focus-visible:ring-2 focus-visible:ring-[#E8A838]/70 transition-colors"
            >
              <X size={16} aria-hidden="true" />
            </button>
          </div>
        </div>
        <div className="overflow-y-auto px-5 py-4 space-y-5">
          {SHORTCUT_GROUPS.map(group => (
            <section key={group.title} aria-labelledby={`shortcut-group-${group.title}`}>
              <h3
                id={`shortcut-group-${group.title}`}
                className="text-[11px] font-extrabold uppercase tracking-wider text-[#0052CC] mb-2"
              >
                {group.title}
              </h3>
              {/* Two-column layout: keys on the left, description on the
                  right. grid-cols-[auto,1fr] keeps the keys column flush
                  to its content so all rows line up regardless of key
                  count per row. */}
              <ul className="grid grid-cols-[auto,1fr] gap-x-5 gap-y-2">
                {group.rows.map((row, idx) => (
                  <li
                    key={`${group.title}-${idx}`}
                    className="contents text-sm"
                  >
                    <span className="flex flex-wrap items-center gap-1">
                      {row.keys.map((k, i) => (
                        <span key={`${k}-${i}`} className="flex items-center gap-1">
                          {i > 0 && <span className="text-zinc-400 text-[11px]">+</span>}
                          <kbd className="inline-block min-w-[22px] text-center text-[11px] font-semibold text-zinc-700 bg-zinc-100 border border-zinc-300 rounded px-1.5 py-0.5 shadow-[0_1px_0_rgba(0,0,0,0.06)]">
                            {k}
                          </kbd>
                        </span>
                      ))}
                    </span>
                    <span className="text-sm text-zinc-700 self-center">{row.label}</span>
                  </li>
                ))}
              </ul>
            </section>
          ))}
          <p className="text-[11px] text-zinc-500 pt-2 border-t border-zinc-100">
            Astuce : appuyez sur <kbd className="text-[10px] font-semibold text-zinc-700 bg-zinc-100 border border-zinc-300 rounded px-1 py-0.5">?</kbd> depuis n'importe quelle page admin pour rouvrir cette fenêtre.
          </p>
        </div>
      </div>
    </div>
  );
}

// Role-gating for the admin sidebar. Each nav entry declares the roles
// allowed to see it; the sidebar filters itself by the current user's
// role. 'president' always has implicit access (see hasAccess below) so
// we don't have to list it on every row. 'salesman' is forward-looking
// — authStore UserRole doesn't include it yet, but the moment the role
// lands the UI Just Works.
type NavRole = 'president' | 'admin' | 'salesman';

const NAV_ITEMS: Array<{
  to: string;
  label: string;
  icon: typeof LayoutDashboard;
  end?: boolean;
  badge?: 'pendingFulfillment';
  roles: NavRole[];
}> = [
  { to: '/admin', label: 'Tableau de bord', icon: LayoutDashboard, end: true, roles: ['admin', 'salesman', 'president'] },
  { to: '/admin/analytics', label: 'Analytique', icon: BarChart3, roles: ['admin', 'president'] },
  { to: '/admin/orders', label: 'Commandes', icon: ShoppingBag, badge: 'pendingFulfillment', roles: ['admin', 'salesman', 'president'] },
  { to: '/admin/abandoned-carts', label: 'Paniers abandonnés', icon: ShoppingCart, roles: ['admin', 'salesman', 'president'] },
  { to: '/admin/products', label: 'Produits', icon: Package, roles: ['admin', 'president'] },
  { to: '/admin/customers', label: 'Clients', icon: UserCircle, roles: ['admin', 'salesman', 'president'] },
  { to: '/admin/quotes', label: 'Soumissions', icon: FileText, roles: ['admin', 'salesman', 'president'] },
  { to: '/admin/vendors', label: 'Vendeurs', icon: Users, roles: ['admin', 'president'] },
  { to: '/admin/users', label: 'Comptes & accès', icon: KeyRound, roles: ['admin', 'president'] },
  { to: '/admin/emails', label: 'Courriels', icon: Mail, roles: ['admin', 'president'] },
  { to: '/admin/automations', label: 'Automatisations', icon: Zap, roles: ['admin', 'president'] },
  { to: '/admin/images', label: 'Génération d\'images', icon: Sparkles, roles: ['admin', 'president'] },
  { to: '/admin/settings', label: 'Paramètres', icon: Settings, roles: ['admin', 'president'] },
];

// Minimal inline role check. 'president' is an implicit superuser so the
// role arrays above stay readable — we don't want every row to carry
// 'president' when it always applies. Any user whose role isn't in the
// allow list (including 'client'/'vendor' if they somehow reach the
// admin shell) is denied. Kept inline so a later src/lib/permissions.ts
// can replace this without touching the nav table itself.
function hasAccess(userRole: string | undefined, allowed: NavRole[]): boolean {
  if (!userRole) return false;
  if (userRole === 'president') return true;
  return (allowed as string[]).includes(userRole);
}

// Find the nav entry that matches the current URL. Uses startsWith so
// deep links like /admin/orders/123 still resolve to the Orders entry.
// The root /admin is matched exactly to avoid every path claiming the
// dashboard row.
function matchNavItem(pathname: string) {
  // Prefer the longest matching `to` so /admin/quotes/new resolves to
  // /admin/quotes and not to the /admin root.
  let best: typeof NAV_ITEMS[number] | undefined;
  for (const item of NAV_ITEMS) {
    if (item.end ? pathname === item.to : pathname === item.to || pathname.startsWith(item.to + '/')) {
      if (!best || item.to.length > best.to.length) best = item;
    }
  }
  return best;
}

// Persist the desktop sidebar collapsed/expanded state across reloads.
// Wrapped in try/catch because localStorage can throw in private-mode
// Safari or when the storage quota is exhausted — we fall back to the
// default expanded state rather than crashing the whole admin shell.
const COLLAPSE_KEY = 'admin:sidebarCollapsed';
// Persists the moment the user last clicked "Mark all as read" on the
// notifications dropdown. We compare every notification's "as-of" time
// against this timestamp: older ones get greyed out, newer ones stay
// fully opaque. Stored as ms-since-epoch in a string for portability.
const NOTIFS_READ_UNTIL_KEY = 'vision-admin-notifs-read-until';

function readInitialCollapsed(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return window.localStorage.getItem(COLLAPSE_KEY) === '1';
  } catch {
    return false;
  }
}

// Read the stored mark-all-read timestamp. Returns 0 when nothing has
// been marked read yet, or if storage throws. 0 < any positive
// timestamp means "everything is treated as unread" by default, which
// is the correct initial state for a brand new admin.
function readNotifsReadUntil(): number {
  if (typeof window === 'undefined') return 0;
  try {
    const raw = window.localStorage.getItem(NOTIFS_READ_UNTIL_KEY);
    if (!raw) return 0;
    const n = Number.parseInt(raw, 10);
    return Number.isFinite(n) ? n : 0;
  } catch {
    return 0;
  }
}

export function AdminLayout() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [desktopCollapsed, setDesktopCollapsed] = useState<boolean>(readInitialCollapsed);
  const [notifOpen, setNotifOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [notifsReadUntil, setNotifsReadUntil] = useState<number>(() => readNotifsReadUntil());
  const notifContainerRef = useRef<HTMLDivElement | null>(null);
  const location = useLocation();
  const navigate = useNavigate();
  const user = useAuthStore(s => s.user);
  const signOut = useAuthStore(s => s.signOut);

  // Aggregate notification counts from the Shopify snapshot. Pending
  // orders = financialStatus==='pending' (awaiting capture), abandoned
  // carts = total abandoned checkouts, failed payments = orders that
  // were authorized/voided (never captured successfully). The "total"
  // drives the badge-dot visibility in the header bell.
  const pendingOrdersCount = SHOPIFY_STATS.pendingPayments;
  const abandonedCartsCount = SHOPIFY_STATS.abandonedCheckoutsCount;
  const failedPaymentsCount = 0;
  const totalNotifications = pendingOrdersCount + abandonedCartsCount + failedPaymentsCount;
  const hasUnread = totalNotifications > 0;
  // All notifications in this snapshot share a single "as-of" date —
  // the moment the Shopify snapshot was refreshed (see
  // src/data/shopifySnapshot.ts). When the admin clicks mark-all-read
  // we stamp Date.now() into localStorage; on the next render any
  // notification older than that stamp greys out. This lets the admin
  // acknowledge the current batch and only see *new* items light up
  // once the snapshot is refreshed to a later date.
  const SNAPSHOT_AS_OF = Date.parse('2026-04-18T00:00:00Z');
  const isStale = notifsReadUntil > 0 && SNAPSHOT_AS_OF <= notifsReadUntil;
  // Badge math: show the exact count up to 9; anything larger
  // collapses to "9+" so the dot stays a dot. Cast to string for
  // the JSX branch below.
  const badgeLabel = totalNotifications > 9 ? '9+' : String(totalNotifications);
  // When everything is stale (acknowledged), we still show the bell
  // but skip the gold dot — nothing is "new" until the next refresh.
  const showUnreadDot = hasUnread && !isStale;

  const handleMarkAllRead = () => {
    const now = Date.now();
    setNotifsReadUntil(now);
    try {
      window.localStorage.setItem(NOTIFS_READ_UNTIL_KEY, String(now));
    } catch {
      /* private-mode Safari / quota exceeded — no-op, state still
         updates for this session */
    }
  };

  // Close the mobile sidebar when the route changes (user clicked a
  // link) and when Escape is pressed, so keyboard users can dismiss
  // the overlay without hunting for the close button.
  useEffect(() => { setMobileOpen(false); }, [location.pathname]);
  useEscapeKey(mobileOpen, useCallback(() => setMobileOpen(false), []));
  // Close notifications dropdown on Escape + route change.
  useEscapeKey(notifOpen, useCallback(() => setNotifOpen(false), []));
  useEffect(() => { setNotifOpen(false); }, [location.pathname]);

  // Global Cmd+K / Ctrl+K hotkey — bound here (not inside the palette)
  // so every /admin route shares one keyboard policy owned by the shell.
  // We deliberately ignore the shortcut while focus sits in an editable
  // surface so typing "K" with Cmd held (rare, but e.g. international
  // keyboards, dead-key combinations, or someone selecting text with
  // Shift+Cmd+K modifier combos) never swallows a keystroke mid-edit.
  // CapsLock flips `e.key` to 'K', so we compare case-insensitively.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey) || e.shiftKey || e.altKey) return;
      if (e.key.toLowerCase() !== 'k') return;
      const t = document.activeElement as HTMLElement | null;
      const tag = t?.tagName;
      const isEditing = tag === 'INPUT' || tag === 'TEXTAREA' || t?.isContentEditable;
      // Allow Cmd+K while the palette's own input has focus so the user
      // can toggle it closed again from inside — the palette sits above
      // the rest of the shell so its input is safe to treat as "not
      // editing something you'd lose."
      if (isEditing && !paletteOpen) return;
      e.preventDefault();
      setPaletteOpen(prev => !prev);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [paletteOpen]);

  // Global "?" (aka Shift+/) hotkey — opens the keyboard cheatsheet
  // modal. Skipped while the user is typing in an editable surface so
  // typing a literal "?" into a search field, textarea, or
  // contenteditable never steals the keystroke. Also skipped when the
  // command palette is already open so the two modals don't stack and
  // fight for focus. Compares e.key against both '?' and the physical
  // '/' slot + shift because some international layouts place the
  // question mark on a shifted key that `e.key` reports differently.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const isQuestion = e.key === '?' || (e.shiftKey && e.key === '/');
      if (!isQuestion) return;
      const t = document.activeElement as HTMLElement | null;
      const tag = t?.tagName;
      const isEditing = tag === 'INPUT' || tag === 'TEXTAREA' || t?.isContentEditable;
      if (isEditing) return;
      if (paletteOpen) return;
      e.preventDefault();
      setShortcutsOpen(prev => !prev);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [paletteOpen]);

  // Click-outside to dismiss the notifications dropdown. Uses
  // mousedown (not click) so a click on another trigger closes this
  // first and the new one opens immediately.
  useEffect(() => {
    if (!notifOpen) return;
    const onDown = (e: MouseEvent) => {
      const el = notifContainerRef.current;
      if (el && !el.contains(e.target as Node)) {
        setNotifOpen(false);
      }
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [notifOpen]);
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

  // Only show sidebar entries the current user is allowed to visit.
  // Recomputed per render (cheap — 12 rows). If the user isn't logged
  // in at all we bail out entirely below.
  const visibleNavItems = NAV_ITEMS.filter(item => hasAccess(user?.role, item.roles));

  // If auth hasn't hydrated a user yet, send them to the login page.
  // AuthGuard normally catches this upstream, but the guard lives on
  // the route level — if AdminLayout is ever reused outside the guard
  // (or the guard is relaxed) we don't want to render the shell empty.
  if (!user) {
    return <Navigate to="/admin/login" replace />;
  }

  // Figure out whether the current URL is a page the user is allowed to
  // see. If not, we keep the sidebar rendered (with the filtered items)
  // but swap the main content for a friendly "access denied" panel.
  // Beats a silent 404 for a salesman who clicked a bookmarked link.
  const activeItem = matchNavItem(location.pathname);
  const routeAllowed = activeItem ? hasAccess(user.role, activeItem.roles) : true;

  const handleLogout = async () => {
    // Guard against accidental sign-outs — a single misclick in the
    // sidebar would otherwise drop the admin back to the public site
    // and lose any unsaved draft state further down the tree. The
    // confirm stays lightweight (native dialog, no new deps) so the
    // flow still works offline and in the smallest viewport.
    if (typeof window !== 'undefined') {
      const ok = window.confirm('Se déconnecter de l\'admin Vision Affichage ?');
      if (!ok) return;
    }
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
      <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} />
      <ShortcutsDialog open={shortcutsOpen} onOpenChange={setShortcutsOpen} />
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
          {visibleNavItems.map(item => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                onClick={() => setMobileOpen(false)}
                title={desktopCollapsed ? item.label : undefined}
                className={({ isActive }) =>
                  // Active state: brand-blue pill + bold + gold left border
                  // so the current section stands out clearly against the
                  // navy sidebar. NavLink emits aria-current="page" on the
                  // active row automatically. The left border is swapped
                  // for a full transparent one on inactive rows so hover +
                  // active swaps never jitter width by 3px.
                  `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm mb-0.5 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#E8A838]/70 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0F2341] border-l-[3px] ${
                    desktopCollapsed ? 'md:justify-center' : ''
                  } ${
                    isActive
                      ? 'bg-[#0052CC] text-white font-bold border-[#E8A838] shadow-sm'
                      : 'text-white/70 font-medium border-transparent hover:bg-white/5 hover:text-white'
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
          {/* Discoverable entry-point for the keyboard cheatsheet. Mouse
              users who never press "?" still find the reference from
              here; the trailing kbd hint tells keyboard users the
              shortcut that gets them here faster next time. */}
          <button
            type="button"
            onClick={() => setShortcutsOpen(true)}
            title={desktopCollapsed ? 'Raccourcis clavier (?)' : undefined}
            aria-haspopup="dialog"
            aria-expanded={shortcutsOpen}
            className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-xs text-white/60 hover:bg-white/5 hover:text-white transition-colors bg-transparent border-none cursor-pointer text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-[#E8A838]/70 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0F2341] ${desktopCollapsed ? 'md:justify-center' : ''}`}
          >
            <Keyboard size={16} strokeWidth={1.8} aria-hidden="true" className="shrink-0" />
            <span className={`flex-1 ${desktopCollapsed ? 'md:hidden' : ''}`}>Raccourcis clavier</span>
            <kbd
              aria-hidden="true"
              className={`text-[10px] font-semibold text-white/70 bg-white/10 border border-white/20 rounded px-1.5 py-0.5 ${desktopCollapsed ? 'md:hidden' : ''}`}
            >
              ?
            </kbd>
          </button>
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
            {/* Notifications dropdown — aggregates actionable Shopify
                events (pending orders, abandoned carts, failed
                payments). Clicking a row routes to the relevant admin
                page; closing/escape/clicking outside dismisses. */}
            <div ref={notifContainerRef} className="relative">
              <button
                type="button"
                onClick={() => setNotifOpen(o => !o)}
                className="relative w-10 h-10 rounded-lg hover:bg-zinc-100 flex items-center justify-center focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0052CC] focus-visible:ring-offset-1 transition-colors"
                aria-label={
                  hasUnread
                    ? `Notifications, ${totalNotifications} non lue${totalNotifications > 1 ? 's' : ''}`
                    : 'Notifications'
                }
                aria-haspopup="menu"
                aria-expanded={notifOpen}
                aria-controls="admin-notifications-menu"
              >
                <Bell size={20} aria-hidden="true" className="text-zinc-700" />
                {showUnreadDot && (
                  <span
                    aria-hidden="true"
                    className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-[#E8A838] text-[#1B3A6B] text-[10px] font-extrabold leading-[18px] text-center ring-2 ring-white"
                  >
                    {badgeLabel}
                  </span>
                )}
              </button>

              {notifOpen && (
                <div
                  id="admin-notifications-menu"
                  role="menu"
                  aria-label="Notifications"
                  className="absolute right-0 mt-2 w-80 max-w-80 rounded-xl border border-zinc-200 bg-white shadow-xl z-40 overflow-hidden"
                >
                  {/* Brand-navy header strip — matches the sidebar palette
                      so the dropdown reads as part of the admin chrome, not
                      a generic popup. */}
                  <div className="px-4 py-3 bg-[#0F2341] text-white flex items-center justify-between">
                    <div className="text-sm font-bold">Notifications</div>
                    <div className="text-[11px] text-white/60">
                      {hasUnread
                        ? isStale
                          ? 'Tout a été lu'
                          : `${totalNotifications} non lue${totalNotifications > 1 ? 's' : ''}`
                        : 'Tout est à jour'}
                    </div>
                  </div>
                  {totalNotifications === 0 ? (
                    // Empty state — shown when every counter is 0. Kept
                    // intentionally plain so it reads as "nothing to do"
                    // rather than an error.
                    <div className="px-4 py-8 text-center">
                      <div className="w-10 h-10 mx-auto rounded-full bg-zinc-100 text-zinc-400 flex items-center justify-center mb-2">
                        <Bell size={18} aria-hidden="true" />
                      </div>
                      <div className="text-sm font-semibold text-zinc-700">Aucune notification</div>
                      <div className="text-[12px] text-zinc-500">No notifications</div>
                    </div>
                  ) : (
                    <>
                      <ul className="max-h-96 overflow-y-auto py-1">
                        <li>
                          <Link
                            to="/admin/orders?filter=pending"
                            role="menuitem"
                            onClick={() => setNotifOpen(false)}
                            className={`flex items-start gap-3 px-4 py-3 hover:bg-zinc-50 focus:outline-none focus-visible:bg-zinc-50 transition-colors ${
                              isStale ? 'opacity-50' : ''
                            }`}
                          >
                            <span className={`w-8 h-8 shrink-0 rounded-lg flex items-center justify-center ${
                              isStale ? 'bg-zinc-100 text-zinc-400' : 'bg-[#E8A838]/15 text-[#B37D10]'
                            }`}>
                              <ShoppingBag size={16} aria-hidden="true" />
                            </span>
                            <span className="flex-1 min-w-0">
                              <span className={`block text-[13px] font-semibold ${isStale ? 'text-zinc-500' : 'text-zinc-900'}`}>
                                Commandes en attente
                              </span>
                              <span className="block text-[12px] text-zinc-500">
                                {pendingOrdersCount === 0
                                  ? 'Aucune commande en attente de paiement'
                                  : `${pendingOrdersCount} commande${pendingOrdersCount > 1 ? 's' : ''} en attente de paiement`}
                              </span>
                            </span>
                            {pendingOrdersCount > 0 && (
                              <span className={`text-[10px] font-extrabold px-1.5 py-0.5 rounded-full min-w-[20px] text-center self-center ${
                                isStale ? 'bg-zinc-200 text-zinc-500' : 'bg-[#E8A838] text-[#1B3A6B]'
                              }`}>
                                {pendingOrdersCount}
                              </span>
                            )}
                          </Link>
                        </li>
                        <li>
                          <Link
                            to="/admin/abandoned-carts"
                            role="menuitem"
                            onClick={() => setNotifOpen(false)}
                            className={`flex items-start gap-3 px-4 py-3 hover:bg-zinc-50 focus:outline-none focus-visible:bg-zinc-50 transition-colors ${
                              isStale ? 'opacity-50' : ''
                            }`}
                          >
                            <span className={`w-8 h-8 shrink-0 rounded-lg flex items-center justify-center ${
                              isStale ? 'bg-zinc-100 text-zinc-400' : 'bg-[#0052CC]/10 text-[#0052CC]'
                            }`}>
                              <ShoppingCart size={16} aria-hidden="true" />
                            </span>
                            <span className="flex-1 min-w-0">
                              <span className={`block text-[13px] font-semibold ${isStale ? 'text-zinc-500' : 'text-zinc-900'}`}>
                                Paniers abandonnés
                              </span>
                              <span className="block text-[12px] text-zinc-500">
                                {abandonedCartsCount === 0
                                  ? 'Aucun panier abandonné récent'
                                  : `${abandonedCartsCount} panier${abandonedCartsCount > 1 ? 's' : ''} à récupérer`}
                              </span>
                            </span>
                            {abandonedCartsCount > 0 && (
                              <span className={`text-[10px] font-extrabold px-1.5 py-0.5 rounded-full min-w-[20px] text-center self-center ${
                                isStale ? 'bg-zinc-200 text-zinc-500' : 'bg-[#0052CC] text-white'
                              }`}>
                                {abandonedCartsCount}
                              </span>
                            )}
                          </Link>
                        </li>
                        <li>
                          <Link
                            to="/admin/orders?filter=failed"
                            role="menuitem"
                            onClick={() => setNotifOpen(false)}
                            className={`flex items-start gap-3 px-4 py-3 hover:bg-zinc-50 focus:outline-none focus-visible:bg-zinc-50 transition-colors ${
                              isStale ? 'opacity-50' : ''
                            }`}
                          >
                            <span className={`w-8 h-8 shrink-0 rounded-lg flex items-center justify-center ${
                              isStale ? 'bg-zinc-100 text-zinc-400' : 'bg-red-50 text-red-600'
                            }`}>
                              <CreditCard size={16} aria-hidden="true" />
                            </span>
                            <span className="flex-1 min-w-0">
                              <span className={`block text-[13px] font-semibold ${isStale ? 'text-zinc-500' : 'text-zinc-900'}`}>
                                Paiements échoués
                              </span>
                              <span className="block text-[12px] text-zinc-500">
                                {failedPaymentsCount === 0
                                  ? 'Aucun échec de paiement'
                                  : `${failedPaymentsCount} paiement${failedPaymentsCount > 1 ? 's' : ''} à revoir`}
                              </span>
                            </span>
                            {failedPaymentsCount > 0 && (
                              <span className={`text-[10px] font-extrabold px-1.5 py-0.5 rounded-full min-w-[20px] text-center self-center ${
                                isStale ? 'bg-zinc-200 text-zinc-500' : 'bg-red-600 text-white'
                              }`}>
                                {failedPaymentsCount}
                              </span>
                            )}
                          </Link>
                        </li>
                      </ul>
                      {/* Mark-all-read. Stamps Date.now() into
                          localStorage; next render greys out every row
                          whose as-of date is earlier than the stamp. */}
                      <div className="border-t border-zinc-100 px-3 py-2 bg-zinc-50/60">
                        <button
                          type="button"
                          onClick={handleMarkAllRead}
                          disabled={isStale}
                          className="w-full text-center text-[12px] font-semibold text-[#0052CC] hover:text-[#003D99] disabled:text-zinc-400 disabled:cursor-not-allowed bg-transparent border-none cursor-pointer py-1.5 rounded transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0052CC]"
                        >
                          {isStale ? 'Tout est marqué comme lu' : 'Tout marquer comme lu'}
                        </button>
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>

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
          {routeAllowed ? (
            <Outlet />
          ) : (
            // Friendly access-denied card. Rendered inside the admin
            // shell (not a full-page 404) so the user keeps the filtered
            // sidebar and can click back to something they can access.
            <div
              role="alert"
              aria-live="polite"
              className="max-w-xl rounded-2xl border border-zinc-200 bg-white p-8 shadow-sm"
            >
              <div className="w-12 h-12 rounded-xl bg-[#E8A838]/15 text-[#B37D10] flex items-center justify-center mb-4">
                <Lock size={22} aria-hidden="true" />
              </div>
              <h1 className="text-lg font-bold text-zinc-900">Access denied</h1>
              <p className="mt-2 text-sm text-zinc-600">
                You don't have permission to view this page.
              </p>
              <p className="mt-1 text-xs text-zinc-500">
                {activeItem?.label
                  ? `"${activeItem.label}" is reserved for other admin roles. Contact the president if you believe this is a mistake.`
                  : 'This section is reserved for other admin roles.'}
              </p>
              <Link
                to="/admin"
                className="mt-6 inline-flex items-center gap-2 rounded-lg bg-[#0052CC] px-4 py-2 text-sm font-semibold text-white hover:bg-[#003D99] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0052CC] focus-visible:ring-offset-2 transition-colors"
              >
                <LayoutDashboard size={16} aria-hidden="true" />
                Back to dashboard
              </Link>
            </div>
          )}
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
