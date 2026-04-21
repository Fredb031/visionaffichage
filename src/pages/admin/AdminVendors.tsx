/** Admin vendors page — manages the sales team roster (seed + localStorage
 * custom invites). Features a MTD leaderboard, sortable metric columns,
 * per-vendor inline rename, CSV export of the vendor list, an Actif/Inactif
 * status filter, and a link out to the public `/vendor/:vendorId` profile
 * for vendors that have one. Admin-level "Exporter tous les vendeurs"
 * commission CSV is gated on `orders:read`.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Plus, Mail, TrendingUp, Trash2, X, Search, Download, Crown, Medal, Award, ArrowUp, ArrowDown, Pencil, ExternalLink } from 'lucide-react';
import { isValidEmail, normalizeInvisible } from '@/lib/utils';
import { isAutomationActive } from '@/lib/automations';
import { plural } from '@/lib/i18n';
import { useEscapeKey } from '@/hooks/useEscapeKey';
import { useBodyScrollLock } from '@/hooks/useBodyScrollLock';
import { useFocusTrap } from '@/hooks/useFocusTrap';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { useSearchHotkey } from '@/hooks/useSearchHotkey';
import { readLS, writeLS } from '@/lib/storage';
import { useAuthStore } from '@/stores/authStore';
import { hasPermission } from '@/lib/permissions';
import {
  getVendorCommissions,
  filterSummaryByMonth,
  currentYearMonth,
  exportAllVendorsCommissionsCsv,
} from '@/lib/commissions';

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

// Sortable metrics driven off the MTD commissions data. 'default'
// preserves custom-first-then-seed insertion order; the rest toggle
// asc/desc on click (see `sortDir`). Legacy URL values ('revenue',
// 'quotes', 'conv') are still accepted and remapped so bookmarks from
// before the 9.13 rewrite keep working.
type VendorSort = 'default' | 'sales' | 'commission' | 'orders' | 'quotes' | 'conv';
type SortDir = 'asc' | 'desc';
const VALID_SORTS: readonly VendorSort[] = ['default', 'sales', 'commission', 'orders', 'quotes', 'conv'];
const LEGACY_SORT_MAP: Record<string, VendorSort> = { revenue: 'sales' };

// Per-vendor display-name overrides. Same persistence pattern as the
// customer-tag overrides in AdminCustomerDetail — keyed by vendor id,
// local-only (not pushed to Shopify), and a hydration guard drops any
// non-string / missing entries so a corrupted blob can't crash the
// grid on mount.
const VENDOR_NAME_OVERRIDES_KEY = 'vision-vendor-name-overrides';
type VendorNameOverrides = Record<string, string>;
function loadVendorNameOverrides(): VendorNameOverrides {
  const raw = readLS<unknown>(VENDOR_NAME_OVERRIDES_KEY, {});
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const out: VendorNameOverrides = {};
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof k === 'string' && typeof v === 'string' && v.trim().length >= 2) {
      out[k] = v;
    }
  }
  return out;
}

// Build a list of YYYY-MM keys going back `monthsBack` months from
// today, inclusive of the current month, newest first. Used to
// populate the month picker dropdown.
function listRecentMonths(monthsBack: number): string[] {
  const now = new Date();
  const out: string[] = [];
  for (let i = 0; i < monthsBack; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    out.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  }
  return out;
}

// Human-readable French month label ('2026-04' → 'avr. 2026').
function formatMonthLabel(ym: string): string {
  const [y, m] = ym.split('-').map(Number);
  if (!Number.isFinite(y) || !Number.isFinite(m)) return ym;
  const d = new Date(y, m - 1, 1);
  return d.toLocaleDateString('fr-CA', { month: 'short', year: 'numeric' });
}

// Seed vendor IDs map to public /vendor/:vendorId profiles (see
// VENDOR_PROFILES in pages/vendor/VendorProfile.tsx). Custom vendors
// invited through the admin modal don't have a public profile yet, so
// the row link is suppressed for them to avoid a 404-like empty page.
const PUBLIC_PROFILE_IDS: ReadonlySet<string> = new Set(['1', '2', '3']);

// Status model — no real `status` column exists on VendorRecord yet;
// we derive it from observable activity. A vendor with zero sent quotes
// AND zero revenue AND the "Invitation envoyée" placeholder is treated
// as Inactif (freshly invited, never engaged). Everyone else is Actif.
type VendorStatus = 'active' | 'inactive';
type StatusFilter = 'all' | VendorStatus;
function deriveStatus(v: { quotesSent: number; revenue: number; lastActive: string }): VendorStatus {
  if (v.quotesSent > 0 || v.revenue > 0) return 'active';
  if (v.lastActive === 'Invitation envoyée') return 'inactive';
  return 'active';
}
const STATUS_LABEL: Record<VendorStatus, string> = { active: 'Actif', inactive: 'Inactif' };

// Extract the invite timestamp from a custom vendor id of the shape
// `cus-${Date.now()}-${suffix}`; returns null for seed ids ('1','2','3')
// or any malformed id so the CSV falls back to em-dash rather than a
// misleading 1970-01-01.
function createdAtFromId(id: string): Date | null {
  const m = /^cus-(\d+)-/.exec(id);
  if (!m) return null;
  const ts = Number(m[1]);
  if (!Number.isFinite(ts) || ts <= 0) return null;
  const d = new Date(ts);
  return Number.isFinite(d.getTime()) ? d : null;
}
function formatCreatedAt(id: string): string {
  const d = createdAtFromId(id);
  if (!d) return '—';
  return d.toLocaleDateString('fr-CA', { year: 'numeric', month: '2-digit', day: '2-digit' });
}

/** CSV export of the filtered vendor list. Columns: Nom, Courriel,
 * Statut, Commission (MTD, 2 decimals, no symbol), Créé le. Mirrors
 * the AdminOrders helper: RFC 4180 escaping, formula-injection guard
 * (leading = + - @ \t \r → prefixed with a tab so Excel/Sheets render
 * as text), UTF-8 BOM so Excel-on-Windows handles Québécois accents,
 * fr-CA dates. Blob URL revoked after 1s to avoid pinning memory and
 * to give Safari time to begin the download before the URL dies.
 */
