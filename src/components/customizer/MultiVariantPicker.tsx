import { Copy, Eraser, Megaphone, Star, Users } from 'lucide-react';
import { Minus, Plus } from 'lucide-react';
import type { Product } from '@/data/products';
import { BULK_DISCOUNT_THRESHOLD, BULK_DISCOUNT_RATE } from '@/data/products';
import { useLang } from '@/lib/langContext';
import type { ShopifyVariantColor } from '@/lib/shopify';

/** Upper clamp on per-size quantity. Prevents a stuck-key / typo from
 * exploding the price math downstream — 1000 per size is already well
 * past any realistic bulk order. */
const MAX_QTY_PER_SIZE = 1000;

export interface VariantQty {
  colorId: string;
  colorName: string;
  hex: string;
  size: string;
  qty: number;
  /** The actual Shopify variant ID for this (color, size) combo — needed
   * for cartLinesAdd at checkout. */
  shopifyVariantId?: string;
  unitPrice?: string;
}

interface Props {
  product: Product;
  /** Colors from Shopify (preferred) or local. The full set drives the
   * "apply same sizes to all" + the bottom summary chips. */
  colors: ShopifyVariantColor[];
  /** The colour the user is currently adding sizes to. Driven by the
   * persistent palette in ProductCustomizer (same picker that swaps the
   * canvas preview) — that's how we keep ONE colour palette doing both
   * the visual preview AND the size selection, instead of two duplicate
   * pickers fighting for the same intent. */
  activeColor: ShopifyVariantColor | null;
  /** Already-picked variants (color × size cells). */
  variants: VariantQty[];
  /** Accepts a value OR a functional updater so the size stepper can
   * do `qty + 1` atomically on the LIVE state — rapid double-clicks
   * on `+` used to both close over the same stale qty and increment by
   * only 1 instead of 2. */
  onChange: React.Dispatch<React.SetStateAction<VariantQty[]>>;
}

