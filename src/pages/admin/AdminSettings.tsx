import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Link2, Building2, CreditCard, Shield, ShieldCheck, ExternalLink, Percent, Tag, Layers, Plus, Trash2, Save, Mail, DollarSign, Download, Upload, RotateCcw, DatabaseBackup, AlertTriangle, CheckCircle2, ChevronDown } from 'lucide-react';
import { toast } from 'sonner';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { useEscapeKey } from '@/hooks/useEscapeKey';
import { useBodyScrollLock } from '@/hooks/useBodyScrollLock';
import { useFocusTrap } from '@/hooks/useFocusTrap';
import { isValidEmail } from '@/lib/utils';
import {
  DEFAULT_APP_SETTINGS,
  saveSettings as saveAppSettings,
  useAppSettings,
} from '@/lib/appSettings';
import { readLS, writeLS } from '@/lib/storage';
import { logAdminAction } from '@/lib/auditLog';
import { getConfiguredWebhook, setConfiguredWebhook } from '@/lib/outlook';
import { useAuthStore } from '@/stores/authStore';
import {
  coerceToPermissionRole,
  getUserOverrides,
  hasPermission,
} from '@/lib/permissions';

// localStorage key for the settings toggles. Persisting client-side only
// since these are stub features pending real backend wiring — the keys
// match what a future Supabase-backed sync would use.
const SETTINGS_KEY = 'vision-admin-settings';

interface SettingsState {
  twoFactor: boolean;
  newOrderEmail: boolean;
  zapierWebhook: boolean;
  // Company profile — persisted so edits survive refresh. Previously
  // the inputs were uncontrolled (defaultValue only), so typing into
  // them did nothing visible after navigation. That reads as a broken
  // admin panel.
  companyName: string;
  companyNeq: string;
  companyEmail: string;
  companyPhone: string;
}

const DEFAULT_SETTINGS: SettingsState = {
  twoFactor: true,
  newOrderEmail: true,
  zapierWebhook: false,
  companyName: 'Vision Affichage',
  companyNeq: '',
  companyEmail: 'info@visionaffichage.com',
  companyPhone: '367-380-4808',
};

function readSettings(): SettingsState {
  // readLS swallows the JSON.parse failure path. The shape validation
  // + per-field coercion below stays here because readLS is deliberately
  // schema-agnostic.
  const parsed = readLS<Record<string, unknown> | null>(SETTINGS_KEY, null);
  if (!parsed || typeof parsed !== 'object') return DEFAULT_SETTINGS;
  // Coerce each field — a devtools edit could land strings or null
  // and break the strict aria-checked type on the toggles, or a
  // non-string on the controlled company inputs.
  const str = (v: unknown, fallback: string) => typeof v === 'string' ? v : fallback;
  return {
    twoFactor: Boolean(parsed.twoFactor ?? DEFAULT_SETTINGS.twoFactor),
    newOrderEmail: Boolean(parsed.newOrderEmail ?? DEFAULT_SETTINGS.newOrderEmail),
    zapierWebhook: Boolean(parsed.zapierWebhook ?? DEFAULT_SETTINGS.zapierWebhook),
    companyName: str(parsed.companyName, DEFAULT_SETTINGS.companyName),
    companyNeq: str(parsed.companyNeq, DEFAULT_SETTINGS.companyNeq),
    companyEmail: str(parsed.companyEmail, DEFAULT_SETTINGS.companyEmail),
    companyPhone: str(parsed.companyPhone, DEFAULT_SETTINGS.companyPhone),
  };
}

// ───────────── Dirty-state registry ─────────────
//
// Subsections (Taxes, Commissions, Discount codes, Bulk pricing, Zapier
// Outlook) each own a local `dirty` flag + a `save()` function. The
// top-level `AdminSettings` needs to know the aggregate dirty state so
// it can:
//   - render a sticky "Modifications non enregistrées" banner with an
//     inline "Tout enregistrer" button that flushes every dirty section,
//   - install a `beforeunload` listener when anything is dirty so a
//     fat-finger tab close doesn't silently drop unsaved edits.
//
// A small React context handles that lifting without having to rewire
// every subsection's state up to the parent. Each subsection calls
// `useRegisterDirty(id, dirty, save)` on every render; the provider
// keeps the latest save callback per id so "Tout enregistrer" always
// invokes the freshest closure (with up-to-date form values).

type SaveFn = () => void;

interface DirtyRegistryCtx {
  register: (id: string, dirty: boolean, save: SaveFn) => void;
  unregister: (id: string) => void;
}

const DirtyRegistryContext = createContext<DirtyRegistryCtx | null>(null);

function useRegisterDirty(id: string, dirty: boolean, save: SaveFn) {
  const ctx = useContext(DirtyRegistryContext);
  // Keep the latest save closure in a ref so the registered function
  // always sees current form state without forcing the provider to
  // re-render on every keystroke.
  const saveRef = useRef(save);
  saveRef.current = save;
  useEffect(() => {
    if (!ctx) return;
    ctx.register(id, dirty, () => saveRef.current());
    return () => ctx.unregister(id);
    // Re-run when dirty flips so the provider's aggregate stays accurate.
  }, [ctx, id, dirty]);
}

// ───────────── Saved toast ─────────────
//
// Replaces the plain "Enregistré" spans that each subsection used to
// render after a save. Shows a CheckCircle2 icon + "Enregistré · il y a
// un instant" for ~2.5 s then fades itself out — gives the admin a
// clearer "yes, it actually persisted" signal without cluttering the
// footer indefinitely.

function SavedToast({ savedAt, dirty }: { savedAt: number | null; dirty: boolean }) {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    if (!savedAt || dirty) {
      setVisible(false);
      return;
    }
    setVisible(true);
    const t = window.setTimeout(() => setVisible(false), 2500);
    return () => window.clearTimeout(t);
  }, [savedAt, dirty]);
  if (!visible) return null;
  return (
    <span
      role="status"
      aria-live="polite"
      className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-600"
    >
      <CheckCircle2 size={13} aria-hidden="true" />
      Enregistré · il y a un instant
    </span>
  );
}

// ───────────── Collapsible section wrapper ─────────────
//
// Each subsection `<section>` renders its own rounded card + header.
// Rather than refactor every subsection's internal DOM, this wrapper
// sits around the existing `<section>` and overlays a chevron button
// in the top-right corner (inside the section's `p-5` padding, so no
// content overlap). Collapse hides the section body and swaps in a
// compact stub card that keeps the title + chevron visible — expanded
// state persists across reloads under `va:admin-settings-expanded`.

const COLLAPSE_KEY = 'va:admin-settings-expanded';

