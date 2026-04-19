import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Plus, Mail, TrendingUp, Trash2, X } from 'lucide-react';
import { isValidEmail, normalizeInvisible } from '@/lib/utils';
import { useEscapeKey } from '@/hooks/useEscapeKey';
import { useBodyScrollLock } from '@/hooks/useBodyScrollLock';
import { useFocusTrap } from '@/hooks/useFocusTrap';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';

interface VendorRecord {
  id: string;
  name: string;
  email: string;
  quotesSent: number;
  conversionRate: number;
  revenue: number;
  lastActive: string;
  isCustom?: boolean;
}

const SEED_VENDORS: VendorRecord[] = [
  { id: '1', name: 'Sophie Tremblay',         email: 'sophie@visionaffichage.com', quotesSent: 47, conversionRate: 68, revenue: 28400, lastActive: 'il y a 12 min' },
  { id: '2', name: 'Marc-André Pelletier',    email: 'marc@visionaffichage.com',   quotesSent: 32, conversionRate: 74, revenue: 19200, lastActive: 'il y a 1h' },
  { id: '3', name: 'Julie Gagnon',            email: 'julie@visionaffichage.com',  quotesSent: 28, conversionRate: 61, revenue: 15800, lastActive: 'il y a 4h' },
];

type VendorSort = 'default' | 'revenue' | 'quotes' | 'conv';
const VALID_SORTS: readonly VendorSort[] = ['default', 'revenue', 'quotes', 'conv'];

