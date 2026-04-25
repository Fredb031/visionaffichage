import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, ShoppingBag, Package, UserCircle, FileText,
  Users, KeyRound, Mail, Sparkles, Settings, Search, Zap,
} from 'lucide-react';
import { useEscapeKey } from '@/hooks/useEscapeKey';
import { useFocusTrap } from '@/hooks/useFocusTrap';

/**
 * Admin command palette — Cmd/Ctrl+K from anywhere inside the admin
 * section pops a quick-jump list of the top-level pages. Keeps keyboard
 * power users from hunting through the sidebar on narrow windows or
 * hopping pages via the address bar.
 *
 * The global hotkey is bound from AdminLayout so the shell owns keyboard
 * policy for every /admin route; the palette itself only manages the
 * open/filter/navigate interactions once AdminLayout flips `open`.
 * Escape dismisses via useEscapeKey; Tab is contained via useFocusTrap
 * so focus can't leak to the dimmed page.
 */
type PaletteItem = {
  label: string;
  to: string;
  icon: typeof LayoutDashboard;
  keywords?: string;
};

const ITEMS: PaletteItem[] = [
  { label: 'Dashboard', to: '/admin', icon: LayoutDashboard, keywords: 'tableau de bord home accueil' },
  { label: 'Orders', to: '/admin/orders', icon: ShoppingBag, keywords: 'commandes' },
  { label: 'Customers', to: '/admin/customers', icon: UserCircle, keywords: 'clients' },
  { label: 'Products', to: '/admin/products', icon: Package, keywords: 'produits catalogue' },
  { label: 'Vendors', to: '/admin/vendors', icon: Users, keywords: 'vendeurs equipe' },
  { label: 'Quotes', to: '/admin/quotes', icon: FileText, keywords: 'soumissions devis' },
  { label: 'Users', to: '/admin/users', icon: KeyRound, keywords: 'comptes acces users' },
  { label: 'Emails', to: '/admin/emails', icon: Mail, keywords: 'courriels messages' },
  { label: 'Automations', to: '/admin/automations', icon: Zap, keywords: 'automatisations workflows zaps' },
  { label: 'Images', to: '/admin/images', icon: Sparkles, keywords: 'generation ai ia images' },
  { label: 'Settings', to: '/admin/settings', icon: Settings, keywords: 'parametres configuration' },
];

/** localStorage key + cap for the recent-commands MRU list. Persisting
 *  across sessions keeps repeat tasks (usually "Orders" → "Quotes") one
 *  keystroke away on every fresh Cmd+K. */
const RECENT_KEY = 'va:cmdk-recent';
const RECENT_MAX = 5;

