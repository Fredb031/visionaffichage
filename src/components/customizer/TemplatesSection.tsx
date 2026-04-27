/**
 * TemplatesSection — Task 4.19 "Enregistrer comme modèle".
 *
 * Tiny reusable panel that lives inside the customizer Récap step. It
 * lets a Vision Affichage B2B user save the NON-blob part of their
 * current customizer config (color + placementSides + product handle)
 * under a friendly name so they can apply that same preset on a later
 * visit without re-picking every dropdown.
 *
 * Intentional scope / constraints:
 *   • No logo blob, no per-size quantity (those live on the main store
 *     with their own persistence). A template is purely the "shape" of
 *     the order, not the artwork itself — the user re-uploads their logo.
 *   • Storage key: `vision-customizer-templates`. FIFO-capped at 10 so
 *     an enthusiastic user can't balloon localStorage with hundreds of
 *     presets and blow past the ~5MB per-origin quota Safari enforces.
 *   • Names are run through sanitizeText (src/lib/sanitize.ts) with a
 *     50-char cap before being persisted — same hygiene we apply to
 *     every other free-text field that goes to disk.
 *   • French-first copy. English labels mirror the rest of the customizer
 *     via the `lang` prop from useLang() in the parent.
 *   • No new deps — readLS/writeLS wrappers + existing sonner toast.
 *
 * UI contract:
 *   • Collapsed into a <details> disclosure so the already-dense Récap
 *     step doesn't get a fifth section at full height. Summary shows
 *     "Mes modèles (N)" where N is the count relevant to THIS product,
 *     or the total count if the "Voir tous" toggle is active.
 *   • Save is inline: clicking "Enregistrer ce modèle" reveals a text
 *     input + confirm/cancel buttons. No `window.prompt` — keeps the
 *     UX flush with the customizer's glassmorphic sheet on mobile, and
 *     avoids the native prompt's awful autofocus steal on iOS.
 *   • Load lists each template with its saved-at relative time + a
 *     small trash icon. Click the row to load, click trash to delete.
 *     The "Voir tous les modèles" toggle shows templates saved for
 *     other products too, with an explicit "pour [handle]" line so
 *     the user isn't surprised when loading cross-product.
 */
import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Save, Trash2, Package } from 'lucide-react';
import { readLS, writeLS } from '@/lib/storage';
import { sanitizeText } from '@/lib/sanitize';
import type { PlacementSides } from '@/types/customization';

/** Key reused across save + load + delete. Exported in case a future
 *  settings page wants to inspect/clear templates without importing the
 *  component itself. */
export const TEMPLATES_KEY = 'vision-customizer-templates';
/** FIFO cap — anything older than the 10th newest template is dropped
 *  on save. Chose 10 because user research on similar "saved presets"
 *  UIs converges on 5-15; 10 is a comfortable middle that still fits
 *  on one screen without scrolling on mobile. */
export const TEMPLATES_CAP = 10;
/** Max characters in a template name. Keep in sync with the input's
 *  `maxLength`, the keystroke `slice` guard, the `sanitizeText` cap,
 *  and the "X/MAX" character counter beneath the input. Lifted to a
 *  single constant so a future bump (e.g. to 80) is one edit, not
 *  four scattered magic numbers that drift apart. */
export const TEMPLATE_NAME_MAX_LENGTH = 50;

export interface CustomizerTemplate {
  /** Time-based unique id; crypto.randomUUID isn't available in every
   *  test/jsdom target, so we fall back to a timestamp+random suffix. */
  id: string;
  /** User-typed, sanitized, 50-char max. Empty names are rejected at
   *  the save-button layer so this is always non-empty on disk. */
  name: string;
  /** Date.now() stamp. Used both for sorting (descending on load) and
   *  for the "il y a X minutes" display. */
  savedAt: number;
  config: {
    /** Shopify handle the template was saved against. We match against
     *  this to filter by "current product" in the load list. Stored
     *  alongside config so the main render can render "pour [handle]"
     *  even in the "voir tous" toggle. */
    handle: string;
    /** Shopify variantId (what the main store persists as `colorId`).
     *  Optional because the user may save before picking a colour —
     *  rare, but the input is still a valid template of "this shape
     *  with no colour set". Applying a template with no colourId is a
     *  no-op on the colour field; other fields still restore. */
    colorId?: string;
    /** Display name of the colour for the UI list (so the row can say
     *  "Black · Front only" without re-resolving the variantId against
     *  the live Shopify catalogue, which may have changed between save
     *  and load). */
    colorName?: string;
    placementSides: PlacementSides;
  };
}

