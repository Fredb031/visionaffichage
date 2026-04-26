/**
 * TemplateGallery — Volume II Section 16.1 starter-template picker.
 *
 * Renders the six pre-made placements from src/data/designTemplates.ts
 * as a 4-column grid of square tiles. Click → onApply(template) fires
 * with the full DesignTemplate, leaving placement-state mutation up to
 * the consumer (kept dumb so the same gallery can be dropped into any
 * customizer surface, including a future "design from scratch" wizard).
 *
 * UX contract:
 *   • Section heading "Commence avec un modèle" (FR-first, EN mirror).
 *   • Default view shows ONLY zone === 'front' templates — the four
 *     chest variants. A toggle reveals the back + sleeve entries so the
 *     fold above doesn't get visually noisy on first load.
 *   • Each tile is a square button: aspect-square bg-secondary
 *     rounded-xl, hover ring in primary. Thumbnail is an <img> pointing
 *     at /templates/{id}.svg with onError → fallback to a text initial
 *     (the template name's first letters) so missing assets don't leave
 *     a broken-image glyph on the page.
 *   • Bilingual via the parent-injected useLang() — keeps the gallery
 *     prop-driven, no context import noise here.
 */
import { useMemo, useState } from 'react';
import { TEMPLATES, type DesignTemplate } from '@/data/designTemplates';

export interface TemplateGalleryProps {
  /** Click handler — receives the full template entry so the consumer
   *  can spread x/y/width/rotation into LogoPlacement and route the
   *  zone to the right printZone on the active product. */
  onApply: (template: DesignTemplate) => void;
  /** Bilingual copy. Defaults to French to match the rest of the
   *  customizer when the consumer doesn't pass a lang. */
  lang?: 'fr' | 'en';
  /** Optional: hide the back + sleeve toggle. Useful in a future
   *  "front-only" surface (caps, beanies) where back templates can't
   *  be applied. */
  hideVariantToggle?: boolean;
}

/** First-letter fallback for a missing thumbnail. Keeps the tile from
 *  collapsing to whitespace while preserving keyboard reachability. */
function thumbInitials(name: string): string {
  const parts = name.split(/[\s—-]+/).filter(Boolean);
  if (parts.length === 0) return '·';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

export function TemplateGallery({
  onApply,
  lang = 'fr',
  hideVariantToggle = false,
}: TemplateGalleryProps) {
  // Default view: front-zone templates only. Toggle reveals the full
  // catalogue (back + sleeve variants).
  const [showAll, setShowAll] = useState(false);

  // Track which thumbnails 404'd so we can swap to the initials fallback
  // without re-attempting the image on every render. Set keyed on id.
  const [missingThumbs, setMissingThumbs] = useState<Set<string>>(() => new Set());

  const visible = useMemo(() => {
    return showAll ? TEMPLATES : TEMPLATES.filter(t => t.zone === 'front');
  }, [showAll]);

  // The toggle is only useful when there ARE non-front templates to
  // surface — keep the future-proofing in case the catalogue becomes
  // all-front for a particular product surface.
  const hasVariants = TEMPLATES.some(t => t.zone !== 'front');

  return (
    <section
      aria-labelledby="va-template-gallery-heading"
      className="space-y-3"
    >
      <div className="flex items-baseline justify-between gap-2">
        <h3
          id="va-template-gallery-heading"
          className="text-sm font-extrabold text-foreground"
        >
          {lang === 'en' ? 'Start with a template' : 'Commence avec un modèle'}
        </h3>
        {!hideVariantToggle && hasVariants && (
          <button
            type="button"
            onClick={() => setShowAll(v => !v)}
            className="text-[10px] font-bold text-primary hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 rounded"
            aria-pressed={showAll}
          >
            {showAll
              ? (lang === 'en' ? 'Front only' : 'Devant seulement')
              : (lang === 'en' ? 'Show back + sleeve' : 'Voir dos + manches')}
          </button>
        )}
      </div>

      <div
        className="grid grid-cols-4 gap-2"
        role="list"
        aria-label={lang === 'en' ? 'Design templates' : 'Modèles de design'}
      >
        {visible.map(tpl => {
          const label = lang === 'en' ? tpl.nameEn : tpl.name;
          const missing = missingThumbs.has(tpl.id);
          return (
            <button
              key={tpl.id}
              type="button"
              role="listitem"
              onClick={() => onApply(tpl)}
              className="group aspect-square bg-secondary rounded-xl flex flex-col items-center justify-center gap-1 p-1.5 hover:ring-2 hover:ring-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-primary transition-all border border-border/60 hover:border-primary/50"
              aria-label={label}
              title={label}
            >
              {missing ? (
                <span
                  aria-hidden="true"
                  className="flex-1 w-full flex items-center justify-center text-base font-black text-muted-foreground/70 group-hover:text-primary transition-colors"
                >
                  {thumbInitials(label)}
                </span>
              ) : (
                <img
                  src={tpl.thumbnail}
                  alt=""
                  loading="lazy"
                  draggable={false}
                  onError={() =>
                    setMissingThumbs(prev => {
                      if (prev.has(tpl.id)) return prev;
                      const next = new Set(prev);
                      next.add(tpl.id);
                      return next;
                    })
                  }
                  className="flex-1 min-h-0 w-full object-contain pointer-events-none select-none"
                />
              )}
              <span className="text-[9px] font-bold text-foreground/80 leading-tight text-center line-clamp-2">
                {label}
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