function exportVendorsCsv(
  rows: Array<{ name: string; email: string; status: VendorStatus; commission: number; id: string }>,
): void {
  const FORMULA_TRIGGERS = /^[=+\-@\t\r]/;
  const csvEscape = (v: unknown) => {
    let s = String(v ?? '');
    if (FORMULA_TRIGGERS.test(s)) s = '\t' + s;
    return /[",\n\r\t]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const header = ['Nom', 'Courriel', 'Statut', 'Commission', 'Créé le'];
  const body = rows.map(r => [
    r.name,
    r.email,
    STATUS_LABEL[r.status],
    r.commission.toFixed(2),
    formatCreatedAt(r.id),
  ]);
  const csv = [header, ...body].map(r => r.map(csvEscape).join(',')).join('\n');
  const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `vendors-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export default function AdminVendors() {
  useDocumentTitle('Vendeurs — Admin Vision Affichage');
  // URL-backed sort so reload preserves the admin's chosen ranking and
  // shareable URLs jump straight to the right view.
  const [searchParams, setSearchParams] = useSearchParams();
  const initialSortRaw = searchParams.get('sort') ?? 'default';
  const remappedSortRaw = LEGACY_SORT_MAP[initialSortRaw] ?? initialSortRaw;
  const initialSort: VendorSort = (VALID_SORTS as readonly string[]).includes(remappedSortRaw)
    ? (remappedSortRaw as VendorSort)
    : 'default';
  const initialDir: SortDir = searchParams.get('dir') === 'asc' ? 'asc' : 'desc';
  const urlMonth = searchParams.get('month');
  const initialMonth = urlMonth && /^\d{4}-\d{2}$/.test(urlMonth) ? urlMonth : currentYearMonth();
  const urlStatus = searchParams.get('status');
  const initialStatus: StatusFilter =
    urlStatus === 'active' || urlStatus === 'inactive' ? urlStatus : 'all';

  const [sort, setSort] = useState<VendorSort>(initialSort);
  const [sortDir, setSortDir] = useState<SortDir>(initialDir);
  const [month, setMonth] = useState<string>(initialMonth);
  const [status, setStatus] = useState<StatusFilter>(initialStatus);
  const [query, setQuery] = useState(searchParams.get('q') ?? '');
  const [customVendors, setCustomVendors] = useState<VendorRecord[]>([]);
  // Name-override store — lets admin/president rename any vendor card
  // inline (task 9.6). Kept local to this component; render helpers
  // below read `displayName(v)` instead of `v.name` directly.
  const [nameOverrides, setNameOverrides] = useState<VendorNameOverrides>({});
  const [editingNameId, setEditingNameId] = useState<string | null>(null);
  const [nameDraft, setNameDraft] = useState('');
  const [nameError, setNameError] = useState<string | null>(null);
  const nameEditInputRef = useRef<HTMLInputElement | null>(null);
  const [showInvite, setShowInvite] = useState(false);
  const [newName, setNewName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [inviteError, setInviteError] = useState<string | null>(null);
  const nameInputRef = useRef<HTMLInputElement>(null);
  const trapRef = useFocusTrap<HTMLDivElement>(showInvite);
  const searchRef = useSearchHotkey({ onClear: () => setQuery('') });

  // Sync sort + dir + month + search → URL. Dir is only preserved when
  // a non-default sort is active (asc/desc is meaningless for 'default').
  useEffect(() => {
    const next = new URLSearchParams(searchParams);
    const trimmed = query.trim();
    if (trimmed) next.set('q', trimmed); else next.delete('q');
    if (sort !== 'default') next.set('sort', sort); else next.delete('sort');
    if (sort !== 'default' && sortDir !== 'desc') next.set('dir', sortDir);
    else next.delete('dir');
    if (month !== currentYearMonth()) next.set('month', month); else next.delete('month');
    if (status !== 'all') next.set('status', status); else next.delete('status');
    if (next.toString() !== searchParams.toString()) {
      setSearchParams(next, { replace: true });
    }
  }, [sort, sortDir, month, query, status, searchParams, setSearchParams]);

  useEffect(() => {
    // readLS handles the JSON.parse failure path so a corrupted blob
    // can't crash the admin page on mount.
    const raw = readLS<unknown>('vision-vendors', []);
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
  }, []);

  // Hydrate vendor-name overrides once on mount — readLS + the
  // loadVendorNameOverrides guard above ensure a malformed blob
  // (wrong shape, empty-string entries, non-string values) degrades
  // gracefully to an empty map instead of crashing the grid.
  useEffect(() => {
    setNameOverrides(loadVendorNameOverrides());
  }, []);

  // Autofocus + select-all the inline rename input whenever we enter
  // edit mode — mirrors AdminCustomerDetail's tag rename pattern so
  // Enter/blur/Escape behave identically across admin surfaces.
  useEffect(() => {
    if (editingNameId !== null) {
      nameEditInputRef.current?.focus();
      nameEditInputRef.current?.select();
    }
  }, [editingNameId]);

  useEffect(() => {
    if (!showInvite) return;
    nameInputRef.current?.focus();
  }, [showInvite]);
  useEscapeKey(showInvite, useCallback(() => { setShowInvite(false); setInviteError(null); }, []));
  useBodyScrollLock(showInvite);

  const persist = (next: VendorRecord[]) => {
    setCustomVendors(next);
    // writeLS swallows quota / private-mode failures; surface to the
    // console so the admin knows their invite list didn't persist.
    if (!writeLS('vision-vendors', next)) {
      console.warn('[AdminVendors] Could not persist vendors (quota or storage disabled)');
    }
  };

  const handleInvite = (e: React.FormEvent) => {
    e.preventDefault();
    // Strip invisible chars before storing — a Slack/Notion paste of the
    // invitee's email with a ZWSP attached would otherwise live in the
    // vision-vendors localStorage row and fail any future strict compare.
    const name = normalizeInvisible(newName).trim();
    const email = normalizeInvisible(newEmail).trim().toLowerCase();
    if (!name || !isValidEmail(email)) {
      setInviteError('Nom et courriel valides requis.');
      return;
    }
    // Block re-invites for ANY existing vendor (custom OR seed). Before
    // this, re-inviting e.g. sophie@visionaffichage.com (a seed vendor)
    // silently closed the modal with no feedback and — worse — matching
    // against customVendors only meant the same seed email could be
    // stored a second time, producing a duplicate card. Surface an
    // inline error instead of the previous silent modal-close so the
    // admin understands nothing happened.
    const normalizedSeed = SEED_VENDORS.map(v => v.email.toLowerCase());
    const normalizedCustom = customVendors.map(v => v.email.toLowerCase());
    if (normalizedSeed.includes(email) || normalizedCustom.includes(email)) {
      setInviteError('Ce courriel est déjà associé à un vendeur existant.');
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
    setInviteError(null);
    // Gate the welcome mailto on the /admin/automations pause flag.
    // The vendor is saved to the list either way (we already persisted
    // above) — the pause only suppresses the outbound invite email so
    // the admin can silently queue vendors without blasting them with
    // the VISION10 coupon template while copy is under review.
    if (!isAutomationActive('new-customer-welcome')) {
      console.info('[automation] skipped paused automation:', 'new-customer-welcome');
      setInviteError('Invitation enregistrée — courriel de bienvenue en pause (/admin/automations).');
      setNewName('');
      setNewEmail('');
      setShowInvite(false);
      return;
    }
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
    const label = nameOverrides[v.id] ?? v.name;
    const ok = window.confirm(
      `Retirer ${label} de la liste ? Cette action est irréversible.`,
    );
    if (!ok) return;
    persist(customVendors.filter(x => x.id !== id));
  };

  // Admin-level "Export all vendors" — one CSV per month with a Vendor
  // column so finance lands the whole team in a single file. Gated on
  // orders:read so only admins who can see commission numbers can
  // export them. Disabled when no vendor has any commission rows for
  // the current month.
  const user = useAuthStore(s => s.user);
  const canExport = Boolean(user && hasPermission(user.role, 'orders:read'));
  // Only admin/president can inline-rename vendors (task 9.6). Salesman
  // and others see the read-only display — no pencil cue, no click-to-
  // edit handler attached to the name. The role check stays local (no
  // separate `vendors:write` perm yet) so the gate is unambiguous.
  const canRenameVendors = Boolean(user && (user.role === 'admin' || user.role === 'president'));
  const displayName = useCallback(
    (v: VendorRecord) => nameOverrides[v.id] ?? v.name,
    [nameOverrides],
  );
  // Begin rename — copy the current display name into the draft and
  // clear any prior error. Gated by canRenameVendors at the call site.
  const beginNameEdit = useCallback((v: VendorRecord) => {
    setEditingNameId(v.id);
    setNameDraft(displayName(v));
    setNameError(null);
  }, [displayName]);
  const cancelNameEdit = useCallback(() => {
    setEditingNameId(null);
    setNameDraft('');
    setNameError(null);
  }, []);
  // Persist a rename:
  //   - trim + min-length 2 (silently reverts on empty/too-short)
  //   - no-op if the trimmed value equals the current display (keeps
  //     localStorage clean; no unnecessary write)
  //   - collision guard against every OTHER vendor's display name
  //     (case-insensitive, ZWSP-stripped) — show inline toast instead
  //     of clobbering a second vendor with the same label
  //   - a trimmed value equal to the base (seed) name drops the
  //     override entry entirely so the store doesn't bloat forever
  const commitNameEdit = useCallback(() => {
    if (editingNameId === null) return;
    const id = editingNameId;
    const trimmed = normalizeInvisible(nameDraft).trim();
    const vendor = [...customVendors, ...SEED_VENDORS].find(x => x.id === id);
    if (!vendor) { cancelNameEdit(); return; }
    if (trimmed.length < 2) { cancelNameEdit(); return; }
    const current = nameOverrides[id] ?? vendor.name;
    if (trimmed === current) { cancelNameEdit(); return; }
    const lowered = trimmed.toLowerCase();
    const collision = [...customVendors, ...SEED_VENDORS].some(other => {
      if (other.id === id) return false;
      const otherName = nameOverrides[other.id] ?? other.name;
      return normalizeInvisible(otherName).trim().toLowerCase() === lowered;
    });
    if (collision) {
      setNameError(`Un autre vendeur porte déjà le nom « ${trimmed} ».`);
      // Keep the input open so the admin can correct the draft —
      // otherwise the toast would flash and disappear on blur.
      nameEditInputRef.current?.focus();
      nameEditInputRef.current?.select();
      return;
    }
    setNameOverrides(prev => {
      const next: VendorNameOverrides = { ...prev };
      if (trimmed === vendor.name) {
        // Rename back to seed → drop the override entry.
        delete next[id];
      } else {
        next[id] = trimmed;
      }
      if (!writeLS(VENDOR_NAME_OVERRIDES_KEY, next)) {
        console.warn('[AdminVendors] Could not persist vendor-name override (quota or storage disabled)');
      }
      return next;
    });
    setEditingNameId(null);
    setNameDraft('');
    setNameError(null);
  }, [editingNameId, nameDraft, customVendors, nameOverrides, cancelNameEdit]);
  const exportHasRows = useMemo(() => {
    for (const v of [...SEED_VENDORS, ...customVendors]) {
      const m = filterSummaryByMonth(getVendorCommissions(v.id), month);
      if (m.lines.length > 0) return true;
    }
    return false;
  }, [customVendors, month]);

  // Drop an override entry when its vendor is removed, so a later
  // re-invite of a different vendor that happens to reuse the id can't
  // silently inherit the old rename. customVendors is the source of
  // truth here — seed vendors never get removed, so their overrides
  // persist across sessions as intended.
  useEffect(() => {
    const liveIds = new Set<string>([...customVendors.map(v => v.id), ...SEED_VENDORS.map(v => v.id)]);
    setNameOverrides(prev => {
      let changed = false;
      const next: VendorNameOverrides = {};
      for (const [k, v] of Object.entries(prev)) {
        if (liveIds.has(k)) next[k] = v;
        else changed = true;
      }
      if (!changed) return prev;
      writeLS(VENDOR_NAME_OVERRIDES_KEY, next);
      return next;
    });
  }, [customVendors]);

  // Vendor-list CSV — a simpler "who's on the team" export distinct
  // from the commission CSV below. Uses the currently filtered `all`
  // list so a narrowed search / status filter is respected. Commission
  // column is MTD for the selected month so the header-less numeric
  // pairs with the month picker without forcing a second selector.
  const onExportVendorsCsv = useCallback(() => {
    const rows = all.map(v => ({
      id: v.id,
      name: nameOverrides[v.id] ?? v.name,
      email: v.email,
      status: deriveStatus(v),
      commission: v.mtdCommission,
    }));
    exportVendorsCsv(rows);
  }, [all, nameOverrides]);

  const onExportAllCsv = useCallback(() => {
    // Export with override-aware names so the finance CSV matches what
    // the admin sees in the UI — otherwise a vendor renamed via task
    // 9.6 would surface with their old seed name in the export.
    const vendors = [...SEED_VENDORS, ...customVendors].map(v => ({
      id: v.id,
      name: nameOverrides[v.id] ?? v.name,
    }));
    const csv = exportAllVendorsCommissionsCsv(vendors, month);
    // UTF-8 BOM keeps Excel-on-Windows happy with Québécois accents.
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `commissions-all-vendors-${month}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    // Task 18.7: defer the revoke by 1s so Safari has time to begin
    // the download before the blob URL disappears — an immediate
    // revoke occasionally raced the dispatcher and cancelled the
    // transfer. Also stops the object URL from pinning CSV bytes in
    // memory for the rest of the tab's life.
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }, [customVendors, month, nameOverrides]);

  const allUnsorted = [...customVendors, ...SEED_VENDORS];
  // Fold the MTD commission rollup onto each vendor so both the
  // leaderboard and the card grid can read them off the same derived
  // shape — no need to recompute in two places. Keyed by vendor id.
  type VendorRow = VendorRecord & {
    mtdSales: number;
    mtdCommission: number;
    mtdPaid: number;
    mtdPending: number;
    mtdOrders: number;
  };
  const enriched = useMemo<VendorRow[]>(() => {
    return allUnsorted.map(v => {
      const mtd = filterSummaryByMonth(getVendorCommissions(v.id), month);
      return {
        ...v,
        mtdSales: mtd.totalSales,
        mtdCommission: mtd.totalCommission,
        mtdPaid: mtd.paidCommission,
        mtdPending: mtd.pendingCommission,
        mtdOrders: mtd.orderCount,
      };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customVendors, month]);

  const all = useMemo(() => {
    // Strip ZWSP before matching so a paste-from-Slack search term
    // still matches vendors with invisible chars in their imported name.
    const q = normalizeInvisible(query).trim().toLowerCase();
    const searched = q
      ? enriched.filter(v => {
          // Search the override-aware display name so a vendor renamed
          // inline via task 9.6 is still reachable by their new label
          // (AND by the seed name, since overrides only REPLACE in the
          // display layer — base name is searched too via enriched.name
          // when no override exists).
          const name = normalizeInvisible(nameOverrides[v.id] ?? v.name).toLowerCase();
          const email = normalizeInvisible(v.email).toLowerCase();
          return name.includes(q) || email.includes(q);
        })
      : enriched;
    // Status filter layered on top of search — narrow to Actif/Inactif
    // after name/email match so an admin can search "sophie" then flip
    // to Inactif without losing the search scope.
    const filtered = status === 'all'
      ? searched
      : searched.filter(v => deriveStatus(v) === status);
    if (sort === 'default') return filtered;
    const arr = [...filtered];
    const dir = sortDir === 'asc' ? 1 : -1;
    const keyFor = (v: VendorRow): number => {
      switch (sort) {
        case 'sales':      return v.mtdSales;
        case 'commission': return v.mtdCommission;
        case 'orders':     return v.mtdOrders;
        case 'quotes':     return v.quotesSent;
        case 'conv':       return v.conversionRate;
        default:           return 0;
      }
    };
    arr.sort((a, b) => (keyFor(a) - keyFor(b)) * dir);
    return arr;
  }, [enriched, sort, sortDir, query, status, nameOverrides]);

  // Leaderboard is always sorted by MTD sales desc so the ranking is
  // stable regardless of the column the admin chose for the card grid
  // below. Top 10 keeps the card compact even for big vendor rosters.
  const leaderboard = useMemo(() => {
    return [...enriched]
      .sort((a, b) => b.mtdSales - a.mtdSales)
      .slice(0, 10);
  }, [enriched]);

  // Click a column header: first click sorts desc; second click on the
  // same column toggles to asc; clicking a different column resets to
  // desc (the most useful default — admins want top performers first).
  const toggleSort = useCallback((key: Exclude<VendorSort, 'default'>) => {
    setSort(prev => {
      if (prev === key) {
        setSortDir(d => (d === 'desc' ? 'asc' : 'desc'));
        return key;
      }
      setSortDir('desc');
      return key;
    });
  }, []);

  const monthOptions = useMemo(() => listRecentMonths(12), []);
  const fmtMoney = (n: number) => n.toLocaleString('fr-CA', { minimumFractionDigits: 0, maximumFractionDigits: 0 }) + ' $';

  return (
    <div className="space-y-6">
      <header className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">Vendeurs</h1>
          <p className="text-sm text-zinc-500 mt-1">Gère ton équipe et leurs accès · {all.length} {plural('fr', all.length, { one: 'vendeur', other: 'vendeurs' })}</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {/* Search — name / email. Cmd+K focuses it (same shortcut
              pattern as the other admin tables); Esc clears + blurs. */}
          <div className="flex items-center gap-2 w-[240px] border border-zinc-200 rounded-lg px-3 py-1.5 bg-zinc-50">
            <Search size={14} className="text-zinc-400" aria-hidden="true" />
            <input
              ref={searchRef}
              type="search"
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Rechercher  (⌘K)"
              aria-label="Rechercher un vendeur par nom ou courriel"
              aria-keyshortcuts="Meta+K Control+K"
              className="bg-transparent border-none outline-none text-xs flex-1"
            />
          </div>
          {/* Month picker — drives both the leaderboard window and the
              MTD metrics on the cards + the "Export all" CSV. Defaults
              to the current month. */}
          <label className="flex items-center gap-2 text-xs text-zinc-500">
            <span>Mois :</span>
            <select
              value={month}
              onChange={e => setMonth(e.target.value)}
              aria-label="Sélectionner le mois de performance"
              className="border border-zinc-200 rounded-lg px-2.5 py-1.5 bg-white outline-none focus:border-[#0052CC] focus-visible:ring-2 focus-visible:ring-[#0052CC]/25 text-xs font-semibold text-foreground cursor-pointer capitalize"
            >
              {monthOptions.map(ym => (
                <option key={ym} value={ym}>{formatMonthLabel(ym)}</option>
              ))}
            </select>
          </label>
          <button
            type="button"
            onClick={onExportVendorsCsv}
            disabled={all.length === 0}
            aria-label="Exporter la liste des vendeurs filtrés en CSV"
            className="inline-flex items-center gap-2 text-sm font-bold px-4 py-2 bg-white border border-zinc-300 text-zinc-700 rounded-lg hover:border-[#0052CC] hover:text-[#0052CC] shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0052CC] focus-visible:ring-offset-2 disabled:opacity-40 disabled:cursor-not-allowed disabled:shadow-none"
            title={all.length === 0 ? 'Aucun vendeur à exporter' : `Exporter ${all.length} vendeur${all.length > 1 ? 's' : ''} en CSV`}
          >
            <Download size={15} aria-hidden="true" />
            Exporter CSV
          </button>
          {canExport && (
            <button
              type="button"
              onClick={onExportAllCsv}
              disabled={!exportHasRows}
              aria-label={`Exporter les commissions de tous les vendeurs (${month}) en CSV`}
              className="inline-flex items-center gap-2 text-sm font-bold px-4 py-2 bg-white border border-[#0052CC] text-[#0052CC] rounded-lg hover:bg-[#0052CC]/5 shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0052CC] focus-visible:ring-offset-2 disabled:opacity-40 disabled:cursor-not-allowed disabled:shadow-none"
              title={`Exporter un CSV combiné pour ${month}`}
            >
              <Download size={15} aria-hidden="true" />
              Exporter tous les vendeurs
            </button>
          )}
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

      {/* Performance leaderboard — ranks vendors by MTD sales for the
          selected month. Top 3 get gold/silver/bronze medals; #1 also
          gets a Crown glyph. Entries with 0 sales still render so the
          admin can see "who's dark this month" without toggling sorts. */}
      {leaderboard.length > 0 && (
        <section
          aria-labelledby="vendor-leaderboard-title"
          className="bg-gradient-to-br from-white to-[#0052CC]/[0.03] border border-zinc-200 rounded-2xl p-5 shadow-sm"
        >
          <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#E8A838] to-[#B37D10] text-white flex items-center justify-center shadow-sm">
                <Award size={16} aria-hidden="true" />
              </div>
              <div>
                <h2 id="vendor-leaderboard-title" className="text-base font-extrabold tracking-tight">
                  Classement — <span className="capitalize">{formatMonthLabel(month)}</span>
                </h2>
                <p className="text-[11px] text-zinc-500">Classés par ventes MTD</p>
              </div>
            </div>
          </div>
          <ol className="space-y-1.5">
            {leaderboard.map((v, idx) => {
              const rank = idx + 1;
              const isGold   = rank === 1;
              const isSilver = rank === 2;
              const isBronze = rank === 3;
              // Medal styling — gold / silver / bronze for top 3, a
              // muted zinc pill for everyone else. Using `Medal` for
              // 2nd/3rd and `Crown` for the winner reads more clearly
              // than three identical trophies.
              const medalClass = isGold
                ? 'bg-gradient-to-br from-[#F5CA5B] to-[#B37D10] text-white shadow-sm ring-1 ring-[#B37D10]/50'
                : isSilver
                ? 'bg-gradient-to-br from-zinc-200 to-zinc-400 text-white shadow-sm ring-1 ring-zinc-400/60'
                : isBronze
                ? 'bg-gradient-to-br from-[#CD7F32] to-[#7A4A1E] text-white shadow-sm ring-1 ring-[#7A4A1E]/50'
                : 'bg-zinc-100 text-zinc-600';
              return (
                <li
                  key={v.id}
                  className={`flex items-center gap-3 rounded-xl px-3 py-2 border transition-colors ${
                    isGold   ? 'bg-[#E8A838]/10 border-[#E8A838]/40' :
                    isSilver ? 'bg-zinc-100/70 border-zinc-300' :
                    isBronze ? 'bg-[#CD7F32]/10 border-[#CD7F32]/30' :
                    'bg-white border-zinc-100'
                  }`}
                >
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center font-extrabold text-xs ${medalClass}`}
                    aria-label={`Rang ${rank}`}
                  >
                    {isGold ? (
                      <Crown size={14} aria-hidden="true" />
                    ) : isSilver || isBronze ? (
                      <Medal size={14} aria-hidden="true" />
                    ) : (
                      rank
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-bold text-sm truncate">
                      {displayName(v)}
                      {v.isCustom && (
                        <span className="ml-1.5 text-[9px] font-bold bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded align-middle">
                          Nouveau
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-zinc-500 truncate">
                      {v.mtdOrders} {plural('fr', v.mtdOrders, { one: 'commande', other: 'commandes' })}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-extrabold text-sm text-zinc-900 tabular-nums">{fmtMoney(v.mtdSales)}</div>
                    <div className="text-[11px] font-bold text-[#B37D10] tabular-nums">
                      {fmtMoney(v.mtdCommission)} <span className="text-zinc-400 font-semibold">comm.</span>
                    </div>
                  </div>
                </li>
              );
            })}
          </ol>
        </section>
      )}

      {/* Segmented Actif/Inactif filter — Inactif surfaces vendors who
          were invited but never sent a quote or booked revenue (i.e. the
          "Invitation envoyée" cohort). Status is derived, not stored,
          so it stays accurate as custom vendors start transacting. */}
      <div
        role="group"
        aria-label="Filtrer les vendeurs par statut"
        className="flex items-center gap-2 flex-wrap text-xs bg-zinc-50 border border-zinc-200 rounded-xl px-3 py-2"
      >
        <span className="text-zinc-500 font-semibold mr-1">Statut :</span>
        {([
          { key: 'all',      label: 'Tout' },
          { key: 'active',   label: 'Actif' },
          { key: 'inactive', label: 'Inactif' },
        ] as Array<{ key: StatusFilter; label: string }>).map(seg => {
          const active = status === seg.key;
          return (
            <button
              key={seg.key}
              type="button"
              onClick={() => setStatus(seg.key)}
              aria-pressed={active}
              className={`inline-flex items-center px-2.5 py-1 rounded-lg font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0052CC] focus-visible:ring-offset-1 ${
                active
                  ? 'bg-[#0052CC] text-white shadow-sm'
                  : 'bg-white text-zinc-600 border border-zinc-200 hover:border-[#0052CC]/40 hover:text-[#0052CC]'
              }`}
            >
              {seg.label}
            </button>
          );
        })}
      </div>

      {/* Sortable metric columns — clicking a header toggles the sort
          key on the card grid below. Desc is the default on first click
          (admins want leaders at the top); clicking the active column
          again flips to asc. */}
      <div
        role="toolbar"
        aria-label="Trier les vendeurs par métrique"
        className="flex items-center gap-2 flex-wrap text-xs bg-zinc-50 border border-zinc-200 rounded-xl px-3 py-2"
      >
        <span className="text-zinc-500 font-semibold mr-1">Trier :</span>
        {([
          { key: 'default',    label: 'Défaut' },
          { key: 'sales',      label: 'Ventes MTD' },
          { key: 'commission', label: 'Comm. MTD' },
          { key: 'orders',     label: '# Commandes' },
          { key: 'quotes',     label: 'Devis' },
          { key: 'conv',       label: 'Conv.' },
        ] as Array<{ key: VendorSort; label: string }>).map(col => {
          const active = sort === col.key;
          return (
            <button
              key={col.key}
              type="button"
              onClick={() => {
                if (col.key === 'default') { setSort('default'); setSortDir('desc'); return; }
                toggleSort(col.key as Exclude<VendorSort, 'default'>);
              }}
              aria-pressed={active}
              aria-label={
                col.key === 'default'
                  ? 'Tri par défaut'
                  : `Trier par ${col.label} (${active && sortDir === 'asc' ? 'croissant' : 'décroissant'})`
              }
              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0052CC] focus-visible:ring-offset-1 ${
                active
                  ? 'bg-[#0052CC] text-white shadow-sm'
                  : 'bg-white text-zinc-600 border border-zinc-200 hover:border-[#0052CC]/40 hover:text-[#0052CC]'
              }`}
            >
              {col.label}
              {active && col.key !== 'default' && (
                sortDir === 'desc'
                  ? <ArrowDown size={11} aria-hidden="true" />
                  : <ArrowUp   size={11} aria-hidden="true" />
              )}
            </button>
          );
        })}
      </div>

      {all.length === 0 ? (
        // Empty-state so a narrowed search (e.g. typo in the vendor's
        // name) doesn't just show an empty grid with no explanation —
        // admins were left staring at blank whitespace, unsure whether
        // the page crashed or simply had no matches.
        <div className="bg-white border border-zinc-200 rounded-2xl p-10 text-center text-sm text-zinc-500">
          Aucun vendeur trouvé.
        </div>
      ) : (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {all.map(v => {
          const shownName = displayName(v);
          const isEditingName = editingNameId === v.id;
          // Defensive initials — drop empty/undefined parts so a name
          // typed as '  ' (only whitespace) or a missing field doesn't
          // produce an empty avatar bubble. Reads the override-aware
          // display name so inline rename updates the avatar too.
          const initials = (shownName || '')
            .split(/\s+/)
            .map(n => n[0])
            .filter(Boolean)
            .slice(0, 2)
            .join('')
            .toUpperCase() || '?';
          // MTD commission numbers come from the `enriched` rollup so
          // we don't recompute the same summary twice (leaderboard +
          // card grid both consume the same vendor row shape). The
          // month is picker-driven; changing it re-derives everything.
          return (
            <div key={v.id} className="bg-white border border-zinc-200 rounded-2xl p-5 hover:shadow-lg transition-shadow group">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-[#0052CC] to-[#1B3A6B] text-white flex items-center justify-center font-extrabold text-sm">
                  {initials}
                </div>
                <div className="flex-1 min-w-0">
                  {isEditingName ? (
                    // Inline rename — same keyboard contract as
                    // AdminCustomerDetail tags: Enter commits, Escape
                    // reverts, blur commits. The collision-toast below
                    // only appears for THIS vendor to keep the error
                    // local to the input the admin is touching.
                    <div className="flex flex-col gap-1">
                      <input
                        ref={nameEditInputRef}
                        type="text"
                        value={nameDraft}
                        onChange={e => { setNameDraft(e.target.value); if (nameError) setNameError(null); }}
                        onBlur={commitNameEdit}
                        onKeyDown={e => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            commitNameEdit();
                          } else if (e.key === 'Escape') {
                            e.preventDefault();
                            cancelNameEdit();
                          }
                        }}
                        aria-label={`Renommer le vendeur ${v.name}`}
                        aria-invalid={nameError ? true : undefined}
                        className={`w-full font-bold text-sm bg-white border rounded-lg px-2 py-1 outline-none ring-2 ${
                          nameError
                            ? 'border-rose-400 ring-rose-500/20'
                            : 'border-[#0052CC] ring-[#0052CC]/20'
                        }`}
                      />
                      {nameError && (
                        <div role="alert" className="text-[11px] font-semibold text-rose-600">
                          {nameError}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="font-bold truncate flex items-center gap-1.5">
                      {canRenameVendors ? (
                        // Click-to-edit — a subtle pencil cue on hover
                        // tells the admin the label is actionable
                        // without cluttering the resting state. The
                        // button is visually flush with the text so it
                        // reads as a label, not a form control.
                        <button
                          type="button"
                          onClick={() => beginNameEdit(v)}
                          className="group/name inline-flex items-center gap-1.5 truncate text-left hover:text-[#0052CC] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0052CC] focus-visible:ring-offset-1 rounded"
                          title="Renommer"
                          aria-label={`Renommer ${shownName}`}
                        >
                          <span className="truncate">{shownName}</span>
                          <Pencil
                            size={11}
                            aria-hidden="true"
                            className="opacity-0 group-hover/name:opacity-60 transition-opacity shrink-0"
                          />
                        </button>
                      ) : (
                        <span className="truncate">{shownName}</span>
                      )}
                      {v.isCustom && (
                        <span className="text-[9px] font-bold bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded shrink-0">
                          Nouveau
                        </span>
                      )}
                    </div>
                  )}
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
                    aria-label={`Retirer ${shownName}`}
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

              {/* MTD performance strip — sales, commission, # orders
                  for the selected month. All three mirror the sortable
                  column headers so clicking "Ventes MTD" above lines up
                  visually with the leftmost tile. 0 $ / 0 renders for
                  custom vendors with no credited orders yet. */}
              <div className="grid grid-cols-3 gap-2 mb-2">
                <div className="bg-zinc-50 border border-zinc-200 rounded-lg p-2 text-center" title={`Ventes ${month}`}>
                  <div className="text-sm font-extrabold text-zinc-900 tabular-nums">{fmtMoney(v.mtdSales)}</div>
                  <div className="text-[10px] text-zinc-500 uppercase tracking-wider">Ventes MTD</div>
                </div>
                <div className="bg-[#E8A838]/10 border border-[#E8A838]/30 rounded-lg p-2 text-center" title={`Commission ${month}`}>
                  <div className="text-sm font-extrabold text-[#B37D10] tabular-nums">{fmtMoney(v.mtdCommission)}</div>
                  <div className="text-[10px] text-zinc-500 uppercase tracking-wider">Comm. MTD</div>
                </div>
                <div className="bg-zinc-50 border border-zinc-200 rounded-lg p-2 text-center" title={`Commandes ${month}`}>
                  <div className="text-sm font-extrabold text-zinc-900 tabular-nums">{v.mtdOrders}</div>
                  <div className="text-[10px] text-zinc-500 uppercase tracking-wider"># Commandes</div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2 mb-3">
                <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-2 text-center" title="Commission payée">
                  <div className="text-sm font-extrabold text-emerald-700 tabular-nums">{fmtMoney(v.mtdPaid)}</div>
                  <div className="text-[10px] text-zinc-500 uppercase tracking-wider">Payée</div>
                </div>
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-2 text-center" title="Commission en attente">
                  <div className="text-sm font-extrabold text-amber-700 tabular-nums">{fmtMoney(v.mtdPending)}</div>
                  <div className="text-[10px] text-zinc-500 uppercase tracking-wider">En attente</div>
                </div>
              </div>

              <div className="flex items-center justify-between text-xs gap-2">
                <span className="text-zinc-500 truncate">Actif {v.lastActive}</span>
                <div className="flex items-center gap-3 shrink-0">
                  {/* Public-profile link — only vendors present in the
                      VENDOR_PROFILES map at /vendor/:vendorId get this
                      link. Custom vendors invited via this page don't
                      yet have a profile entry, so the link is hidden to
                      avoid routing admins to a "profil introuvable"
                      empty state. */}
                  {PUBLIC_PROFILE_IDS.has(v.id) && (
                    <Link
                      to={`/vendor/${v.id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={`Voir le profil public de ${shownName} (nouvel onglet)`}
                      className="inline-flex items-center gap-1 text-zinc-500 hover:text-[#0052CC] font-semibold focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0052CC] focus-visible:ring-offset-1 rounded"
                      title="Voir le profil public"
                    >
                      Profil
                      <ExternalLink size={10} aria-hidden="true" />
                    </Link>
                  )}
                  <a
                    href={`mailto:${v.email}`}
                    aria-label={`Contacter ${shownName} par courriel`}
                    className="text-[#0052CC] font-bold hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0052CC] focus-visible:ring-offset-1 rounded"
                  >
                    Contacter →
                  </a>
                </div>
              </div>
            </div>
          );
        })}
      </div>
      )}

      {showInvite && (
        <div
          className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="invite-vendor-title"
          onClick={() => { setShowInvite(false); setInviteError(null); }}
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
                onClick={() => { setShowInvite(false); setInviteError(null); }}
                aria-label="Fermer"
                className="text-zinc-400 hover:text-zinc-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0052CC] rounded"
              >
                <X size={18} aria-hidden="true" />
              </button>
            </div>
            <p className="text-sm text-zinc-500 mb-4">
              Le vendeur recevra une invitation par courriel avec un mot de passe temporaire.
            </p>
            {inviteError && (
              <div role="alert" className="mb-3 p-3 rounded-lg text-xs bg-rose-50 text-rose-700 border border-rose-200">
                {inviteError}
              </div>
            )}
            <form onSubmit={handleInvite} className="space-y-3">
              <label className="block">
                <span className="text-[11px] font-bold text-zinc-500 uppercase tracking-wider">Nom complet</span>
                <input
                  ref={nameInputRef}
                  type="text"
                  value={newName}
                  onChange={e => { setNewName(e.target.value); if (inviteError) setInviteError(null); }}
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
                      onChange={e => { setNewEmail(e.target.value); if (inviteError) setInviteError(null); }}
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