/** Read + validate the persisted list. Defensive parsing: malformed
 *  entries (missing fields, wrong types) are silently dropped instead
 *  of poisoning the UI. */
function loadTemplates(): CustomizerTemplate[] {
  const raw = readLS<unknown>(TEMPLATES_KEY, []);
  if (!Array.isArray(raw)) return [];
  const out: CustomizerTemplate[] = [];
  const validSides = new Set(['none', 'front', 'back', 'both']);
  for (const r of raw) {
    if (!r || typeof r !== 'object') continue;
    const t = r as Partial<CustomizerTemplate>;
    if (typeof t.id !== 'string' || !t.id) continue;
    if (typeof t.name !== 'string' || !t.name) continue;
    if (typeof t.savedAt !== 'number' || !Number.isFinite(t.savedAt)) continue;
    const c = t.config;
    if (!c || typeof c !== 'object') continue;
    if (typeof c.handle !== 'string' || !c.handle) continue;
    if (typeof c.placementSides !== 'string' || !validSides.has(c.placementSides)) continue;
    out.push({
      id: t.id,
      name: t.name,
      savedAt: t.savedAt,
      config: {
        handle: c.handle,
        colorId: typeof c.colorId === 'string' ? c.colorId : undefined,
        colorName: typeof c.colorName === 'string' ? c.colorName : undefined,
        placementSides: c.placementSides as PlacementSides,
      },
    });
  }
  return out;
}

/** Fallback id generator for environments where crypto.randomUUID is
 *  undefined (older Safari, certain jsdom builds). Good enough for an
 *  intra-origin localStorage primary key — collision risk is negligible
 *  at the 10-item cap. */
function makeId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    try { return (crypto as Crypto).randomUUID(); } catch { /* fall through */ }
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

/** French-first "il y a …" formatter. No `Intl.RelativeTimeFormat` —
 *  it's available everywhere we ship, but the output ("il y a 3 minutes")
 *  doesn't match our customizer's brisker tone; the hand-rolled version
 *  below stays compact ("il y a 3 min"). */
function timeAgo(ts: number, lang: 'fr' | 'en'): string {
  const diff = Math.max(0, Date.now() - ts);
  const m = Math.floor(diff / 60_000);
  if (m < 1) return lang === 'en' ? 'just now' : "à l'instant";
  if (m < 60) return lang === 'en' ? `${m} min ago` : `il y a ${m} min`;
  const h = Math.floor(m / 60);
  if (h < 24) return lang === 'en' ? `${h}h ago` : `il y a ${h} h`;
  const d = Math.floor(h / 24);
  if (d < 30) return lang === 'en' ? `${d}d ago` : `il y a ${d} j`;
  // Past a month we give up on the relative format and show the
  // absolute date — "il y a 2 mois" adds noise without precision.
  return new Date(ts).toLocaleDateString(lang === 'en' ? 'en-CA' : 'fr-CA');
}

export interface TemplatesSectionProps {
  /** Shopify handle the customizer is currently running against. Used
   *  to tag the saved template and to filter the load list when the
   *  "Voir tous" toggle is off. */
  handle: string;
  /** Current colour variantId (store.colorId). Optional — rare to save
   *  without one, but we permit it. */
  colorId?: string;
  /** Current colour display name for the row label. */
  colorName?: string;
  /** Current side-count mode. */
  placementSides: PlacementSides;
  /** Apply a loaded template back to the customizer. The parent wires
   *  this to the zustand store's setters; we stay ignorant of the
   *  store shape so this component is re-usable if the store ever
   *  moves. */
  onApply: (config: CustomizerTemplate['config']) => void;
  /** Language for copy. */
  lang: 'fr' | 'en';
}