export function MultiVariantPicker({ product, colors, activeColor, variants, onChange }: Props) {
  const { lang } = useLang();

  const totalQty = variants.reduce((s, v) => s + v.qty, 0);
  const hasDiscount = totalQty >= BULK_DISCOUNT_THRESHOLD;
  const pct = Math.round(BULK_DISCOUNT_RATE * 100);

  const getQty = (colorId: string, size: string) =>
    variants.find(v => v.colorId === colorId && v.size === size)?.qty ?? 0;

  // Apply the active color's size breakdown to every other picked color.
  // Common request when ordering same mix across multiple colors.
  const applySameSizesToAllColors = () => {
    if (!activeColor) return;
    const activeBreakdown = variants.filter(v => v.colorId === activeColor.variantId);
    if (activeBreakdown.length === 0) return;
    const otherPickedColorIds = Array.from(
      new Set(variants.filter(v => v.colorId !== activeColor.variantId).map(v => v.colorId)),
    );
    if (otherPickedColorIds.length === 0) return;
    // Start from variants that are NOT in the "other" colors — we'll rebuild their lines.
    let next = variants.filter(v => !otherPickedColorIds.includes(v.colorId));
    for (const otherId of otherPickedColorIds) {
      const otherColor = colors.find(c => c.variantId === otherId);
      if (!otherColor) continue;
      for (const line of activeBreakdown) {
        const sizeOpt = otherColor.sizeOptions?.find(s => s.size === line.size);
        if (!sizeOpt || sizeOpt.available === false) continue;
        next = [
          ...next,
          {
            colorId: otherColor.variantId,
            colorName: otherColor.colorName,
            hex: otherColor.hex,
            size: line.size,
            qty: line.qty,
            shopifyVariantId: sizeOpt.variantId,
            unitPrice: otherColor.price,
          },
        ];
      }
    }
    onChange(next);
  };

  // One-click size distributions. Each preset defines a size → qty map.
  // Applied to the active color AND to every other color that already
  // has at least one unit picked — multi-variant orders usually want the
  // same S/M/L/XL mix duplicated across colors, not only on one row.
  type SizeDist = Record<string, number>;
  interface Preset {
    id: string;
    labelFr: string;
    labelEn: string;
    icon: typeof Users;
    dist: SizeDist;
  }
  const PRESETS: Preset[] = [
    { id: 'team12', labelFr: 'Équipe 12', labelEn: 'Team 12', icon: Users, dist: { S: 4, M: 4, L: 4 } },
    { id: 'event36', labelFr: 'Événement 36', labelEn: 'Event 36', icon: Megaphone, dist: { S: 6, M: 12, L: 12, XL: 6 } },
    { id: 'conf50', labelFr: 'Conférence 50', labelEn: 'Conference 50', icon: Star, dist: { S: 5, M: 15, L: 15, XL: 10, XXL: 5 } },
  ];

  // The colors we'll apply the preset across: the active color always,
  // plus any other color that already has quantities picked (so users
  // who are building a multi-color order get the preset mirrored).
  const targetColorIds = Array.from(new Set([
    activeColor?.variantId,
    ...variants.filter(v => v.qty > 0).map(v => v.colorId),
  ].filter((x): x is string => Boolean(x))));

  // A preset is available only if every (targetColor, size) combo in
  // the distribution exists and is in stock. This is the closest proxy
  // we have to SanMar stock — `available` reflects Shopify inventory
  // which mirrors SanMar stock via the sync.
  const presetAvailable = (p: Preset) => {
    for (const colorId of targetColorIds) {
      const color = colors.find(c => c.variantId === colorId);
      if (!color) return false;
      for (const size of Object.keys(p.dist)) {
        const opt = color.sizeOptions?.find(s => s.size === size);
        if (!opt || opt.available === false) return false;
      }
    }
    return true;
  };

  const applyPreset = (p: Preset) => {
    if (!activeColor) return;
    const applyToIds = targetColorIds.length > 0 ? targetColorIds : [activeColor.variantId];
    // Strip out any existing lines for the target colors — the preset
    // REPLACES the distribution on those rows rather than stacking on
    // top, which matches the mental model of a "one-click setup".
    let next = variants.filter(v => !applyToIds.includes(v.colorId));
    for (const colorId of applyToIds) {
      const color = colors.find(c => c.variantId === colorId);
      if (!color) continue;
      for (const [size, qty] of Object.entries(p.dist)) {
        const opt = color.sizeOptions?.find(s => s.size === size);
        if (!opt || opt.available === false) continue;
        next = [
          ...next,
          {
            colorId: color.variantId,
            colorName: color.colorName,
            hex: color.hex,
            size,
            qty,
            shopifyVariantId: opt.variantId,
            unitPrice: color.price,
          },
        ];
      }
    }
    onChange(next);
  };

  const clearAllSizes = () => {
    // Wipe every row — "Effacer" is a full reset, not just the active
    // color, because presets also operate across all active colors.
    // Guard with a confirm when there's a non-trivial pick so a misclick
    // doesn't wipe a painstakingly-built multi-color order.
    if (totalQty > 0) {
      const msg = lang === 'en' ? 'Clear quantities?' : 'Effacer les quantités ?';
      if (typeof window !== 'undefined' && !window.confirm(msg)) return;
    }
    onChange([]);
  };

  const adjustQty = (color: ShopifyVariantColor | null, size: string, nextQtyFn: (curr: number) => number) => {
    if (!color) return;
    // Functional update reads the CURRENT variants at commit time, not
    // the closure's snapshot. Rapid double-click on +/- stepper now
    // applies both clicks against live state instead of both closing
    // over qty=N and each producing qty=N+1.
    onChange(prev => {
      const current = prev.find(v => v.colorId === color.variantId && v.size === size)?.qty ?? 0;
      const nextQty = Math.max(0, Math.min(MAX_QTY_PER_SIZE, nextQtyFn(current)));
      const filtered = prev.filter(v => !(v.colorId === color.variantId && v.size === size));
      if (nextQty <= 0) return filtered;
      const sizeOpt = color.sizeOptions?.find(s => s.size === size);
      return [
        ...filtered,
        {
          colorId: color.variantId,
          colorName: color.colorName,
          hex: color.hex,
          size,
          qty: nextQty,
          shopifyVariantId: sizeOpt?.variantId,
          unitPrice: color.price,
        },
      ];
    });
  };

  // Group variants by color for the summary chips
  const colorGroups = colors
    .map(c => ({
      color: c,
      qty: variants.filter(v => v.colorId === c.variantId).reduce((s, v) => s + v.qty, 0),
    }))
    .filter(g => g.qty > 0);

  if (!activeColor || colors.length === 0) {
    return (
      <div className="text-xs text-muted-foreground text-center py-4">
        {lang === 'en' ? 'No colors available' : 'Aucune couleur disponible'}
      </div>
    );
  }

  // Visual progress toward the bulk-discount threshold — closes the
  // "just a text hint" gap with a real filling bar.
  const progressPct = Math.min(100, (totalQty / BULK_DISCOUNT_THRESHOLD) * 100);
  const unitsLeft = Math.max(0, BULK_DISCOUNT_THRESHOLD - totalQty);

  return (
    <div className="space-y-4">
      {/* Discount banner + progress bar. The secondary line makes it
          explicit that the discount is calculated on ALL picked colors
          combined — common point of confusion per the audit. */}
      <div className={`relative overflow-hidden rounded-xl border px-3 py-2.5 text-xs font-bold transition-all ${
        hasDiscount ? 'bg-emerald-600/10 text-emerald-700 border-emerald-600/30' : 'bg-secondary text-muted-foreground border-border'
      }`}>
        <div className="flex items-center justify-between relative z-10">
          <span>
            {hasDiscount
              ? (lang === 'en' ? `${pct}% discount applied!` : `${pct}% de rabais appliqué !`)
              : (lang === 'en'
                  ? `${unitsLeft} more unit${unitsLeft !== 1 ? 's' : ''} to unlock -${pct}%`
                  : `${unitsLeft} unité${unitsLeft !== 1 ? 's' : ''} de plus pour -${pct}%`)}
          </span>
          <span className="font-black">
            {totalQty} {lang === 'en' ? (totalQty !== 1 ? 'units' : 'unit') : (totalQty !== 1 ? 'unités' : 'unité')}
          </span>
        </div>
        <div
          className="mt-2 h-1.5 rounded-full bg-black/5 overflow-hidden"
          role="progressbar"
          aria-valuenow={Math.round(progressPct)}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={lang === 'en' ? 'Bulk discount progress' : 'Progression du rabais'}
        >
          <div
            className={`h-full transition-all duration-500 ease-out ${
              hasDiscount ? 'bg-emerald-600' : 'bg-primary'
            }`}
            style={{ width: `${progressPct}%` }}
            aria-hidden="true"
          />
        </div>
        <div className="mt-1.5 text-[10px] font-normal opacity-75">
          {lang === 'en'
            ? 'Units are counted across ALL colors you pick.'
            : 'Les unités comptent toutes couleurs confondues.'}
        </div>
      </div>

      {/* Active colour reminder — points users back to the persistent
          palette above whenever they want to add sizes for a different
          colour. Replaces the duplicate swatch row that used to live
          here and confused users into thinking they had to re-pick the
          colour twice. */}
      <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-secondary/60 border border-border">
        <span
          className="w-5 h-5 rounded-full ring-2 ring-primary ring-offset-1 flex-shrink-0"
          style={{ background: activeColor.hex }}
          aria-hidden="true"
        />
        <div className="flex-1 min-w-0">
          <div className="text-[11px] font-bold text-foreground truncate">{activeColor.colorName}</div>
          <div className="text-[10px] text-muted-foreground">
            {lang === 'en'
              ? 'Adding sizes for this colour. Pick another above to switch.'
              : 'Tu ajoutes les tailles pour cette couleur. Choisis-en une autre ci-haut pour changer.'}
          </div>
        </div>
      </div>

      {/* One-click preset distributions for common order sizes. Replaces
          the tedious manual +/+/+ work when a user knows they're buying
          for a team of 12 or a 50-person conference. Applies to the
          active color AND any other colors with picked units. */}
      <div>
        <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5">
          {lang === 'en' ? 'Quick presets' : 'Modèles rapides'}
        </div>
        <div className="flex flex-wrap gap-1.5">
          {PRESETS.map(p => {
            const available = presetAvailable(p);
            const Icon = p.icon;
            const total = Object.values(p.dist).reduce((a, b) => a + b, 0);
            const soldOutTitle = lang === 'en'
              ? `Some sizes needed for this preset (${total} units) are sold out`
              : `Certaines tailles du modèle (${total} unités) sont épuisées`;
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => applyPreset(p)}
                disabled={!available}
                title={!available ? soldOutTitle : undefined}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full border border-border bg-secondary/60 text-[11px] font-bold text-foreground hover:border-primary hover:bg-primary/5 hover:text-primary disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:border-border disabled:hover:bg-secondary/60 disabled:hover:text-foreground transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1"
              >
                <Icon size={11} aria-hidden="true" />
                {lang === 'en' ? p.labelEn : p.labelFr}
              </button>
            );
          })}
          <button
            type="button"
            onClick={clearAllSizes}
            disabled={variants.length === 0}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full border border-border bg-transparent text-[11px] font-bold text-muted-foreground hover:border-destructive hover:text-destructive disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:border-border disabled:hover:text-muted-foreground transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-destructive focus-visible:ring-offset-1"
          >
            <Eraser size={11} aria-hidden="true" />
            {lang === 'en' ? 'Clear' : 'Effacer'}
          </button>
        </div>
      </div>

      {/* Shortcut: apply active color's size breakdown to every other picked color */}
      {(() => {
        const activeBreakdown = variants.filter(v => v.colorId === activeColor.variantId);
        const otherPickedCount = new Set(
          variants.filter(v => v.colorId !== activeColor.variantId).map(v => v.colorId),
        ).size;
        if (activeBreakdown.length === 0 || otherPickedCount === 0) return null;
        return (
          <button
            type="button"
            onClick={applySameSizesToAllColors}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl border border-dashed border-primary/40 text-primary text-[11px] font-bold hover:bg-primary/5 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1"
          >
            <Copy size={12} aria-hidden="true" />
            {lang === 'en'
              ? `Apply the same sizes to the other ${otherPickedCount} color${otherPickedCount > 1 ? 's' : ''}`
              : `Appliquer les mêmes tailles aux ${otherPickedCount} autre${otherPickedCount > 1 ? 's' : ''} couleur${otherPickedCount > 1 ? 's' : ''}`}
          </button>
        );
      })()}

      {/* Size quantity stepper for the ACTIVE color — uses the COLOR's own
          sizeOptions when available so we never show a size that doesn't
          exist for this color (which would mean no Shopify variantId). */}
      <div>
        {(() => {
          const sizes = activeColor.sizeOptions?.length
            ? activeColor.sizeOptions
            : product.sizes.map(s => ({ variantId: '', size: s, available: true }));
          return (
            <div className={`grid gap-2 ${sizes.length === 1 ? 'grid-cols-1' : 'grid-cols-3 sm:grid-cols-4'}`}>
              {sizes.map(sizeOpt => {
            const size = sizeOpt.size;
            const qty = getQty(activeColor.variantId, size);
            const unavailable = sizeOpt.available === false;
            const soldOutLabel = lang === 'en'
              ? `Size ${size} is sold out in ${activeColor.colorName}`
              : `Taille ${size} épuisée en ${activeColor.colorName}`;
            return (
              <div
                key={size}
                title={unavailable ? soldOutLabel : undefined}
                aria-label={unavailable ? soldOutLabel : `${size} × ${qty}`}
                aria-disabled={unavailable}
                className={`rounded-xl border p-2 transition-all ${
                  unavailable ? 'border-border opacity-40 bg-secondary/40 cursor-not-allowed' :
                  qty > 0 ? 'border-primary bg-primary/5' : 'border-border'
                }`}
              >
                <div className="text-xs font-black text-foreground mb-1.5 text-center">
                  {size}
                  {unavailable && (
                    <div className="text-[8px] text-muted-foreground font-normal normal-case">
                      {lang === 'en' ? 'Sold out' : 'Épuisé'}
                    </div>
                  )}
                </div>
                <div className="flex items-center justify-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => adjustQty(activeColor, size, q => q - 1)}
                    disabled={qty === 0 || unavailable}
                    aria-label={lang === 'en'
                      ? `Decrease size ${size} for ${activeColor.colorName} by 1 (currently ${qty})`
                      : `Diminuer la taille ${size} pour ${activeColor.colorName} de 1 (actuellement ${qty})`}
                    className="w-9 h-9 rounded-full border border-border flex items-center justify-center text-muted-foreground disabled:opacity-30 hover:border-primary transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1"
                  >
                    <Minus size={12} aria-hidden="true" />
                  </button>
                  <span
                    className={`w-8 text-center text-sm font-black ${qty > 0 ? 'text-primary' : 'text-muted-foreground'}`}
                    aria-live="polite"
                    aria-atomic="true"
                    aria-label={lang === 'en'
                      ? `${qty} of size ${size} for ${activeColor.colorName}`
                      : `${qty} en taille ${size} pour ${activeColor.colorName}`}
                  >
                    {qty}
                  </span>
                  <button
                    type="button"
                    onClick={() => adjustQty(activeColor, size, q => q + 1)}
                    disabled={unavailable}
                    aria-label={lang === 'en'
                      ? `Increase size ${size} for ${activeColor.colorName} by 1 (currently ${qty})`
                      : `Augmenter la taille ${size} pour ${activeColor.colorName} de 1 (actuellement ${qty})`}
                    className="w-9 h-9 rounded-full border border-border flex items-center justify-center text-muted-foreground hover:border-primary hover:text-primary disabled:opacity-30 transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1"
                  >
                    <Plus size={12} aria-hidden="true" />
                  </button>
                </div>
              </div>
            );
          })}
            </div>
          );
        })()}
        {/* Live total directly under the size grid — the discount banner
            at the top shows progress toward the rabais, but a plain
            "Total : N articles" line right where the user is clicking
            makes the running count impossible to miss. */}
        <div
          className="mt-2 flex items-center justify-end text-[11px] font-bold text-muted-foreground"
          aria-live="polite"
          aria-atomic="true"
        >
          {lang === 'en'
            ? `Total: ${totalQty} item${totalQty !== 1 ? 's' : ''}`
            : `Total : ${totalQty} article${totalQty !== 1 ? 's' : ''}`}
        </div>
      </div>

      {/* Summary of all picked color × size combinations */}
      {colorGroups.length > 0 && (
        <div className="bg-secondary/50 rounded-xl p-3">
          <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-2">
            {lang === 'en' ? 'Your order' : 'Ta commande'}
          </div>
          <div className="space-y-1.5">
            {colorGroups.map(g => {
              const sizes = variants
                .filter(v => v.colorId === g.color.variantId)
                .map(v => `${v.size}×${v.qty}`)
                .join(' · ');
              return (
                <div key={g.color.variantId} className="flex items-center gap-2 text-xs">
                  <span className="w-3 h-3 rounded-full ring-1 ring-border flex-shrink-0" style={{ background: g.color.hex }} aria-hidden="true" />
                  <span className="font-bold flex-shrink-0">{g.color.colorName}</span>
                  <span className="text-muted-foreground truncate">{sizes}</span>
                  <span className="ml-auto font-extrabold text-primary">{g.qty}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
