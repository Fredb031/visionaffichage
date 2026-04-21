import { useEffect, useMemo, useState } from 'react';
import { Link2, Building2, CreditCard, Shield, ExternalLink, Percent, Tag, Layers, Plus, Trash2, Save } from 'lucide-react';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { isValidEmail } from '@/lib/utils';
import {
  DEFAULT_APP_SETTINGS,
  saveSettings as saveAppSettings,
  useAppSettings,
} from '@/lib/appSettings';

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
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    const parsed = JSON.parse(raw);
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
  } catch {
    return DEFAULT_SETTINGS;
  }
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
    try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(next)); }
    catch { /* private mode — state still works in-memory */ }
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

  return (
    <div className="space-y-6 max-w-3xl">
      <header>
        <h1 className="text-2xl font-extrabold tracking-tight">Paramètres</h1>
        <p className="text-sm text-zinc-500 mt-1">Configurez votre entreprise et vos intégrations</p>
      </header>

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
      </section>

      <TaxesSection />
      <DiscountCodesSection />
      <BulkPricingSection />
    </div>
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
  };

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
        {savedAt && !dirty ? <span className="text-[11px] text-emerald-600 font-semibold">Enregistré</span> : null}
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
        {savedAt && !dirty ? <span className="text-[11px] text-emerald-600 font-semibold">Enregistré</span> : null}
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
        {savedAt && !dirty ? <span className="text-[11px] text-emerald-600 font-semibold">Enregistré</span> : null}
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