export function TemplatesSection({
  handle,
  colorId,
  colorName,
  placementSides,
  onApply,
  lang,
}: TemplatesSectionProps) {
  const [templates, setTemplates] = useState<CustomizerTemplate[]>(() => loadTemplates());
  // Save UI state — the inline text input + confirm flow.
  const [saving, setSaving] = useState(false);
  const [draftName, setDraftName] = useState('');
  // Load UI state — "show ALL templates" toggle.
  const [showAll, setShowAll] = useState(false);

  // Memoize the sanitized draft. Without this, the disabled-prop on the
  // Save button re-runs sanitizeText on every render — including every
  // keystroke into other inputs higher in the tree. Cheap to memoize,
  // and it gives handleSave a single source of truth so the "is the
  // button disabled?" and "what gets persisted?" checks can never
  // disagree (e.g. if sanitizeText's behaviour ever became non-pure).
  const cleanDraft = useMemo(
    () => sanitizeText(draftName, { maxLength: TEMPLATE_NAME_MAX_LENGTH }),
    [draftName],
  );

  // Pre-filter for the list. Sort newest-first regardless of filter so
  // the most recently touched template is always on top.
  const visible = useMemo(() => {
    const arr = showAll ? templates : templates.filter(t => t.config.handle === handle);
    return [...arr].sort((a, b) => b.savedAt - a.savedAt);
  }, [templates, handle, showAll]);

  // The disclosure's summary count reflects whichever filter is active
  // so the user sees a consistent number between the summary and the
  // visible rows beneath it.
  const summaryCount = visible.length;

  const persist = (next: CustomizerTemplate[]) => {
    setTemplates(next);
    writeLS(TEMPLATES_KEY, next);
    // If the "Voir tous" toggle is on but no cross-product templates
    // remain, reset it to off — otherwise the state goes stale: the
    // toggle button hides (line ~317 condition) while showAll stays
    // true, and a later cross-product save would re-mount the toggle
    // already in the "on" position with no visual cue. Resetting here
    // keeps the visible filter and the underlying state aligned.
    if (!next.some(t => t.config.handle !== handle)) {
      setShowAll(false);
    }
  };

  const handleSave = () => {
    if (!cleanDraft) {
      toast.error(lang === 'en' ? 'Name cannot be empty' : 'Le nom ne peut pas être vide');
      return;
    }
    const tpl: CustomizerTemplate = {
      id: makeId(),
      name: cleanDraft,
      savedAt: Date.now(),
      config: { handle, colorId, colorName, placementSides },
    };
    // Prepend new, then FIFO-cap: sort by savedAt desc and slice. The
    // sort is a belt-and-braces move — new templates are always "now"
    // so prepending would be enough, but we re-sort so a devtools edit
    // that lands an out-of-order blob still ends with a clean cap.
    const combined = [tpl, ...templates].sort((a, b) => b.savedAt - a.savedAt).slice(0, TEMPLATES_CAP);
    persist(combined);
    setSaving(false);
    setDraftName('');
    toast.success(lang === 'en' ? 'Template saved' : 'Modèle enregistré');
  };

  const handleDelete = (id: string) => {
    persist(templates.filter(t => t.id !== id));
    toast.success(lang === 'en' ? 'Template deleted' : 'Modèle supprimé');
  };

  const handleLoad = (tpl: CustomizerTemplate) => {
    onApply(tpl.config);
    toast.success(lang === 'en' ? 'Template loaded' : 'Modèle chargé');
  };

  const placementLabel = (s: PlacementSides): string => {
    if (s === 'none') return lang === 'en' ? 'Blank' : 'Vierge';
    if (s === 'front') return lang === 'en' ? 'Front' : 'Devant';
    if (s === 'back') return lang === 'en' ? 'Back' : 'Dos';
    return lang === 'en' ? 'Front + Back' : 'Devant + Dos';
  };

  return (
    <details className="bg-secondary/60 rounded-xl border border-border group">
      <summary className="flex items-center gap-2 px-3.5 py-2.5 cursor-pointer select-none list-none text-xs font-bold text-foreground hover:bg-secondary/80 rounded-xl transition-colors [&::-webkit-details-marker]:hidden">
        <Package size={13} aria-hidden="true" className="text-primary" />
        <span>{lang === 'en' ? 'My templates' : 'Mes modèles'}</span>
        <span className="text-muted-foreground font-semibold">({summaryCount})</span>
        <span className="ml-auto text-[10px] text-muted-foreground group-open:rotate-180 transition-transform" aria-hidden="true">▾</span>
      </summary>

      <div className="px-3.5 pb-3.5 pt-1 space-y-3">
        {/* ── Save row ─────────────────────────────────────────────── */}
        {!saving ? (
          <button
            type="button"
            onClick={() => setSaving(true)}
            className="w-full flex items-center justify-center gap-1.5 text-[11px] font-bold text-primary border border-primary/30 hover:bg-primary/5 hover:border-primary rounded-lg py-2 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1"
            aria-label={lang === 'en' ? 'Save this template' : 'Enregistrer ce modèle'}
          >
            <Save size={12} aria-hidden="true" />
            {lang === 'en' ? 'Save this template' : 'Enregistrer ce modèle'}
          </button>
        ) : (
          <div className="flex flex-col gap-2 bg-background/60 rounded-lg border border-border p-2.5">
            <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              {lang === 'en' ? 'Template name' : 'Nom du modèle'}
            </label>
            <input
              type="text"
              value={draftName}
              onChange={e => setDraftName(e.target.value.slice(0, TEMPLATE_NAME_MAX_LENGTH))}
              onKeyDown={e => {
                if (e.key === 'Enter') { e.preventDefault(); handleSave(); }
                if (e.key === 'Escape') { setSaving(false); setDraftName(''); }
              }}
              maxLength={TEMPLATE_NAME_MAX_LENGTH}
              autoFocus
              placeholder={lang === 'en' ? 'e.g. Team navy fronts' : 'ex. Équipe marine devant'}
              className="w-full px-2.5 py-1.5 rounded-md border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
              aria-label={lang === 'en' ? 'Template name' : 'Nom du modèle'}
            />
            <div className="flex items-center justify-between gap-2">
              <span className="text-[10px] text-muted-foreground">
                {draftName.length}/{TEMPLATE_NAME_MAX_LENGTH}
              </span>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => { setSaving(false); setDraftName(''); }}
                  className="text-[11px] font-bold text-muted-foreground hover:text-foreground px-2.5 py-1.5 rounded-md transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1"
                >
                  {lang === 'en' ? 'Cancel' : 'Annuler'}
                </button>
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={!cleanDraft}
                  className="text-[11px] font-black bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-30 disabled:cursor-not-allowed px-3 py-1.5 rounded-md transition-opacity focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1"
                >
                  {lang === 'en' ? 'Save' : 'Enregistrer'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── Load row ─────────────────────────────────────────────── */}
        {templates.length > 0 && (
          <>
            <div className="flex items-center justify-between gap-2 pt-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                {lang === 'en' ? 'Load a template' : 'Charger un modèle'}
              </span>
              {/* Only offer the "show all" toggle when there actually
                  exist templates for OTHER products — otherwise it's a
                  dead switch. */}
              {templates.some(t => t.config.handle !== handle) && (
                <button
                  type="button"
                  onClick={() => setShowAll(v => !v)}
                  className="text-[10px] font-bold text-primary hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 rounded"
                  aria-pressed={showAll}
                >
                  {showAll
                    ? (lang === 'en' ? 'Current product only' : 'Ce produit seulement')
                    : (lang === 'en' ? 'Show all templates' : 'Voir tous les modèles')}
                </button>
              )}
            </div>

            {visible.length === 0 ? (
              <p className="text-[11px] text-muted-foreground italic">
                {lang === 'en'
                  ? 'No templates saved for this product yet.'
                  : 'Aucun modèle enregistré pour ce produit pour l\u2019instant.'}
              </p>
            ) : (
              <ul className="space-y-1.5" role="list">
                {visible.map(t => {
                  const crossProduct = t.config.handle !== handle;
                  return (
                    <li
                      key={t.id}
                      className="group/row flex items-center gap-2 bg-background/60 hover:bg-background rounded-lg border border-border px-2.5 py-1.5 transition-colors"
                    >
                      <button
                        type="button"
                        onClick={() => handleLoad(t)}
                        className="flex-1 min-w-0 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 rounded-md"
                        aria-label={lang === 'en' ? `Load template ${t.name}` : `Charger le modèle ${t.name}`}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="font-bold text-xs truncate">{t.name}</span>
                          <span className="text-[10px] text-muted-foreground flex-shrink-0">
                            · {timeAgo(t.savedAt, lang)}
                          </span>
                        </div>
                        <div className="text-[10px] text-muted-foreground mt-0.5 truncate">
                          {t.config.colorName ? `${t.config.colorName} · ` : ''}
                          {placementLabel(t.config.placementSides)}
                          {crossProduct && (
                            <>
                              {' · '}
                              <span className="text-primary/80">
                                {lang === 'en' ? `for ${t.config.handle}` : `pour ${t.config.handle}`}
                              </span>
                            </>
                          )}
                        </div>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(t.id)}
                        aria-label={lang === 'en' ? `Delete template ${t.name}` : `Supprimer le modèle ${t.name}`}
                        className="flex-shrink-0 w-7 h-7 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 flex items-center justify-center transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-destructive focus-visible:ring-offset-1"
                      >
                        <Trash2 size={12} aria-hidden="true" />
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </>
        )}
      </div>
    </details>
  );
}