export default function AdminVendors() {
  useDocumentTitle('Vendeurs — Admin Vision Affichage');
  // URL-backed sort so reload preserves the admin's chosen ranking and
  // shareable URLs jump straight to the right view.
  const [searchParams, setSearchParams] = useSearchParams();
  const initialSortRaw = searchParams.get('sort') ?? 'default';
  const initialSort: VendorSort = (VALID_SORTS as readonly string[]).includes(initialSortRaw)
    ? (initialSortRaw as VendorSort)
    : 'default';

  const [sort, setSort] = useState<VendorSort>(initialSort);
  const [customVendors, setCustomVendors] = useState<VendorRecord[]>([]);
  const [showInvite, setShowInvite] = useState(false);
  const [newName, setNewName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const nameInputRef = useRef<HTMLInputElement>(null);
  const trapRef = useFocusTrap<HTMLDivElement>(showInvite);

  // Sync sort → URL.
  useEffect(() => {
    const next = new URLSearchParams(searchParams);
    if (sort !== 'default') next.set('sort', sort); else next.delete('sort');
    if (next.toString() !== searchParams.toString()) {
      setSearchParams(next, { replace: true });
    }
  }, [sort, searchParams, setSearchParams]);

  useEffect(() => {
    try {
      const raw = JSON.parse(localStorage.getItem('vision-vendors') ?? '[]');
      if (!Array.isArray(raw)) { setCustomVendors([]); return; }
      // Filter out rows missing the fields the UI relies on (id is used
      // as React key, name drives initials.split(' '), email fills the
      // mailto). A malformed row could come from a devtools edit or an
      // older build — dropping it is cleaner than crashing the whole
      // admin page on a property access.
      const clean = (raw as Partial<VendorRecord>[]).filter(v =>
        v && typeof v === 'object' &&
        typeof v.id === 'string' &&
        typeof v.name === 'string' &&
        typeof v.email === 'string'
      ) as VendorRecord[];
      setCustomVendors(clean);
    } catch {
      setCustomVendors([]);
    }
  }, []);

  useEffect(() => {
    if (!showInvite) return;
    nameInputRef.current?.focus();
  }, [showInvite]);
  useEscapeKey(showInvite, useCallback(() => setShowInvite(false), []));
  useBodyScrollLock(showInvite);

  const persist = (next: VendorRecord[]) => {
    setCustomVendors(next);
    try { localStorage.setItem('vision-vendors', JSON.stringify(next)); }
    catch (e) { console.warn('[AdminVendors] Could not persist vendors:', e); }
  };

  const handleInvite = (e: React.FormEvent) => {
    e.preventDefault();
    // Strip invisible chars before storing — a Slack/Notion paste of the
    // invitee's email with a ZWSP attached would otherwise live in the
    // vision-vendors localStorage row and fail any future strict compare.
    const name = normalizeInvisible(newName).trim();
    const email = normalizeInvisible(newEmail).trim().toLowerCase();
    if (!name || !isValidEmail(email)) return;
    // Skip silently if this email already exists as a custom vendor — we
    // were getting duplicate rows when an admin re-invited someone they
    // forgot was already in the list, and React's list-key warning fired
    // on whatever id collision happened next.
    if (customVendors.some(v => v.email === email)) {
      setShowInvite(false);
      return;
    }
    // Salt the id with a random suffix so two invites in the same ms
    // (admin double-click) can't collide on `cus-${Date.now()}`. Crypto
    // UUID isn't universally available on every WebView this admin will
    // hit; the Math.random suffix is defensive enough for a per-tab list.
    const idSuffix = Math.random().toString(36).slice(2, 8);
    const v: VendorRecord = {
      id: `cus-${Date.now()}-${idSuffix}`,
      name,
      email,
      quotesSent: 0,
      conversionRate: 0,
      revenue: 0,
      lastActive: 'Invitation envoyée',
      isCustom: true,
    };
    persist([v, ...customVendors]);
    // Pre-fill an invitation mailto
    const subject = encodeURIComponent('Invitation à rejoindre Vision Affichage');
    const body = encodeURIComponent(
      `Bonjour ${v.name},\n\n` +
      `Tu as été invité comme vendeur Vision Affichage.\n\n` +
      `Connecte-toi ici : https://visionaffichage.com/admin/login\n` +
      `Ton courriel : ${v.email}\n` +
      `Mot de passe temporaire : vendeur123 (à changer après ta première connexion)\n\n` +
      `À bientôt,\nL'équipe Vision Affichage`,
    );
    window.location.href = `mailto:${encodeURIComponent(v.email)}?subject=${subject}&body=${body}`;
    setNewName('');
    setNewEmail('');
    setShowInvite(false);
  };

  const remove = (id: string) => {
    // Quick guard against an accidental click on the trash icon —
    // before this the vendor was wiped from localStorage with no
    // confirmation and no undo. window.confirm is intentionally
    // synchronous here so the button doesn't need a separate confirm
    // modal flow.
    const v = customVendors.find(x => x.id === id);
    if (!v) return;
    const ok = window.confirm(
      `Retirer ${v.name} de la liste ? Cette action est irréversible.`,
    );
    if (!ok) return;
    persist(customVendors.filter(x => x.id !== id));
  };

  const allUnsorted = [...customVendors, ...SEED_VENDORS];
  const all = useMemo(() => {
    const arr = [...allUnsorted];
    if (sort === 'revenue') return arr.sort((a, b) => b.revenue - a.revenue);
    if (sort === 'quotes')  return arr.sort((a, b) => b.quotesSent - a.quotesSent);
    if (sort === 'conv')    return arr.sort((a, b) => b.conversionRate - a.conversionRate);
    return arr; // 'default' = custom-first then seed (insertion order)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customVendors, sort]);

  return (
    <div className="space-y-6">
      <header className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">Vendeurs</h1>
          <p className="text-sm text-zinc-500 mt-1">Gère ton équipe et leurs accès · {all.length} vendeur{all.length > 1 ? 's' : ''}</p>
        </div>
        <div className="flex items-center gap-2">
          {/* Sort dropdown — admins routinely want top-revenue or
              top-quotes-sent at the top to spot performers. */}
          <label className="flex items-center gap-2 text-xs text-zinc-500">
            <span>Trier :</span>
            <select
              value={sort}
              onChange={e => setSort(e.target.value as VendorSort)}
              aria-label="Trier les vendeurs"
              className="border border-zinc-200 rounded-lg px-2.5 py-1.5 bg-white outline-none focus:border-[#0052CC] focus-visible:ring-2 focus-visible:ring-[#0052CC]/25 text-xs font-semibold text-foreground cursor-pointer"
            >
              <option value="default">Défaut</option>
              <option value="revenue">Revenus (élevés → bas)</option>
              <option value="quotes">Devis envoyés</option>
              <option value="conv">Taux de conversion</option>
            </select>
          </label>
          <button
            type="button"
            onClick={() => setShowInvite(true)}
            className="inline-flex items-center gap-2 text-sm font-bold px-4 py-2 bg-[#0052CC] text-white rounded-lg hover:opacity-90 shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0052CC] focus-visible:ring-offset-2"
          >
            <Plus size={15} aria-hidden="true" />
            Ajouter un vendeur
          </button>
        </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {all.map(v => {
          // Defensive initials — drop empty/undefined parts so a name
          // typed as '  ' (only whitespace) or a missing field doesn't
          // produce an empty avatar bubble.
          const initials = (v.name || '')
            .split(/\s+/)
            .map(n => n[0])
            .filter(Boolean)
            .slice(0, 2)
            .join('')
            .toUpperCase() || '?';
          return (
            <div key={v.id} className="bg-white border border-zinc-200 rounded-2xl p-5 hover:shadow-lg transition-shadow group">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-[#0052CC] to-[#1B3A6B] text-white flex items-center justify-center font-extrabold text-sm">
                  {initials}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-bold truncate flex items-center gap-1.5">
                    {v.name}
                    {v.isCustom && (
                      <span className="text-[9px] font-bold bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded">
                        Nouveau
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-zinc-500 truncate flex items-center gap-1">
                    <Mail size={11} aria-hidden="true" />
                    {v.email}
                  </div>
                </div>
                {v.isCustom && (
                  <button
                    type="button"
                    onClick={() => remove(v.id)}
                    className="opacity-0 group-hover:opacity-100 focus-visible:opacity-100 text-zinc-400 hover:text-rose-600 transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 focus-visible:ring-offset-1 rounded"
                    title="Retirer"
                    aria-label={`Retirer ${v.name}`}
                  >
                    <Trash2 size={14} aria-hidden="true" />
                  </button>
                )}
              </div>

              <div className="grid grid-cols-3 gap-2 mb-3">
                <div className="bg-zinc-50 rounded-lg p-2 text-center">
                  <div className="text-lg font-extrabold text-zinc-900">{v.quotesSent}</div>
                  <div className="text-[10px] text-zinc-500 uppercase tracking-wider">Devis</div>
                </div>
                <div className="bg-zinc-50 rounded-lg p-2 text-center">
                  <div className="text-lg font-extrabold text-emerald-600 inline-flex items-center gap-0.5">
                    {v.conversionRate}%
                    {v.conversionRate > 0 && <TrendingUp size={11} aria-hidden="true" />}
                  </div>
                  <div className="text-[10px] text-zinc-500 uppercase tracking-wider">Conv.</div>
                </div>
                <div className="bg-zinc-50 rounded-lg p-2 text-center">
                  <div className="text-lg font-extrabold text-zinc-900">{(v.revenue / 1000).toFixed(0)}k</div>
                  <div className="text-[10px] text-zinc-500 uppercase tracking-wider">Ventes</div>
                </div>
              </div>

              <div className="flex items-center justify-between text-xs">
                <span className="text-zinc-500">Actif {v.lastActive}</span>
                <a
                  href={`mailto:${v.email}`}
                  aria-label={`Contacter ${v.name} par courriel`}
                  className="text-[#0052CC] font-bold hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0052CC] focus-visible:ring-offset-1 rounded"
                >
                  Contacter →
                </a>
              </div>
            </div>
          );
        })}
      </div>

      {showInvite && (
        <div
          className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="invite-vendor-title"
          onClick={() => setShowInvite(false)}
        >
          <div
            ref={trapRef}
            tabIndex={-1}
            className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl focus:outline-none"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h2 id="invite-vendor-title" className="text-lg font-extrabold">Inviter un vendeur</h2>
              <button
                type="button"
                onClick={() => setShowInvite(false)}
                aria-label="Fermer"
                className="text-zinc-400 hover:text-zinc-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0052CC] rounded"
              >
                <X size={18} aria-hidden="true" />
              </button>
            </div>
            <p className="text-sm text-zinc-500 mb-4">
              Le vendeur recevra une invitation par courriel avec un mot de passe temporaire.
            </p>
            <form onSubmit={handleInvite} className="space-y-3">
              <label className="block">
                <span className="text-[11px] font-bold text-zinc-500 uppercase tracking-wider">Nom complet</span>
                <input
                  ref={nameInputRef}
                  type="text"
                  value={newName}
                  onChange={e => setNewName(e.target.value)}
                  required
                  autoComplete="name"
                  placeholder="Marie Tremblay"
                  className="mt-1 w-full border border-zinc-200 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-[#0052CC]"
                />
              </label>
              <label className="block">
                <span className="text-[11px] font-bold text-zinc-500 uppercase tracking-wider">Courriel</span>
                {(() => {
                  const invalid = newEmail.trim().length > 0 && !isValidEmail(newEmail);
                  return (
                    <input
                      type="email"
                      value={newEmail}
                      onChange={e => setNewEmail(e.target.value)}
                      required
                      autoComplete="email"
                      placeholder="marie@visionaffichage.com"
                      aria-invalid={invalid || undefined}
                      className={`mt-1 w-full border rounded-lg px-3 py-2.5 text-sm outline-none ${
                        invalid ? 'border-rose-300 focus:border-rose-500' : 'border-zinc-200 focus:border-[#0052CC]'
                      }`}
                    />
                  );
                })()}
              </label>
              <button
                type="submit"
                className="w-full py-3 bg-[#0052CC] text-white rounded-lg text-sm font-extrabold hover:opacity-90"
              >
                Envoyer l'invitation
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
