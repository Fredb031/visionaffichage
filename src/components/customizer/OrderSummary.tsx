/**
 * OrderSummary — Section 7.2 of the Customizer Blueprint.
 *
 * Final review screen rendered just before "Add to cart". Composes:
 *   - Canvas preview with edit shortcut
 *   - Product / placement / zone info card
 *   - Per-size + per-colour breakdown
 *   - Price breakdown (subtotal, livraison, total)
 *   - Reassurance copy
 *   - Add-to-cart CTA (disabled when totals.totalPieces === 0)
 *
 * Pure presentational component — every value comes from props so the
 * parent owns state and the component re-renders cheaply.
 */
import type { PlacementPreset } from '@/data/productPlacements';

export interface OrderSummaryProduct {
  /** Title shown on the info card (e.g. "T-shirt ATC1000"). */
  title: string;
  /** Optional SKU shown beneath the title. */
  sku?: string;
}

export interface OrderSummaryTotals {
  /** Total pieces across all sizes / colours. */
  totalPieces: number;
  /** Subtotal in CAD before shipping (pieces × unit price + surcharges). */
  subtotal: number;
  /** Per-piece price already including any placement surcharge. */
  unitPrice: number;
  /** Shipping cost in CAD — 0 means free, render in green. */
  shipping: number;
  /** Final total in CAD (subtotal + shipping). */
  total: number;
}

export interface OrderSummarySizeRow {
  /** Display label, e.g. "M" or "2XL". */
  size: string;
  /** Total pieces across colours for this size. */
  qty: number;
  /** Optional per-colour breakdown rendered as a sub-list. */
  colors?: Array<{ name: string; qty: number }>;
}

export interface OrderSummaryProps {
  /** data: URL or remote URL of the rendered canvas preview. */
  canvasPreviewUrl: string;
  product: OrderSummaryProduct;
  placement: PlacementPreset | null;
  /** Size matrix rows. Rows with qty <= 0 are filtered out. */
  sizeMatrix: OrderSummarySizeRow[];
  totals: OrderSummaryTotals;
  /** Fires when the user clicks "Modifier le placement". */
  onEdit: () => void;
  /** Fires when the user clicks the add-to-cart CTA. */
  onAddToCart: () => void;
  /** True while the cart mutation is in-flight (disables the CTA). */
  isAdding?: boolean;
}

const formatCAD = (n: number) => {
  // Defensive: protect against NaN / null / undefined / Infinity slipping
  // through upstream pricing math — never render "NaN$" to a customer.
  const safe = Number.isFinite(n) ? n : 0;
  return `${safe.toFixed(2).replace(/\.00$/, '')}$`;
};