function readCollapseMap(): Record<string, boolean> {
  try {
    const raw = localStorage.getItem(COLLAPSE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    const out: Record<string, boolean> = {};
    for (const [k, v] of Object.entries(parsed)) {
      if (typeof v === 'boolean') out[k] = v;
    }
    return out;
  } catch {
    return {};
  }
}

function writeCollapseMap(map: Record<string, boolean>) {
  try {
    localStorage.setItem(COLLAPSE_KEY, JSON.stringify(map));
  } catch {
    // Private mode / quota — collapse state is cosmetic, swallow.
  }
}

function CollapsibleSection({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  // Default expanded — admins shouldn't lose visibility on a section
  // they've never touched. Persisted state wins over the default.
  const [expanded, setExpanded] = useState<boolean>(true);
  useEffect(() => {
    const map = readCollapseMap();
    if (Object.prototype.hasOwnProperty.call(map, id)) setExpanded(map[id]);
  }, [id]);

  const toggle = () => {
    setExpanded(prev => {
      const next = !prev;
      const map = readCollapseMap();
      map[id] = next;
      writeCollapseMap(map);
      return next;
    });
  };

  if (!expanded) {
    return (
      <section className="bg-white border border-zinc-200 rounded-2xl px-5 py-3">
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-bold text-sm text-zinc-700">{title}</h2>
          <button
            type="button"
            onClick={toggle}
            aria-expanded={false}
            aria-controls={`section-body-${id}`}
            aria-label={`Déplier la section ${title}`}
            className="inline-flex items-center justify-center w-7 h-7 rounded-md text-zinc-500 hover:bg-zinc-100 hover:text-zinc-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0052CC]"
          >
            <ChevronDown size={16} aria-hidden="true" className="-rotate-90" />
          </button>
        </div>
      </section>
    );
  }
  return (
    <div id={`section-body-${id}`} className="relative">
      {children}
      <button
        type="button"
        onClick={toggle}
        aria-expanded={true}
        aria-controls={`section-body-${id}`}
        aria-label={`Replier la section ${title}`}
        className="absolute top-3 right-4 inline-flex items-center justify-center w-7 h-7 rounded-md text-zinc-400 hover:bg-zinc-100 hover:text-zinc-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0052CC]"
      >
        <ChevronDown size={16} aria-hidden="true" />
      </button>
    </div>
  );
}

export default function AdminSettings() {
  useDocumentTitle('Paramètres — Admin Vision Affichage');
  const [settings, setSettings] = useState<SettingsState>(DEFAULT_SETTINGS);

  // Hydrate from localStorage on mount. Done in an effect rather than
  // the useState initializer so the initial render matches SSR (we don't
  // SSR today, but this stays consistent with the rest of the codebase).
  useEffect(() => {
    setSettings(readSettings());
  }, []);

  const persist = (next: SettingsState) => {
    // writeLS swallows the quota / private-mode failure — state still
    // works in-memory for the rest of the session.
    writeLS(SETTINGS_KEY, next);
  };

  const toggle = (key: 'twoFactor' | 'newOrderEmail' | 'zapierWebhook') => {
    setSettings(prev => {
      const next = { ...prev, [key]: !prev[key] };
      persist(next);
      return next;
    });
  };

  const updateField = (key: 'companyName' | 'companyNeq' | 'companyEmail' | 'companyPhone', value: string) => {
    setSettings(prev => {
      const next = { ...prev, [key]: value };
      persist(next);
      return next;
    });
  };

  // Aggregate dirty state across subsections. We keep two refs + one
  // state: the ref map holds save callbacks (no re-render on update),
  // the `dirtyIds` state is what drives the banner + beforeunload.
  const saveFnsRef = useRef<Map<string, SaveFn>>(new Map());
  const [dirtyIds, setDirtyIds] = useState<Set<string>>(() => new Set());
  const registry = useMemo<DirtyRegistryCtx>(() => ({
    register: (id, dirty, save) => {
      saveFnsRef.current.set(id, save);
      setDirtyIds(prev => {
        const hasIt = prev.has(id);
        if (dirty && !hasIt) {
          const next = new Set(prev);
          next.add(id);
          return next;
        }
        if (!dirty && hasIt) {
          const next = new Set(prev);
          next.delete(id);
          return next;
        }
        return prev;
      });
    },
    unregister: (id) => {
      saveFnsRef.current.delete(id);
      setDirtyIds(prev => {
        if (!prev.has(id)) return prev;
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    },
  }), []);

  const hasDirty = dirtyIds.size > 0;

  // beforeunload — only attach the listener when there's genuinely
  // unsaved state so we don't spuriously prompt on every tab close.
  useEffect(() => {
    if (!hasDirty) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      // Modern browsers ignore the custom string and show their own
      // generic prompt, but `returnValue` must be set (non-empty) to
      // trigger it. Keep the string for older browsers / IE just in case.
      e.preventDefault();
      e.returnValue = 'Des modifications non enregistrées seront perdues.';
      return e.returnValue;
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [hasDirty]);

  const saveAll = () => {
    // Copy the map values because individual save() calls trigger
    // re-renders + unregister flows that could mutate the map mid-loop.
    const fns = Array.from(saveFnsRef.current.values());
    for (const fn of fns) {
      try {
        fn();
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error('[admin-settings] save failed', err);
      }
    }
  };

  return (
    <DirtyRegistryContext.Provider value={registry}>
    <div className="space-y-6 max-w-3xl">
      {hasDirty ? (
        <div
          role="status"
          aria-live="polite"
          className="sticky top-0 z-40 -mx-1 px-4 py-2.5 bg-amber-50 border border-amber-200 rounded-lg shadow-sm flex items-center justify-between gap-3"
        >
          <div className="flex items-center gap-2 text-sm text-amber-900 min-w-0">
            <AlertTriangle size={16} className="text-amber-600 flex-shrink-0" aria-hidden="true" />
            <span className="font-semibold truncate">
              Modifications non enregistrées
              <span className="text-xs font-normal text-amber-800/80"> · Unsaved changes ({dirtyIds.size})</span>
            </span>
          </div>
          <button
            type="button"
            onClick={saveAll}
            className="inline-flex items-center gap-1.5 bg-[#0052CC] text-white text-xs font-bold px-3 py-1.5 rounded-lg hover:bg-[#0043a8] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0052CC] focus-visible:ring-offset-1 flex-shrink-0"
          >
            <Save size={12} aria-hidden="true" /> Tout enregistrer
          </button>
        </div>
      ) : null}

      <header>
        <h1 className="text-2xl font-extrabold tracking-tight">Paramètres</h1>
        <p className="text-sm text-zinc-500 mt-1">Configurez votre entreprise et vos intégrations</p>
      </header>

      <CollapsibleSection id="company" title="Informations de l'entreprise">
      <section className="bg-white border border-zinc-200 rounded-2xl p-5">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-9 h-9 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
            <Building2 size={18} aria-hidden="true" />
          </div>
          <h2 className="font-bold">Informations de l'entreprise</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <Field label="Nom légal" value={settings.companyName} onChange={v => updateField('companyName', v)} />
          <Field label="NEQ" value={settings.companyNeq} onChange={v => updateField('companyNeq', v)} placeholder="Numéro d'entreprise du Québec" />
          <Field
            label="Courriel général"
            type="email"
            value={settings.companyEmail}
            onChange={v => updateField('companyEmail', v)}
            // If the admin clears the default and types a malformed
            // address, surface it inline — otherwise a bad "support@"
            // silently persists to localStorage and ships with the
            // company profile, which confuses outbound email wiring.
            error={settings.companyEmail.trim().length > 0 && !isValidEmail(settings.companyEmail) ? 'Courriel invalide' : undefined}
          />
          <Field label="Téléphone" value={settings.companyPhone} onChange={v => updateField('companyPhone', v)} />
        </div>
      </section>
      </CollapsibleSection>

      <CollapsibleSection id="shopify" title="Connexion Shopify">
      <section className="bg-white border border-zinc-200 rounded-2xl p-5">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-9 h-9 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
            <Link2 size={18} aria-hidden="true" />
          </div>
          <h2 className="font-bold">Connexion Shopify</h2>
        </div>
        <div className="flex items-center justify-between p-3 bg-zinc-50 rounded-lg">
          <div>
            <div className="font-semibold text-sm">visionaffichage.myshopify.com</div>
            <div className="text-xs text-zinc-500 mt-0.5">Connecté · 22 produits synchronisés</div>
          </div>
          <span className="text-[11px] font-bold px-2 py-1 bg-emerald-100 text-emerald-700 rounded-md">Actif</span>
        </div>
        {/* Link to Shopify's Apps & permissions page since the actual
            permission grants live there — the bare button with no
            onClick used to read as a broken integration. */}
        <a
          href="https://visionaffichage.myshopify.com/admin/apps"
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Gérer les permissions des apps dans Shopify Admin (nouvel onglet)"
          className="mt-3 inline-flex items-center gap-1 text-xs font-bold text-[#0052CC] hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0052CC] focus-visible:ring-offset-1 rounded"
        >
          Gérer les permissions
          <ExternalLink size={11} aria-hidden="true" />
        </a>
      </section>
      </CollapsibleSection>

      <CollapsibleSection id="payments" title="Paiements">
      <section className="bg-white border border-zinc-200 rounded-2xl p-5">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-9 h-9 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
            <CreditCard size={18} aria-hidden="true" />
          </div>
          <h2 className="font-bold">Paiements</h2>
        </div>
        <div className="text-sm text-zinc-600">
          Traitement via Shopify Payments. Configurez les taxes QST/TPS dans l'admin Shopify.
        </div>
      </section>
      </CollapsibleSection>

      <CollapsibleSection id="security" title="Sécurité">
      <section className="bg-white border border-zinc-200 rounded-2xl p-5">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-9 h-9 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center">
            <Shield size={18} aria-hidden="true" />
          </div>
          <h2 className="font-bold">Sécurité</h2>
        </div>
        <div className="space-y-2 text-sm">
          <Toggle label="Authentification à deux facteurs (2FA)" enabled={settings.twoFactor} onToggle={() => toggle('twoFactor')} />
          <Toggle label="Notifications par courriel sur nouvelle commande" enabled={settings.newOrderEmail} onToggle={() => toggle('newOrderEmail')} />
          <Toggle label="Webhook Zapier sur paiement reçu" enabled={settings.zapierWebhook} onToggle={() => toggle('zapierWebhook')} />
        </div>
        <Require2faPolicyRow />
      </section>
      </CollapsibleSection>

      <CollapsibleSection id="taxes" title="Taxes (TPS / TVQ)">
        <TaxesSection />
      </CollapsibleSection>
      <CollapsibleSection id="commissions" title="Commissions">
        <CommissionsSection />
      </CollapsibleSection>
      <CollapsibleSection id="discounts" title="Codes de réduction">
        <DiscountCodesSection />
      </CollapsibleSection>
      <CollapsibleSection id="bulk" title="Rabais quantité">
        <BulkPricingSection />
      </CollapsibleSection>
      <CollapsibleSection id="zapier" title="Intégrations · Zapier → Outlook">
        <ZapierOutlookSection />
      </CollapsibleSection>
      <CollapsibleSection id="backup" title="Sauvegarde · Restauration">
        <BackupRestoreSection />
      </CollapsibleSection>
    </div>
    </DirtyRegistryContext.Provider>
  );
}

// ───────────────────────── Backup / Restore section ─────────────────────────
//
// Task 9.17. The admin surface persists a pile of customisations in
// localStorage — templates, permission overrides, automation flags,
// manual orders, cart reminders, customer notes, etc. Before this
// section there was no way to move that state between browsers, share
// it with another admin, or recover from a corrupted entry short of
// "clear everything and start over." Three buttons:
//
//  - Export: walk localStorage and dump every key starting with
//    `vision-` into a single JSON file with a schemaVersion + an
//    exportedAt timestamp. Filename embeds the date so multiple
//    snapshots on the same machine don't silently overwrite each other
//    in the downloads folder.
//  - Import: file input accepts the same shape, validates it has both
//    schemaVersion and data, then replaces every vision-* key. Gated
//    by a confirm modal so a wrong-file click doesn't wipe the admin's
//    real setup. Page reloads on success because many of these keys
//    are read once at boot (useAppSettings / permission overrides).
//  - Reset: nuclear — clears every vision-* key and reloads. Also
//    behind a confirm modal, with a stronger "you will lose
//    everything" framing so the admin can't mix it up with the import.
//
// Gated on settings:write so salesmen with no settings perms never see
// the buttons. The permission matrix already gates the page itself for
// most non-admin roles, but gating the section too is defence-in-depth
// — a future admin override could in theory grant settings:read
// without settings:write, and the destructive buttons must never be
// reachable in that state.

const BACKUP_SCHEMA_VERSION = 1;
const VISION_KEY_PREFIX = 'vision-';
// localStorage's typical per-origin quota sits at ~5-10 MB. A legit
// backup of vision-* keys is well under 1 MB. Reject anything beyond
// this ceiling so a misdirected click on a huge unrelated file doesn't
// freeze the tab inside FileReader / JSON.parse.
const BACKUP_MAX_BYTES = 10 * 1024 * 1024;

interface BackupFile {
  schemaVersion: number;
  exportedAt: string;
  data: Record<string, string>;
}

// Collect every localStorage entry whose key starts with the `vision-`
// prefix. We preserve the raw string values (not parsed JSON) so that
// whatever serialisation quirks the individual consumers use — nested
// objects, Zustand's `{state, version}` envelope, plain timestamps —
// survive a round-trip exactly.
function collectVisionKeys(): Record<string, string> {
  const out: Record<string, string> = {};
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key || !key.startsWith(VISION_KEY_PREFIX)) continue;
      const value = localStorage.getItem(key);
      if (value !== null) out[key] = value;
    }
  } catch {
    // localStorage can throw in private mode / with a disabled
    // storage partition — returning an empty object lets the caller
    // show an empty-backup toast instead of crashing.
  }
  return out;
}

function todayStamp(): string {
  // Local YYYY-MM-DD (not toISOString, which shifts to UTC and drops
  // a day around midnight in EST). Matches how admins think about
  // "today's snapshot."
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function BackupRestoreSection() {
  const me = useAuthStore(s => s.user);
  const canWrite = useMemo(() => {
    if (!me) return false;
    const role = coerceToPermissionRole(me.role);
    return hasPermission(role, 'settings:write', getUserOverrides(me.id));
  }, [me]);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [pendingImport, setPendingImport] = useState<BackupFile | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);

  const importModalTrapRef = useFocusTrap<HTMLDivElement>(pendingImport !== null);
  const resetModalTrapRef = useFocusTrap<HTMLDivElement>(confirmReset);
  useEscapeKey(pendingImport !== null, useCallback(() => setPendingImport(null), []));
  useEscapeKey(confirmReset, useCallback(() => setConfirmReset(false), []));
  useBodyScrollLock(pendingImport !== null || confirmReset);

  // Don't render at all if the current user can't write settings —
  // returning null keeps the section off the page entirely rather than
  // showing disabled buttons, which would be misleading.
  if (!canWrite) return null;

  const onExport = () => {
    const data = collectVisionKeys();
    const count = Object.keys(data).length;
    if (count === 0) {
      toast.info('Aucune donnée à sauvegarder · No data to back up');
      return;
    }
    const backup: BackupFile = {
      schemaVersion: BACKUP_SCHEMA_VERSION,
      exportedAt: new Date().toISOString(),
      data,
    };
    try {
      const blob = new Blob([JSON.stringify(backup, null, 2)], {
        type: 'application/json',
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `vision-backup-${todayStamp()}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      // Revoke after a tick so the download starts. Without the
      // timeout Safari occasionally cancels because the blob URL
      // is dead before the navigation fires.
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      toast.success(`Sauvegarde exportée · Exported ${count} clés`);
    } catch (err) {
      toast.error('Échec de l\'export · Export failed');
      // eslint-disable-next-line no-console
      console.error('[backup] export failed', err);
    }
  };

  const onPickFile = () => {
    setImportError(null);
    fileInputRef.current?.click();
  };

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    // Always clear the input value so re-picking the same file after
    // an error still fires onChange.
    e.target.value = '';
    if (!file) return;
    if (!/\.json$/i.test(file.name) && file.type !== 'application/json') {
      setImportError('Fichier .json requis · .json file required');
      toast.error('Fichier .json requis · .json file required');
      return;
    }
    if (file.size > BACKUP_MAX_BYTES) {
      setImportError('Fichier trop volumineux · File too large (max 10 MB)');
      toast.error('Fichier trop volumineux · File too large (max 10 MB)');
      return;
    }
    const reader = new FileReader();
    reader.onerror = () => {
      setImportError('Lecture du fichier impossible · Unable to read file');
      toast.error('Lecture du fichier impossible · Unable to read file');
    };
    reader.onload = () => {
      try {
        const text = String(reader.result ?? '');
        const parsed: unknown = JSON.parse(text);
        if (
          !parsed ||
          typeof parsed !== 'object' ||
          Array.isArray(parsed) ||
          typeof (parsed as { schemaVersion?: unknown }).schemaVersion !== 'number' ||
          typeof (parsed as { data?: unknown }).data !== 'object' ||
          (parsed as { data?: unknown }).data === null ||
          Array.isArray((parsed as { data?: unknown }).data)
        ) {
          setImportError('Format de sauvegarde invalide · Invalid backup format');
          toast.error('Format de sauvegarde invalide · Invalid backup format');
          return;
        }
        const backup = parsed as BackupFile;
        // Coerce values to strings — the file could have been edited
        // by hand and landed a number/object in there. writeLS on a
        // non-string would serialise weirdly and break the consumer.
        const cleaned: Record<string, string> = {};
        for (const [k, v] of Object.entries(backup.data)) {
          if (!k.startsWith(VISION_KEY_PREFIX)) continue;
          cleaned[k] = typeof v === 'string' ? v : JSON.stringify(v);
        }
        if (Object.keys(cleaned).length === 0) {
          setImportError('Aucune clé vision-* trouvée · No vision-* keys found');
          toast.error('Aucune clé vision-* trouvée · No vision-* keys found');
          return;
        }
        setPendingImport({
          schemaVersion: backup.schemaVersion,
          exportedAt: typeof backup.exportedAt === 'string' ? backup.exportedAt : '',
          data: cleaned,
        });
      } catch {
        setImportError('JSON invalide · Invalid JSON');
        toast.error('JSON invalide · Invalid JSON');
      }
    };
    reader.readAsText(file);
  };

  const confirmImport = () => {
    if (!pendingImport) return;
    try {
      // Clear existing vision-* keys first so a smaller backup
      // doesn't leave stale entries from the old setup mixed in.
      const existing: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith(VISION_KEY_PREFIX)) existing.push(key);
      }
      for (const key of existing) localStorage.removeItem(key);
      // Write the new keys.
      for (const [k, v] of Object.entries(pendingImport.data)) {
        localStorage.setItem(k, v);
      }
      toast.success('Sauvegarde restaurée · Backup restored');
      // Reload so every in-memory cache (useAppSettings, permission
      // overrides, zustand stores with persist) re-reads from disk.
      setTimeout(() => window.location.reload(), 400);
    } catch (err) {
      toast.error('Échec de la restauration · Restore failed');
      // eslint-disable-next-line no-console
      console.error('[backup] import failed', err);
      setPendingImport(null);
    }
  };

  const confirmResetAll = () => {
    try {
      const existing: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith(VISION_KEY_PREFIX)) existing.push(key);
      }
      for (const key of existing) localStorage.removeItem(key);
      toast.success(`Réinitialisé · Reset (${existing.length} clés)`);
      setTimeout(() => window.location.reload(), 400);
    } catch (err) {
      toast.error('Échec de la réinitialisation · Reset failed');
      // eslint-disable-next-line no-console
      console.error('[backup] reset failed', err);
      setConfirmReset(false);
    }
  };

  return (
    <section className="bg-white border border-zinc-200 rounded-2xl p-5">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-9 h-9 rounded-lg bg-[#1B3A6B]/10 text-[#1B3A6B] flex items-center justify-center">
          <DatabaseBackup size={18} aria-hidden="true" />
        </div>
        <div>
          <h2 className="font-bold">
            Sauvegarde · Restauration{' '}
            <span className="text-xs font-normal text-zinc-500">· Backup · Restore</span>
          </h2>
          <p className="text-xs text-zinc-500 mt-0.5">
            Exporte / importe tous les réglages admin stockés localement ·{' '}
            <span className="italic">Export / import all locally-stored admin settings.</span>
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="flex flex-col gap-2 p-3 bg-zinc-50 rounded-lg border border-zinc-100">
          <div className="flex items-center gap-2 text-sm font-semibold text-zinc-800">
            <Download size={14} className="text-[#0052CC]" aria-hidden="true" />
            Exporter · Export
          </div>
          <p className="text-[11px] text-zinc-500 leading-relaxed">
            Télécharge un fichier JSON contenant toutes les clés{' '}
            <code className="font-mono text-[10px]">vision-*</code>.
          </p>
          <button
            type="button"
            onClick={onExport}
            className="mt-auto inline-flex items-center justify-center gap-1.5 bg-[#0052CC] text-white text-xs font-bold px-3 py-2 rounded-lg hover:bg-[#0043a8] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0052CC] focus-visible:ring-offset-1"
          >
            <Download size={12} aria-hidden="true" /> Télécharger · Download
          </button>
        </div>

        <div className="flex flex-col gap-2 p-3 bg-zinc-50 rounded-lg border border-zinc-100">
          <div className="flex items-center gap-2 text-sm font-semibold text-zinc-800">
            <Upload size={14} className="text-[#1B3A6B]" aria-hidden="true" />
            Importer · Import
          </div>
          <p className="text-[11px] text-zinc-500 leading-relaxed">
            Charge un fichier de sauvegarde et remplace tous les réglages.
          </p>
          <input
            ref={fileInputRef}
            type="file"
            accept="application/json,.json"
            onChange={onFileChange}
            className="hidden"
            aria-label="Fichier de sauvegarde JSON"
          />
          <button
            type="button"
            onClick={onPickFile}
            className="mt-auto inline-flex items-center justify-center gap-1.5 bg-[#1B3A6B] text-white text-xs font-bold px-3 py-2 rounded-lg hover:bg-[#0F2341] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1B3A6B] focus-visible:ring-offset-1"
          >
            <Upload size={12} aria-hidden="true" /> Choisir un fichier · Choose file
          </button>
          {importError ? (
            <p className="text-[11px] text-rose-600 mt-0.5">{importError}</p>
          ) : null}
        </div>

        <div className="flex flex-col gap-2 p-3 bg-rose-50/40 rounded-lg border border-rose-100">
          <div className="flex items-center gap-2 text-sm font-semibold text-rose-900">
            <RotateCcw size={14} className="text-rose-600" aria-hidden="true" />
            Tout réinitialiser · Reset all
          </div>
          <p className="text-[11px] text-rose-700/80 leading-relaxed">
            Efface toutes les clés <code className="font-mono text-[10px]">vision-*</code>. Action irréversible.
          </p>
          <button
            type="button"
            onClick={() => setConfirmReset(true)}
            className="mt-auto inline-flex items-center justify-center gap-1.5 bg-[#DC2626] text-white text-xs font-bold px-3 py-2 rounded-xl hover:bg-[#B91C1C] transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-[#DC2626] focus-visible:ring-offset-1"
          >
            <RotateCcw size={12} aria-hidden="true" /> Réinitialiser · Reset
          </button>
        </div>
      </div>

      {pendingImport ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="backup-import-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
        >
          <div
            ref={importModalTrapRef}
            className="bg-white rounded-2xl shadow-xl border border-zinc-200 max-w-md w-full p-5"
          >
            <div className="flex items-start gap-3 mb-3">
              <div className="w-9 h-9 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center flex-shrink-0">
                <AlertTriangle size={18} aria-hidden="true" />
              </div>
              <div>
                <h3 id="backup-import-title" className="font-bold text-zinc-900">
                  Restaurer la sauvegarde ?
                </h3>
                <p className="text-xs text-zinc-500 mt-0.5 italic">Restore backup?</p>
              </div>
            </div>
            <p className="text-sm text-zinc-700 leading-relaxed">
              Ceci remplacera tous les réglages admin. Continuer ?
            </p>
            <p className="text-xs text-zinc-500 italic mt-1">
              This will replace all admin settings. Continue?
            </p>
            <div className="mt-3 p-2.5 bg-zinc-50 rounded-lg border border-zinc-100 text-[11px] text-zinc-600 space-y-0.5">
              <div>
                <span className="font-semibold">Clés · Keys:</span>{' '}
                {Object.keys(pendingImport.data).length}
              </div>
              {pendingImport.exportedAt ? (
                <div>
                  <span className="font-semibold">Exportée · Exported:</span>{' '}
                  {pendingImport.exportedAt}
                </div>
              ) : null}
              <div>
                <span className="font-semibold">Schéma · Schema:</span>{' '}
                v{pendingImport.schemaVersion}
              </div>
            </div>
            <div className="mt-4 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setPendingImport(null)}
                className="text-xs font-bold px-3 py-2 rounded-lg text-zinc-600 hover:bg-zinc-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400"
              >
                Annuler · Cancel
              </button>
              <button
                type="button"
                onClick={confirmImport}
                className="inline-flex items-center gap-1.5 bg-[#1B3A6B] text-white text-xs font-bold px-3 py-2 rounded-lg hover:bg-[#0F2341] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1B3A6B] focus-visible:ring-offset-1"
              >
                <Upload size={12} aria-hidden="true" /> Restaurer · Restore
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {confirmReset ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="backup-reset-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
        >
          <div
            ref={resetModalTrapRef}
            className="bg-white rounded-2xl shadow-xl border border-zinc-200 max-w-md w-full p-5"
          >
            <div className="flex items-start gap-3 mb-3">
              <div className="w-9 h-9 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center flex-shrink-0">
                <AlertTriangle size={18} aria-hidden="true" />
              </div>
              <div>
                <h3 id="backup-reset-title" className="font-bold text-zinc-900">
                  Tout réinitialiser ?
                </h3>
                <p className="text-xs text-zinc-500 mt-0.5 italic">Reset everything?</p>
              </div>
            </div>
            <p className="text-sm text-zinc-700 leading-relaxed">
              Ceci effacera tous les réglages admin, modèles, surcharges de permissions et données locales.
              Action irréversible.
            </p>
            <p className="text-xs text-zinc-500 italic mt-1">
              This will wipe all admin settings, templates, permission overrides, and local data. This cannot be undone.
            </p>
            <div className="mt-4 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirmReset(false)}
                className="text-xs font-bold px-3 py-2 rounded-lg text-zinc-600 hover:bg-zinc-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400"
              >
                Annuler · Cancel
              </button>
              <button
                type="button"
                onClick={confirmResetAll}
                className="inline-flex items-center gap-1.5 bg-[#DC2626] text-white text-xs font-bold px-3 py-2 rounded-xl hover:bg-[#B91C1C] transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-[#DC2626] focus-visible:ring-offset-1"
              >
                <RotateCcw size={12} aria-hidden="true" /> Tout effacer · Wipe all
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}

// ───────────────────────── Commissions section ─────────────────────────
//
// Single knob: the commission rate paid to salesmen per order. Stored
// as a fraction in appSettings.commissionRate; entered here as a percent
// so admins think in whole numbers. Validated into [0, 50]% — the
// upstream clamp in saveSettings already stops > 50 %, but we surface
// the same bound here so the input gives immediate feedback instead of
// silently clamping the stored value.

function CommissionsSection() {
  const settings = useAppSettings();
  const [ratePct, setRatePct] = useState<string>(
    String((settings.commissionRate * 100).toFixed(2)).replace(/\.?0+$/, ''),
  );
  const [savedAt, setSavedAt] = useState<number | null>(null);

  // Keep in sync with cross-tab updates.
  useEffect(() => {
    setRatePct(String((settings.commissionRate * 100).toFixed(2)).replace(/\.?0+$/, ''));
  }, [settings.commissionRate]);

  const rateNum = Number(ratePct);
  const rateError = !Number.isFinite(rateNum) || rateNum < 0 || rateNum > 50;
  const dirty = Math.abs(rateNum / 100 - settings.commissionRate) > 1e-9;

  // $100 order preview so the admin sees the commission impact in
  // dollar terms before committing the change.
  const previewBase = 100;
  const previewCommission = (Number.isFinite(rateNum) ? rateNum : 0) / 100 * previewBase;

  const save = () => {
    if (rateError) return;
    saveAppSettings({ commissionRate: rateNum / 100 });
    setSavedAt(Date.now());
    logAdminAction('settings.save', { section: 'commissions', commissionRate: rateNum / 100 });
  };

  // Only register as dirty when the form is actually saveable — a
  // rateError would block save() so the banner's "Tout enregistrer"
  // should not claim it has something to persist here.
  useRegisterDirty('commissions', dirty && !rateError, save);

  const resetDefault = () => {
    setRatePct(String((DEFAULT_APP_SETTINGS.commissionRate * 100).toFixed(2)).replace(/\.?0+$/, ''));
  };

  return (
    <section className="bg-white border border-zinc-200 rounded-2xl p-5">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-9 h-9 rounded-lg bg-[#E8A838]/20 text-[#B37D10] flex items-center justify-center">
          <DollarSign size={18} aria-hidden="true" />
        </div>
        <div>
          <h2 className="font-bold">Commissions <span className="text-xs font-normal text-zinc-500">· Commissions</span></h2>
          <p className="text-xs text-zinc-500 mt-0.5">
            Taux payé aux vendeurs sur chaque commande créditée ·{' '}
            <span className="italic">Rate paid to salesmen per credited order.</span>
          </p>
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <NumberField
          label="Taux de commission % · Commission rate %"
          value={ratePct}
          onChange={setRatePct}
          min={0}
          max={50}
          step={0.1}
          error={rateError ? 'Entre 0 et 50 · Between 0 and 50' : undefined}
        />
      </div>
      <div className="mt-3 p-3 bg-[#E8A838]/10 border border-[#E8A838]/30 rounded-lg text-xs text-[#4a3509]">
        <div className="font-bold mb-1">Exemple · commande de 100 $ · Example · $100 order</div>
        <div>Commission: {previewCommission.toFixed(2)} $ ({(Number.isFinite(rateNum) ? rateNum : 0).toFixed(2)} %)</div>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={save}
          disabled={rateError || !dirty}
          className="inline-flex items-center gap-1.5 bg-[#0052CC] text-white text-xs font-bold px-3 py-2 rounded-lg hover:bg-[#0043a8] disabled:opacity-40 disabled:cursor-not-allowed focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0052CC] focus-visible:ring-offset-1"
        >
          <Save size={12} aria-hidden="true" /> Enregistrer · Save
        </button>
        <button
          type="button"
          onClick={resetDefault}
          className="text-xs font-semibold text-zinc-500 hover:text-zinc-800 underline underline-offset-2"
        >
          Réinitialiser (10 %) · Reset (10%)
        </button>
        <SavedToast savedAt={savedAt} dirty={dirty} />
      </div>
    </section>
  );
}

// ───────────────────────── Zapier Outlook webhook section ─────────────────────────
//
// The admin pastes the "Catch Hook" URL from their Zap here. Stored
// client-side only (`vision-zapier-mail-webhook` localStorage key) so
// we never bake a personal endpoint into the bundle. The URL is used
// by sendTestEmail() in @/lib/outlook.ts. A build-time
// VITE_ZAPIER_MAIL_WEBHOOK env var takes precedence when set, in which
// case we grey out the input + explain that it's being overridden.

function ZapierOutlookSection() {
  const envUrl = typeof import.meta !== 'undefined'
    ? (import.meta as { env?: Record<string, string | undefined> }).env?.VITE_ZAPIER_MAIL_WEBHOOK
    : undefined;
  const envOverride = typeof envUrl === 'string' && envUrl.trim().length > 0 ? envUrl.trim() : null;

  const [url, setUrl] = useState<string>(() => getConfiguredWebhook() ?? '');
  const [savedAt, setSavedAt] = useState<number | null>(null);

  // Basic URL shape check — we don't call out to verify the Zap is
  // actually live (no CORS-friendly preflight from Zapier's side), but
  // we can at least stop obviously-broken strings before they land on
  // disk and silently fail every test send.
  const trimmed = url.trim();
  const invalidUrl = trimmed.length > 0 && !(() => {
    try {
      const u = new URL(trimmed);
      return u.protocol === 'https:';
    } catch {
      return false;
    }
  })();

  const persisted = getConfiguredWebhook() ?? '';
  const dirty = trimmed !== persisted && !envOverride;

  const save = () => {
    if (invalidUrl || envOverride) return;
    setConfiguredWebhook(trimmed.length > 0 ? trimmed : null);
    setSavedAt(Date.now());
  };

  useRegisterDirty('zapier-outlook', dirty && !invalidUrl, save);

  return (
    <section className="bg-white border border-zinc-200 rounded-2xl p-5">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-9 h-9 rounded-lg bg-[#E8A838]/20 text-[#1B3A6B] flex items-center justify-center">
          <Mail size={18} aria-hidden="true" />
        </div>
        <div>
          <h2 className="font-bold">Intégrations · Zapier → Outlook</h2>
          <p className="text-xs text-zinc-500 mt-0.5">
            Webhook utilisé par le bouton <strong>Envoyer un test</strong> de l'éditeur de modèles.
          </p>
        </div>
      </div>

      <div className="space-y-2">
        <label htmlFor="zapier-mail-webhook" className="block text-[11px] font-bold text-zinc-500 uppercase tracking-wider">
          URL du webhook « Catch Hook »
        </label>
        <input
          id="zapier-mail-webhook"
          type="url"
          value={envOverride ?? url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://hooks.zapier.com/hooks/catch/..."
          disabled={!!envOverride}
          aria-describedby="zapier-mail-webhook-help"
          aria-invalid={invalidUrl || undefined}
          className={`w-full border rounded-lg px-3 py-2 text-sm font-mono outline-none focus:ring-2 ${
            invalidUrl
              ? 'border-rose-400 focus:border-rose-500 focus:ring-rose-500/10'
              : 'border-zinc-200 focus:border-[#1B3A6B] focus:ring-[#1B3A6B]/10'
          } ${envOverride ? 'bg-zinc-100 text-zinc-500 cursor-not-allowed' : 'bg-white'}`}
        />
        {invalidUrl && (
          <p className="text-[11px] text-rose-600">URL invalide (https:// requis).</p>
        )}
        <p id="zapier-mail-webhook-help" className="text-[11px] text-zinc-500 leading-relaxed">
          Crée un Zap avec trigger <em>Webhooks by Zapier → Catch Hook</em> et action <em>Microsoft Outlook → Send Email</em>.
          Mappe les champs <code className="font-mono">to</code>, <code className="font-mono">subject</code>, et <code className="font-mono">html</code>{' '}
          depuis la charge utile du webhook. Le corps envoyé inclut aussi <code className="font-mono">sentBy</code> et{' '}
          <code className="font-mono">sentAt</code> pour la traçabilité.
        </p>
        {envOverride && (
          <div className="text-[11px] text-indigo-800 bg-indigo-50 border border-indigo-200 rounded px-2 py-1.5">
            Surchargé par la variable d'environnement <code className="font-mono">VITE_ZAPIER_MAIL_WEBHOOK</code> au moment du build.
            La valeur saisie ici est ignorée tant que la variable est définie.
          </div>
        )}
      </div>

      {!envOverride && (
        <div className="mt-3 flex items-center gap-2">
          <button
            type="button"
            onClick={save}
            disabled={invalidUrl || !dirty}
            className="inline-flex items-center gap-1.5 bg-[#1B3A6B] text-white text-xs font-bold px-3 py-2 rounded-lg hover:bg-[#0F2341] disabled:opacity-40 disabled:cursor-not-allowed focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1B3A6B] focus-visible:ring-offset-1"
          >
            <Save size={12} aria-hidden="true" /> Enregistrer
          </button>
          {url.trim().length > 0 && (
            <button
              type="button"
              onClick={() => { setUrl(''); setConfiguredWebhook(null); setSavedAt(Date.now()); }}
              className="text-[11px] font-semibold text-rose-600 hover:text-rose-800 underline underline-offset-2"
            >
              Effacer
            </button>
          )}
          <SavedToast savedAt={savedAt} dirty={dirty} />
        </div>
      )}
    </section>
  );
}

// ───────────────────────── Taxes section ─────────────────────────
//
// GST + QST are stored as fractions in the persisted settings (0.05,
// 0.09975) but entered as percents here since admins think in whole
// numbers. Validate into [0, 30]% so a fat-finger of 50 doesn't ship a
// 50 % tax rate to production carts — Quebec combined is never above
// ~15 % so 30 leaves plenty of slack without letting absurd values
// through.

function TaxesSection() {
  const settings = useAppSettings();
  const [gstPct, setGstPct] = useState<string>(String((settings.taxGst * 100).toFixed(3)).replace(/\.?0+$/, ''));
  const [qstPct, setQstPct] = useState<string>(String((settings.taxQst * 100).toFixed(3)).replace(/\.?0+$/, ''));
  const [savedAt, setSavedAt] = useState<number | null>(null);

  // Keep local inputs in sync when the settings store updates from
  // another tab — without this the form would silently overwrite a
  // remote change on the next click.
  useEffect(() => {
    setGstPct(String((settings.taxGst * 100).toFixed(3)).replace(/\.?0+$/, ''));
    setQstPct(String((settings.taxQst * 100).toFixed(3)).replace(/\.?0+$/, ''));
  }, [settings.taxGst, settings.taxQst]);

  const gstNum = Number(gstPct);
  const qstNum = Number(qstPct);
  const gstError = !Number.isFinite(gstNum) || gstNum < 0 || gstNum > 30;
  const qstError = !Number.isFinite(qstNum) || qstNum < 0 || qstNum > 30;
  const hasError = gstError || qstError;
  const dirty = Math.abs(gstNum / 100 - settings.taxGst) > 1e-9 || Math.abs(qstNum / 100 - settings.taxQst) > 1e-9;

  const combined = (Number.isFinite(gstNum) ? gstNum : 0) + (Number.isFinite(qstNum) ? qstNum : 0);
  const previewTax = (100 * combined) / 100; // $ of tax on a $100 order
  const previewTotal = 100 + previewTax;

  const save = () => {
    if (hasError) return;
    saveAppSettings({ taxGst: gstNum / 100, taxQst: qstNum / 100 });
    setSavedAt(Date.now());
    // Task 9.19 — audit trail. Keep `section` stable so future
    // settings-surface changes can surface a "what changed?" filter.
    logAdminAction('settings.save', {
      section: 'taxes',
      taxGst: gstNum / 100,
      taxQst: qstNum / 100,
    });
  };

  useRegisterDirty('taxes', dirty && !hasError, save);

  return (
    <section className="bg-white border border-zinc-200 rounded-2xl p-5">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-9 h-9 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
          <Percent size={18} aria-hidden="true" />
        </div>
        <div>
          <h2 className="font-bold">Taxes (TPS / TVQ)</h2>
          <p className="text-xs text-zinc-500 mt-0.5">Appliquées sur chaque commande côté checkout local.</p>
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <NumberField
          label="TPS (GST) %"
          value={gstPct}
          onChange={setGstPct}
          min={0}
          max={30}
          step={0.001}
          error={gstError ? 'Entre 0 et 30' : undefined}
        />
        <NumberField
          label="TVQ (QST) %"
          value={qstPct}
          onChange={setQstPct}
          min={0}
          max={30}
          step={0.001}
          error={qstError ? 'Entre 0 et 30' : undefined}
        />
      </div>
      <div className="mt-3 p-3 bg-indigo-50/60 border border-indigo-100 rounded-lg text-xs text-indigo-900">
        <div className="font-bold mb-1">Exemple · commande de 100 $</div>
        <div>Taxes: {previewTax.toFixed(2)} $ (taux combiné {combined.toFixed(3)} %)</div>
        <div>Total: {previewTotal.toFixed(2)} $</div>
      </div>
      <div className="mt-3 flex items-center gap-2">
        <button
          type="button"
          onClick={save}
          disabled={hasError || !dirty}
          className="inline-flex items-center gap-1.5 bg-[#0052CC] text-white text-xs font-bold px-3 py-2 rounded-lg hover:bg-[#0043a8] disabled:opacity-40 disabled:cursor-not-allowed focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0052CC] focus-visible:ring-offset-1"
        >
          <Save size={12} aria-hidden="true" /> Enregistrer
        </button>
        <SavedToast savedAt={savedAt} dirty={dirty} />
      </div>
    </section>
  );
}

// ───────────────────────── Discount codes section ─────────────────────────
//
// Admin table of code → rate. Add row appends to the staged map; Save
// flushes to localStorage through saveAppSettings which re-sanitizes
// (uppercases + clamps + drops zero-rate rows). Delete is guarded by a
// best-effort check of the active cart's discountCode — if the code
// the admin is about to nuke is applied on >0 carts we warn before
// proceeding. We only see the *current browser's* cart (there is no
// multi-user cart registry client-side), so this is advisory, not
// enforcement.

type DiscountRow = { id: string; code: string; pct: string };

function countActiveCartsUsing(code: string): number {
  // Best-effort: peek at vision-cart persisted by localCartStore. In
  // production this would hit a server-side count; here we just see
  // whether the code is live in the current browser's cart.
  if (!code) return 0;
  try {
    const raw = localStorage.getItem('vision-cart');
    if (!raw) return 0;
    const parsed = JSON.parse(raw);
    const active = parsed?.state?.discountCode;
    const applied = parsed?.state?.discountApplied;
    return applied && typeof active === 'string' && active.toUpperCase() === code.toUpperCase() ? 1 : 0;
  } catch {
    return 0;
  }
}

function DiscountCodesSection() {
  const settings = useAppSettings();
  const [rows, setRows] = useState<DiscountRow[]>(() =>
    Object.entries(settings.discountCodes).map(([code, rate], i) => ({
      id: `r-${i}-${code}`,
      code,
      pct: String((rate * 100).toFixed(2)).replace(/\.?0+$/, ''),
    })),
  );
  const [savedAt, setSavedAt] = useState<number | null>(null);

  // Resync local rows when the persisted settings change from
  // elsewhere (cross-tab edit). We overwrite unsaved edits to avoid
  // merging conflicts silently — the admin can re-apply if needed.
  useEffect(() => {
    setRows(
      Object.entries(settings.discountCodes).map(([code, rate], i) => ({
        id: `r-${i}-${code}`,
        code,
        pct: String((rate * 100).toFixed(2)).replace(/\.?0+$/, ''),
      })),
    );
  }, [settings.discountCodes]);

  const validation = useMemo(() => {
    const seen = new Set<string>();
    const issues: Record<string, string> = {};
    for (const r of rows) {
      const code = r.code.trim().toUpperCase();
      const pctNum = Number(r.pct);
      if (!code) issues[r.id] = 'Code requis';
      else if (!/^[A-Z0-9_-]{2,32}$/.test(code)) issues[r.id] = '2-32 car. A-Z 0-9 _ -';
      else if (seen.has(code)) issues[r.id] = 'Doublon';
      else if (!Number.isFinite(pctNum) || pctNum <= 0 || pctNum >= 100) issues[r.id] = '0 < % < 100';
      seen.add(code);
    }
    return issues;
  }, [rows]);
  const hasError = Object.keys(validation).length > 0;

  const updateRow = (id: string, patch: Partial<DiscountRow>) => {
    setRows(rs => rs.map(r => (r.id === id ? { ...r, ...patch } : r)));
  };

  const addRow = () => {
    setRows(rs => [...rs, { id: `r-${Date.now()}`, code: '', pct: '10' }]);
  };

  const removeRow = (id: string) => {
    const target = rows.find(r => r.id === id);
    if (target) {
      const using = countActiveCartsUsing(target.code);
      if (using > 0) {
        const ok = window.confirm(
          `Le code ${target.code} est actuellement appliqué sur ${using} panier. Supprimer quand même ?`,
        );
        if (!ok) return;
      }
    }
    setRows(rs => rs.filter(r => r.id !== id));
  };

  const save = () => {
    if (hasError) return;
    const next: Record<string, number> = {};
    for (const r of rows) {
      const code = r.code.trim().toUpperCase();
      const rate = Number(r.pct) / 100;
      if (code && rate > 0 && rate < 1) next[code] = rate;
    }
    saveAppSettings({ discountCodes: next });
    setSavedAt(Date.now());
  };

  // Hoisted below the `dirty` memo.

  const resetToDefaults = () => {
    setRows(
      Object.entries(DEFAULT_APP_SETTINGS.discountCodes).map(([code, rate], i) => ({
        id: `r-${i}-${code}`,
        code,
        pct: String((rate * 100).toFixed(2)).replace(/\.?0+$/, ''),
      })),
    );
  };

  // Compute dirty by comparing staged row map vs persisted map.
  const dirty = useMemo(() => {
    const current: Record<string, number> = {};
    for (const r of rows) {
      const code = r.code.trim().toUpperCase();
      const rate = Number(r.pct) / 100;
      if (code && rate > 0 && rate < 1) current[code] = rate;
    }
    const a = Object.entries(current).sort(([x], [y]) => x.localeCompare(y));
    const b = Object.entries(settings.discountCodes).sort(([x], [y]) => x.localeCompare(y));
    if (a.length !== b.length) return true;
    for (let i = 0; i < a.length; i++) {
      if (a[i][0] !== b[i][0]) return true;
      if (Math.abs(a[i][1] - b[i][1]) > 1e-9) return true;
    }
    return false;
  }, [rows, settings.discountCodes]);

  useRegisterDirty('discounts', dirty && !hasError, save);

  return (
    <section className="bg-white border border-zinc-200 rounded-2xl p-5">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-9 h-9 rounded-lg bg-fuchsia-50 text-fuchsia-600 flex items-center justify-center">
          <Tag size={18} aria-hidden="true" />
        </div>
        <div>
          <h2 className="font-bold">Codes de réduction</h2>
          <p className="text-xs text-zinc-500 mt-0.5">Lu par le panier à chaque tentative d'application.</p>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-[11px] font-bold text-zinc-500 uppercase tracking-wider border-b border-zinc-200">
              <th className="pb-2 pr-3">Code</th>
              <th className="pb-2 pr-3 w-32">Rabais (%)</th>
              <th className="pb-2 pr-3">Exemple · 100 $</th>
              <th className="pb-2 w-10" aria-label="Actions" />
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={4} className="py-4 text-center text-xs text-zinc-500">
                  Aucun code. Ajoutez-en un ci-dessous.
                </td>
              </tr>
            ) : (
              rows.map(r => {
                const pctNum = Number(r.pct);
                const preview = Number.isFinite(pctNum) && pctNum > 0 && pctNum < 100
                  ? (100 * (1 - pctNum / 100)).toFixed(2) + ' $'
                  : '—';
                const err = validation[r.id];
                return (
                  <tr key={r.id} className="border-b border-zinc-100 last:border-b-0">
                    <td className="py-2 pr-3 align-top">
                      <input
                        aria-label="Code"
                        value={r.code}
                        onChange={e => updateRow(r.id, { code: e.target.value.toUpperCase() })}
                        className={`w-full border rounded-lg px-2 py-1.5 text-sm font-mono tracking-wide uppercase outline-none focus:ring-2 ${err && (err === 'Code requis' || err.startsWith('2-32') || err === 'Doublon') ? 'border-rose-400 focus:border-rose-500 focus:ring-rose-500/10' : 'border-zinc-200 focus:border-[#0052CC] focus:ring-[#0052CC]/10'}`}
                        placeholder="VISION10"
                      />
                    </td>
                    <td className="py-2 pr-3 align-top">
                      <input
                        aria-label="Rabais en pourcent"
                        type="number"
                        min={0}
                        max={100}
                        step={0.01}
                        value={r.pct}
                        onChange={e => updateRow(r.id, { pct: e.target.value })}
                        className={`w-full border rounded-lg px-2 py-1.5 text-sm outline-none focus:ring-2 ${err === '0 < % < 100' ? 'border-rose-400 focus:border-rose-500 focus:ring-rose-500/10' : 'border-zinc-200 focus:border-[#0052CC] focus:ring-[#0052CC]/10'}`}
                      />
                    </td>
                    <td className="py-2 pr-3 align-top text-xs text-zinc-600">
                      <div>Net: <span className="font-semibold">{preview}</span></div>
                      {err ? <div className="text-rose-600 font-semibold mt-0.5">{err}</div> : null}
                    </td>
                    <td className="py-2 align-top">
                      <button
                        type="button"
                        onClick={() => removeRow(r.id)}
                        aria-label={`Supprimer ${r.code || 'ce code'}`}
                        className="inline-flex items-center justify-center w-7 h-7 rounded-md text-zinc-500 hover:bg-rose-50 hover:text-rose-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-500"
                      >
                        <Trash2 size={14} aria-hidden="true" />
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={addRow}
          className="inline-flex items-center gap-1.5 bg-zinc-900 text-white text-xs font-bold px-3 py-2 rounded-lg hover:bg-zinc-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-zinc-900 focus-visible:ring-offset-1"
        >
          <Plus size={12} aria-hidden="true" /> Ajouter un code
        </button>
        <button
          type="button"
          onClick={save}
          disabled={hasError || !dirty}
          className="inline-flex items-center gap-1.5 bg-[#0052CC] text-white text-xs font-bold px-3 py-2 rounded-lg hover:bg-[#0043a8] disabled:opacity-40 disabled:cursor-not-allowed focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0052CC] focus-visible:ring-offset-1"
        >
          <Save size={12} aria-hidden="true" /> Enregistrer
        </button>
        <button
          type="button"
          onClick={resetToDefaults}
          className="text-xs font-semibold text-zinc-500 hover:text-zinc-800 underline underline-offset-2"
        >
          Réinitialiser (VISION10/15/20)
        </button>
        <SavedToast savedAt={savedAt} dirty={dirty} />
      </div>
    </section>
  );
}

// ───────────────────────── Bulk pricing section ─────────────────────────

function BulkPricingSection() {
  const settings = useAppSettings();
  const [threshold, setThreshold] = useState<string>(String(settings.bulkThreshold));
  const [ratePct, setRatePct] = useState<string>(String((settings.bulkRate * 100).toFixed(2)).replace(/\.?0+$/, ''));
  const [savedAt, setSavedAt] = useState<number | null>(null);

  useEffect(() => {
    setThreshold(String(settings.bulkThreshold));
    setRatePct(String((settings.bulkRate * 100).toFixed(2)).replace(/\.?0+$/, ''));
  }, [settings.bulkThreshold, settings.bulkRate]);

  const thrNum = Number(threshold);
  const rateNum = Number(ratePct);
  const thrError = !Number.isFinite(thrNum) || thrNum < 1 || thrNum > 10_000 || !Number.isInteger(thrNum);
  const rateError = !Number.isFinite(rateNum) || rateNum <= 0 || rateNum >= 95;
  const hasError = thrError || rateError;
  const dirty = thrNum !== settings.bulkThreshold || Math.abs(rateNum / 100 - settings.bulkRate) > 1e-9;

  // Preview: what a $20 unit costs at threshold+ units.
  const unit = 20;
  const discountedUnit = unit * (1 - (Number.isFinite(rateNum) ? rateNum : 0) / 100);
  const previewUnits = Number.isFinite(thrNum) ? thrNum : 0;
  const previewTotal = discountedUnit * previewUnits;

  const save = () => {
    if (hasError) return;
    saveAppSettings({ bulkThreshold: thrNum, bulkRate: rateNum / 100 });
    setSavedAt(Date.now());
  };

  useRegisterDirty('bulk', dirty && !hasError, save);

  return (
    <section className="bg-white border border-zinc-200 rounded-2xl p-5">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-9 h-9 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
          <Layers size={18} aria-hidden="true" />
        </div>
        <div>
          <h2 className="font-bold">Rabais quantité</h2>
          <p className="text-xs text-zinc-500 mt-0.5">Seuil de déclenchement et taux appliqué automatiquement.</p>
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <NumberField
          label="Seuil (unités)"
          value={threshold}
          onChange={setThreshold}
          min={1}
          max={10000}
          step={1}
          error={thrError ? 'Entier ≥ 1' : undefined}
        />
        <NumberField
          label="Rabais %"
          value={ratePct}
          onChange={setRatePct}
          min={0.01}
          max={94.99}
          step={0.01}
          error={rateError ? '0 < % < 95' : undefined}
        />
      </div>
      <div className="mt-3 p-3 bg-emerald-50/60 border border-emerald-100 rounded-lg text-xs text-emerald-900">
        <div className="font-bold mb-1">Exemple · unité à 20 $</div>
        <div>À partir de {previewUnits} unités: {discountedUnit.toFixed(2)} $ / unité (au lieu de 20,00 $)</div>
        <div>Total {previewUnits} u.: {previewTotal.toFixed(2)} $ (économie {(unit * previewUnits - previewTotal).toFixed(2)} $)</div>
      </div>
      <div className="mt-3 flex items-center gap-2">
        <button
          type="button"
          onClick={save}
          disabled={hasError || !dirty}
          className="inline-flex items-center gap-1.5 bg-[#0052CC] text-white text-xs font-bold px-3 py-2 rounded-lg hover:bg-[#0043a8] disabled:opacity-40 disabled:cursor-not-allowed focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0052CC] focus-visible:ring-offset-1"
        >
          <Save size={12} aria-hidden="true" /> Enregistrer
        </button>
        <SavedToast savedAt={savedAt} dirty={dirty} />
      </div>
    </section>
  );
}

function NumberField({ label, value, onChange, min, max, step, error }: { label: string; value: string; onChange: (v: string) => void; min?: number; max?: number; step?: number; error?: string }) {
  const id = `admin-num-${label.replace(/[^A-Za-z0-9]+/g, '-').replace(/^-|-$/g, '').toLowerCase()}`;
  const errorId = `${id}-error`;
  return (
    <label htmlFor={id} className="flex flex-col gap-1">
      <span className="text-[11px] font-bold text-zinc-500 uppercase tracking-wider">{label}</span>
      <input
        id={id}
        type="number"
        value={value}
        onChange={e => onChange(e.target.value)}
        min={min}
        max={max}
        step={step}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
        className={`border rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 ${error ? 'border-rose-400 focus:border-rose-500 focus:ring-rose-500/10' : 'border-zinc-200 focus:border-[#0052CC] focus:ring-[#0052CC]/10'}`}
      />
      {error ? <span id={errorId} className="text-[11px] text-rose-600">{error}</span> : null}
    </label>
  );
}

function Field({ label, value, onChange, placeholder, type = 'text', error }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string; type?: string; error?: string }) {
  // Build a stable id so the inline error can be wired via
  // aria-describedby — screen readers then announce "Courriel invalide"
  // alongside the focused field instead of silently styling red.
  const id = `admin-settings-${label.replace(/[^A-Za-z0-9]+/g, '-').replace(/^-|-$/g, '').toLowerCase()}`;
  const errorId = `${id}-error`;
  return (
    <label htmlFor={id} className="flex flex-col gap-1">
      <span className="text-[11px] font-bold text-zinc-500 uppercase tracking-wider">{label}</span>
      <input
        id={id}
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
        className={`border rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 ${error ? 'border-rose-400 focus:border-rose-500 focus:ring-rose-500/10' : 'border-zinc-200 focus:border-[#0052CC] focus:ring-[#0052CC]/10'}`}
      />
      {error ? <span id={errorId} className="text-[11px] text-rose-600">{error}</span> : null}
    </label>
  );
}

// ───────────── Task 9.20 — Require 2FA policy row ─────────────
//
// Sits inside the existing Sécurité section rather than a new section,
// since the row is tightly related to the "2FA" toggle right above it.
// This is the enforcement *policy* — "do admins who haven't enabled
// 2FA get nagged about it on the dashboard?" — not the per-user
// enrolment state, which lives in each user's own profile. Persisted
// through saveSettings so a future backend can read `require2fa` off
// the same surface that already holds tax/commission/bulk knobs.

function Require2faPolicyRow() {
  const settings = useAppSettings();
  const onToggle = () => {
    const next = !settings.require2fa;
    saveAppSettings({ require2fa: next });
    logAdminAction('settings.save', { section: 'security', require2fa: next });
  };
  return (
    <div className="mt-3 p-3 bg-rose-50/50 border border-rose-100 rounded-lg">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-start gap-2 min-w-0">
          <ShieldCheck size={15} className="text-rose-600 mt-0.5 flex-shrink-0" aria-hidden="true" />
          <div className="min-w-0">
            <div className="text-sm font-semibold text-zinc-800" id="require-2fa-label">
              Exiger la 2FA pour tous les comptes admin
              <span className="text-xs font-normal text-zinc-500"> · Require 2FA for all admin accounts</span>
            </div>
            <p className="text-[11px] text-zinc-500 mt-0.5 leading-relaxed">
              La 2FA doit être activée par chaque utilisateur dans son profil avant que cette bascule ait effet.{' '}
              <span className="italic">2FA must be enabled by each user in their profile before this toggle takes effect.</span>
            </p>
          </div>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={settings.require2fa}
          aria-labelledby="require-2fa-label"
          onClick={onToggle}
          className={`relative inline-block w-9 h-5 flex-shrink-0 rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0052CC] focus-visible:ring-offset-1 ${settings.require2fa ? 'bg-[#0052CC]' : 'bg-zinc-300'}`}
        >
          <span
            className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow-md transition-transform ${settings.require2fa ? 'translate-x-[18px]' : 'translate-x-0.5'}`}
            aria-hidden="true"
          />
        </button>
      </div>
    </div>
  );
}

function Toggle({ label, enabled, onToggle }: { label: string; enabled: boolean; onToggle: () => void }) {
  // Build a stable id for the label association — avoid characters that
  // would need escaping in CSS selectors (the toggles include '(2FA)'
  // parens which are valid HTML but messy in querySelector strings).
  const id = `toggle-${label.replace(/[^A-Za-z0-9]+/g, '-').replace(/^-|-$/g, '')}`;
  return (
    <div className="flex items-center justify-between p-3 bg-zinc-50 rounded-lg">
      <span className="text-sm" id={id}>{label}</span>
      <button
        type="button"
        role="switch"
        aria-checked={enabled}
        aria-labelledby={id}
        onClick={onToggle}
        className={`relative inline-block w-9 h-5 rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0052CC] focus-visible:ring-offset-1 ${enabled ? 'bg-[#0052CC]' : 'bg-zinc-300'}`}
      >
        <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow-md transition-transform ${enabled ? 'translate-x-[18px]' : 'translate-x-0.5'}`} aria-hidden="true" />
      </button>
    </div>
  );
}
