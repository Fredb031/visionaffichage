/**
 * CompareToggleButton — Volume II §15.
 *
 * Small checkbox-style toggle mounted on each ProductCard. Adds or
 * removes the SKU from the compare store. Renders a check-icon-in-
 * circle that tints brand-blue when the SKU is in the compare list.
 * Goes visually disabled when 3 items are already selected and this
 * SKU isn't one of them — clicking still does nothing in that state
 * (the store cap defends in depth).
 *
 * Sits on top of the existing card hover overlay (z-[5], same band as
 * the wishlist heart and Popular badge) so it doesn't fight with the
 * Customize CTA's gradient overlay (z-[3]).
 */
import { Check } from 'lucide-react';
import { useCompareStore, COMPARE_MAX } from '@/lib/compareStore';
import { useLang } from '@/lib/langContext';

interface CompareToggleButtonProps {
  /** SKU of the product this card represents. Skipped when null —
   *  cards rendered from a partial Shopify response without a local
   *  data/products.ts mapping have no stable identifier and shouldn't
   *  show the toggle at all. */
  sku: string | null | undefined;
  /** Optional label for the SR-only aria text. Falls back to "ce produit". */
  productName?: string;
}

export function CompareToggleButton({ sku, productName }: CompareToggleButtonProps) {
  const { lang } = useLang();
  // Subscribe to scalar derived values rather than the items array — a
  // fresh array reference is published on every toggle, which would
  // otherwise re-render every CompareToggleButton on the catalogue page
  // even though only one SKU's selection state actually changed.
  const isSelected = useCompareStore(s => (sku ? s.items.includes(sku) : false));
  const isFull = useCompareStore(s => s.items.length >= COMPARE_MAX);
  const toggle = useCompareStore(s => s.toggle);

  if (!sku) return null;

  const disabled = isFull && !isSelected;

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (disabled) return;
    toggle(sku);
  };

  // Bilingual aria — labels track French-canonical site copy with
  // accents, English fallback for the EN toggle path.
  const subject = productName ?? (lang === 'en' ? 'this product' : 'ce produit');
  const ariaLabel = isSelected
    ? (lang === 'en' ? `Remove ${subject} from compare` : `Retirer ${subject} de la comparaison`)
    : disabled
      ? (lang === 'en'
          ? `Compare list full (max ${COMPARE_MAX})`
          : `Comparateur plein (max ${COMPARE_MAX})`)
      : (lang === 'en' ? `Add ${subject} to compare` : `Ajouter ${subject} à la comparaison`);

  return (
    <button
      type="button"
      onClick={handleClick}
      aria-label={ariaLabel}
      aria-pressed={isSelected}
      aria-disabled={disabled}
      disabled={disabled}
      title={ariaLabel}
      className={[
        'absolute top-2.5 right-12 z-[5] w-9 h-9 rounded-full flex items-center justify-center',
        'bg-white/90 backdrop-blur-sm border transition-colors',
        'focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1',
        isSelected
          ? 'border-primary text-primary-foreground bg-primary'
          : disabled
            ? 'border-border text-muted-foreground/50 cursor-not-allowed opacity-50'
            : 'border-white/70 text-muted-foreground hover:text-primary hover:border-primary/50',
      ].join(' ')}
    >
      <Check
        size={15}
        strokeWidth={3}
        aria-hidden="true"
        className={isSelected ? 'opacity-100' : 'opacity-70'}
      />
    </button>
  );
}