function readRecent(): string[] {
  try {
    const raw = localStorage.getItem(RECENT_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((x): x is string => typeof x === 'string').slice(0, RECENT_MAX);
  } catch {
    return [];
  }
}

function writeRecent(to: string) {
  try {
    const prev = readRecent().filter(p => p !== to);
    const next = [to, ...prev].slice(0, RECENT_MAX);
    localStorage.setItem(RECENT_KEY, JSON.stringify(next));
  } catch {
    /* storage blocked (private mode, quota) — palette still works fine */
  }
}

type CommandPaletteProps = {
  /** Controlled open state — owned by AdminLayout so the Cmd+K hotkey
   *  lives alongside the rest of the admin shell's keyboard policy. */
  open: boolean;
  /** Fired whenever the palette wants to change its own state (Escape,
   *  backdrop click, successful navigation). AdminLayout flips its
   *  state in response. */
  onOpenChange: (open: boolean) => void;
};

export function CommandPalette({ open, onOpenChange }: CommandPaletteProps) {
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const [recent, setRecent] = useState<string[]>([]);
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const trapRef = useFocusTrap<HTMLDivElement>(open);

  const close = useCallback(() => onOpenChange(false), [onOpenChange]);
  useEscapeKey(open, close);

  // Reset transient state each time we reopen so the palette never
  // surfaces a stale search / selection. Also re-hydrates the MRU list
  // from localStorage so a nav that happened in another tab is visible.
  useEffect(() => {
    if (!open) return;
    setQuery('');
    setActive(0);
    setRecent(readRecent());
    // Focus the input after the focus trap has settled — useFocusTrap
    // focuses the first tabbable child, which IS our input, so this is
    // just a defensive re-focus for the empty-list edge case.
    queueMicrotask(() => inputRef.current?.focus());
  }, [open]);

  // Build the "Récents" section: map stored paths back to full items,
  // drop anything that no longer exists in the registry (e.g. a page
  // was renamed between sessions), and only show when the query is empty.
  const recentItems = useMemo(() => {
    if (query.trim()) return [] as PaletteItem[];
    return recent
      .map(to => ITEMS.find(i => i.to === to))
      .filter((i): i is PaletteItem => Boolean(i));
  }, [recent, query]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return ITEMS;
    return ITEMS.filter(i =>
      i.label.toLowerCase().includes(q) ||
      (i.keywords?.toLowerCase().includes(q) ?? false),
    );
  }, [query]);

  // Arrow-key navigation needs a single flat sequence that mirrors the
  // rendered order: Récents first (when shown), then the full/filtered
  // page list. Index math stays honest this way even after the MRU
  // list grows or shrinks.
  const sequence = useMemo(
    () => [...recentItems, ...filtered],
    [recentItems, filtered],
  );

  // Clamp the active index whenever the sequence shrinks — otherwise the
  // highlight would point past the end of the list and Enter would be a
  // no-op.
  useEffect(() => {
    if (active >= sequence.length) setActive(0);
  }, [sequence.length, active]);

  const go = useCallback((to: string) => {
    writeRecent(to);
    onOpenChange(false);
    navigate(to);
  }, [navigate, onOpenChange]);

  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive(i => (sequence.length === 0 ? 0 : (i + 1) % sequence.length));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive(i => (sequence.length === 0 ? 0 : (i - 1 + sequence.length) % sequence.length));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const item = sequence[active];
      if (item) go(item.to);
    }
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-start justify-center pt-[12vh] px-4"
      role="presentation"
    >
      <button
        type="button"
        aria-label="Fermer la palette de commandes"
        className="absolute inset-0 bg-black/40"
        onClick={close}
      />
      <div
        ref={trapRef}
        role="dialog"
        aria-modal="true"
        aria-label="Palette de commandes"
        tabIndex={-1}
        onKeyDown={onKeyDown}
        className="relative w-full max-w-xl bg-white rounded-xl shadow-2xl border border-zinc-200 overflow-hidden"
      >
        <div className="flex items-center gap-2 px-4 border-b border-zinc-200">
          <Search size={16} className="text-zinc-400" aria-hidden="true" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Aller à…"
            aria-label="Rechercher une page"
            aria-controls="command-palette-list"
            className="flex-1 py-3 text-sm bg-transparent outline-none placeholder:text-zinc-400"
          />
          <kbd className="hidden sm:inline-block text-[10px] font-semibold text-zinc-500 bg-zinc-100 border border-zinc-200 rounded px-1.5 py-0.5">
            Esc
          </kbd>
        </div>
        <ul
          id="command-palette-list"
          role="listbox"
          aria-label="Pages d'administration"
          className="max-h-80 overflow-y-auto py-1"
        >
          {sequence.length === 0 && (
            <li className="px-4 py-6 text-sm text-zinc-500 text-center">
              Aucun résultat
            </li>
          )}
          {recentItems.length > 0 && (
            <li role="presentation" className="px-4 pt-2 pb-1 text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
              Récents
            </li>
          )}
          {recentItems.map((item, idx) => {
            const Icon = item.icon;
            const isActive = idx === active;
            return (
              <li key={`recent-${item.to}`} role="option" aria-selected={isActive}>
                <button
                  type="button"
                  onClick={() => go(item.to)}
                  onMouseEnter={() => setActive(idx)}
                  className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm text-left transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0052CC]/40 ${
                    isActive ? 'bg-[#0052CC]/10 text-brand-black' : 'text-zinc-700 hover:bg-zinc-50'
                  }`}
                >
                  <Icon size={16} strokeWidth={1.8} aria-hidden="true" className="text-zinc-500" />
                  <span className="flex-1">{item.label}</span>
                  <span className="text-[11px] text-zinc-400">{item.to}</span>
                </button>
              </li>
            );
          })}
          {recentItems.length > 0 && filtered.length > 0 && (
            <li role="presentation" className="px-4 pt-2 pb-1 text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
              Pages
            </li>
          )}
          {filtered.map((item, idx) => {
            const seqIdx = recentItems.length + idx;
            const Icon = item.icon;
            const isActive = seqIdx === active;
            return (
              <li key={item.to} role="option" aria-selected={isActive}>
                <button
                  type="button"
                  onClick={() => go(item.to)}
                  onMouseEnter={() => setActive(seqIdx)}
                  className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm text-left transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0052CC]/40 ${
                    isActive ? 'bg-[#0052CC]/10 text-brand-black' : 'text-zinc-700 hover:bg-zinc-50'
                  }`}
                >
                  <Icon size={16} strokeWidth={1.8} aria-hidden="true" className="text-zinc-500" />
                  <span className="flex-1">{item.label}</span>
                  <span className="text-[11px] text-zinc-400">{item.to}</span>
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