export function OrderSummary({
  canvasPreviewUrl,
  product,
  placement,
  sizeMatrix,
  totals,
  onEdit,
  onAddToCart,
  isAdding = false,
}: OrderSummaryProps) {
  const visibleSizes = sizeMatrix.filter(row => row.qty > 0);
  const disabled = totals.totalPieces === 0 || isAdding;
  const ctaLabel = totals.totalPieces === 0
    ? 'Choisis au moins 1 pièce'
    : `Ajouter au panier — ${formatCAD(totals.total)}`;

  return (
    <div className="flex flex-col gap-4">
      {/* Canvas preview ───────────────────────────────────────────────── */}
      <div className="bg-[#F9FAFB] rounded-2xl p-4 text-center">
        <div className="aspect-square w-full max-w-[320px] mx-auto bg-white rounded-xl overflow-hidden flex items-center justify-center shadow-sm">
          {canvasPreviewUrl ? (
            <img
              src={canvasPreviewUrl}
              alt="Aperçu du produit personnalisé"
              loading="eager"
              decoding="async"
              className="w-full h-full object-contain"
            />
          ) : (
            <div className="text-[#374151]/50 text-xs">Aucun aperçu</div>
          )}
        </div>
        <button
          type="button"
          onClick={onEdit}
          aria-label="Modifier le placement du logo"
          className="mt-3 text-[#0052CC] text-sm font-semibold hover:text-[#003D99] underline-offset-2 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0052CC] focus-visible:ring-offset-1 rounded"
        >
          Modifier le placement
        </button>
      </div>

      {/* Product / placement / zone info card ─────────────────────────── */}
      <div className="bg-white border border-[#E5E7EB] rounded-2xl p-4 flex flex-col gap-2">
        <div className="flex items-baseline justify-between gap-2">
          <div className="text-sm font-semibold text-[#0A0A0A]">{product.title}</div>
          {product.sku ? (
            <div className="text-xs text-[#374151]/70">{product.sku}</div>
          ) : null}
        </div>
        {placement ? (
          <div className="text-xs text-[#374151] flex items-center gap-2">
            <span className="font-medium">Position :</span>
            <span>{placement.label}</span>
            <span className="opacity-60">·</span>
            <span className="capitalize">{placement.zone === 'back' ? 'Dos' : 'Devant'}</span>
          </div>
        ) : (
          <div className="text-xs text-[#374151]/60">Aucun placement sélectionné</div>
        )}
      </div>

      {/* Size breakdown ───────────────────────────────────────────────── */}
      {visibleSizes.length > 0 ? (
        <div className="bg-white border border-[#E5E7EB] rounded-2xl p-4 flex flex-col gap-2">
          <div className="text-xs uppercase tracking-widest font-semibold text-[#374151]">
            Quantités
          </div>
          <ul className="flex flex-col gap-1.5">
            {visibleSizes.map(row => (
              <li key={row.size} className="text-sm text-[#0A0A0A] flex flex-col gap-0.5">
                <div className="flex justify-between">
                  <span className="font-medium">{row.size}</span>
                  <span>{row.qty}</span>
                </div>
                {row.colors && row.colors.length > 0 ? (
                  <ul className="pl-3 text-xs text-[#374151]/80 flex flex-col gap-0.5">
                    {row.colors
                      .filter(c => c.qty > 0)
                      .map(c => (
                        <li key={c.name} className="flex justify-between">
                          <span>{c.name}</span>
                          <span>×{c.qty}</span>
                        </li>
                      ))}
                  </ul>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {/* Price breakdown ──────────────────────────────────────────────── */}
      <div className="bg-[#F9FAFB] rounded-xl p-5 flex flex-col gap-2">
        <div className="flex justify-between text-sm text-[#374151]">
          <span>
            {totals.totalPieces} pièce{totals.totalPieces > 1 ? 's' : ''} ×{' '}
            {formatCAD(totals.unitPrice)}/pce
          </span>
          <span>{formatCAD(totals.subtotal)}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-[#374151]">Livraison</span>
          <span className={totals.shipping === 0 ? 'text-[#059669] font-semibold' : 'text-[#374151]'}>
            {totals.shipping === 0 ? 'Gratuite' : formatCAD(totals.shipping)}
          </span>
        </div>
        <div className="border-t border-[#E5E7EB] pt-2 flex justify-between items-baseline">
          <span className="text-sm font-semibold text-[#0A0A0A]">Total</span>
          <span className="text-[#0052CC] text-xl font-bold">{formatCAD(totals.total)}</span>
        </div>
      </div>

      {/* Reassurance note ─────────────────────────────────────────────── */}
      <div className="bg-[#EBF2FF] border border-[#0052CC]/30 rounded-xl p-4 text-xs text-[#0A0A0A] leading-relaxed">
        Notre équipe va positionner ton logo selon les standards de l'industrie
        et te confirmer la maquette finale par courriel avant la production.
      </div>

      {/* Add-to-cart CTA ──────────────────────────────────────────────── */}
      <button
        type="button"
        onClick={onAddToCart}
        disabled={disabled}
        aria-busy={isAdding}
        aria-disabled={disabled}
        aria-label={isAdding ? 'Ajout au panier en cours' : ctaLabel}
        className={`w-full py-5 rounded-2xl font-semibold text-white transition-all focus:outline-none focus-visible:ring-4 focus-visible:ring-[#E8A838]/60 focus-visible:ring-offset-2 inline-flex items-center justify-center gap-2 ${
          disabled
            ? 'bg-[#0052CC] opacity-40 cursor-not-allowed'
            : 'bg-[#0052CC] hover:bg-[#003D99] shadow-md hover:shadow-lg'
        }`}
      >
        {isAdding ? (
          <>
            <span
              className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin motion-reduce:animate-none"
              aria-hidden="true"
            />
            <span>Ajout en cours…</span>
          </>
        ) : (
          ctaLabel
        )}
      </button>
    </div>
  );
}

export default OrderSummary;
