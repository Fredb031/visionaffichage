import { useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useLang } from '@/lib/langContext';
import { useEscapeKey } from '@/hooks/useEscapeKey';
import { useBodyScrollLock } from '@/hooks/useBodyScrollLock';
import { useFocusTrap } from '@/hooks/useFocusTrap';
import type { Product } from '@/data/products';

// Size measurements in cm — standard SanMar/ATC sizing
const SIZE_CHARTS: Record<string, Record<string, { chest: string; length: string; sleeve?: string }>> = {
  hoodie: {
    XS: { chest: '91', length: '66', sleeve: '84' },
    S:  { chest: '96', length: '69', sleeve: '86' },
    M:  { chest: '101', length: '72', sleeve: '88' },
    L:  { chest: '106', length: '74', sleeve: '90' },
    XL: { chest: '112', length: '76', sleeve: '92' },
    '2XL': { chest: '117', length: '79', sleeve: '94' },
    '3XL': { chest: '122', length: '81', sleeve: '97' },
    '4XL': { chest: '127', length: '83', sleeve: '99' },
    '5XL': { chest: '132', length: '86', sleeve: '101' },
  },
  tshirt: {
    XS: { chest: '86', length: '66' },
    S:  { chest: '91', length: '69' },
    M:  { chest: '96', length: '72' },
    L:  { chest: '101', length: '74' },
    XL: { chest: '106', length: '76' },
    '2XL': { chest: '112', length: '79' },
    '3XL': { chest: '117', length: '81' },
    '4XL': { chest: '122', length: '83' },
    '5XL': { chest: '127', length: '86' },
    '6XL': { chest: '132', length: '88' },
  },
  cap: {
    OSFA: { chest: '57-61', length: '—' },
    // French product data ships `sizes: ['Taille unique']` for caps + toques,
    // so without this alias the size-guide table would render zero rows and
    // leave the user staring at a header-only modal.
    'Taille unique': { chest: '57-61', length: '—' },
  },
};

type Unit = 'cm' | 'in';
const STORAGE_KEY = 'va:size-unit';

function readStoredUnit(): Unit {
  if (typeof window === 'undefined') return 'cm';
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw === 'in' ? 'in' : 'cm';
  } catch {
    return 'cm';
  }
}

// Convert a cm string (single number, range like "57-61", or "—") into the
// target unit. Ranges are split on '-' and each endpoint converted; NaN
// segments fall back to the raw string so we never render "NaN" to users.
function convertValue(value: string, unit: Unit): string {
  if (value === '—') return value;
  if (unit === 'cm') return value;
  if (value.includes('-')) {
    const parts = value.split('-');
    const converted = parts.map(part => {
      const n = Number(part);
      if (Number.isNaN(n)) return part;
      return (n / 2.54).toFixed(1);
    });
    return converted.join('-');
  }
  const n = Number(value);
  if (Number.isNaN(n)) return value;
  return (n / 2.54).toFixed(1);
}

export function SizeGuide({ product, isOpen, onClose }: { product: Product; isOpen: boolean; onClose: () => void }) {
  const { lang } = useLang();

  const chartKey = ['hoodie', 'crewneck'].includes(product.category) ? 'hoodie'
    : ['cap', 'toque'].includes(product.category) ? 'cap'
    : 'tshirt';
  const chart = SIZE_CHARTS[chartKey];
  const isCap = chartKey === 'cap';
  // Guard against the product shipping a size that isn't in the chart
  // (e.g. a newly added '7XL' or a localized label) — otherwise tbody
  // renders empty and the user sees column headers with no data.
  const rows = product.sizes.filter(s => chart[s]);

  const [unit, setUnit] = useState<Unit>(() => readStoredUnit());
  // Roving-focus ref array for the cm/in radiogroup — arrow keys hop
  // between the two segments so the modal is usable without a mouse.
  const unitRefs = useRef<(HTMLButtonElement | null)[]>([]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(STORAGE_KEY, unit);
    } catch {
      /* ignore quota / disabled storage */
    }
  }, [unit]);

  useEscapeKey(isOpen, onClose);
  useBodyScrollLock(isOpen);
  const trapRef = useFocusTrap<HTMLDivElement>(isOpen);

  const unitLabel = unit === 'in' ? 'in' : 'cm';

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          className="fixed inset-0 z-[600] flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(8px)' }}
          role="dialog"
          aria-modal="true"
          aria-labelledby="size-guide-title"
          onClick={e => e.target === e.currentTarget && onClose()}
        >
          <motion.div
            ref={trapRef}
            tabIndex={-1}
            initial={{ y: 30, scale: 0.95 }} animate={{ y: 0, scale: 1 }} exit={{ y: 30, opacity: 0 }}
            className="bg-background rounded-2xl border border-border shadow-2xl max-w-md w-full max-h-[80vh] overflow-hidden focus:outline-none"
          >
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-border">
              <h3 id="size-guide-title" className="text-sm font-black text-foreground">
                {lang === 'en' ? 'Size Guide' : 'Guide des tailles'} — {product.shortName}
              </h3>
              <button
                type="button"
                onClick={onClose}
                aria-label={lang === 'en' ? 'Close size guide' : 'Fermer le guide des tailles'}
                className="w-7 h-7 rounded-full border border-border flex items-center justify-center text-muted-foreground hover:bg-secondary focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0052CC]"
              >
                <X size={12} aria-hidden="true" />
              </button>
            </div>

            <div className="overflow-auto p-4">
              {rows.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-6">
                  {lang === 'en'
                    ? 'Size chart not available for this product — contact us for exact measurements.'
                    : 'Guide des tailles indisponible pour ce produit — contactez-nous pour les mesures exactes.'}
                </p>
              ) : (
                <>
                  <div
                    role="radiogroup"
                    aria-label={lang === 'en' ? 'Units' : 'Unités'}
                    className="inline-flex border border-border rounded-lg mb-3 overflow-hidden"
                    onKeyDown={e => {
                      const opts: Unit[] = ['cm', 'in'];
                      const curIdx = opts.indexOf(unit);
                      let nextIdx = curIdx;
                      switch (e.key) {
                        case 'ArrowRight':
                        case 'ArrowDown':
                          nextIdx = (curIdx + 1) % opts.length;
                          break;
                        case 'ArrowLeft':
                        case 'ArrowUp':
                          nextIdx = (curIdx - 1 + opts.length) % opts.length;
                          break;
                        case 'Home':
                          nextIdx = 0;
                          break;
                        case 'End':
                          nextIdx = opts.length - 1;
                          break;
                        default:
                          return;
                      }
                      e.preventDefault();
                      setUnit(opts[nextIdx]);
                      unitRefs.current[nextIdx]?.focus();
                    }}
                  >
                    <button
                      ref={el => { unitRefs.current[0] = el; }}
                      type="button"
                      role="radio"
                      aria-checked={unit === 'cm'}
                      tabIndex={unit === 'cm' ? 0 : -1}
                      onClick={() => setUnit('cm')}
                      className={`px-3 py-1 text-xs font-bold focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0052CC] ${unit === 'cm' ? 'bg-[#0052CC] text-white' : 'bg-transparent text-muted-foreground'}`}
                    >
                      cm
                    </button>
                    <button
                      ref={el => { unitRefs.current[1] = el; }}
                      type="button"
                      role="radio"
                      aria-checked={unit === 'in'}
                      tabIndex={unit === 'in' ? 0 : -1}
                      onClick={() => setUnit('in')}
                      className={`px-3 py-1 text-xs font-bold focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0052CC] ${unit === 'in' ? 'bg-[#0052CC] text-white' : 'bg-transparent text-muted-foreground'}`}
                    >
                      in
                    </button>
                  </div>

                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left border-b border-border">
                        <th className="py-2 px-2 font-bold text-foreground text-xs">{lang === 'en' ? 'Size' : 'Taille'}</th>
                        <th className="py-2 px-2 font-bold text-foreground text-xs">
                          {isCap ? (lang === 'en' ? 'Circumference' : 'Circonférence') : (lang === 'en' ? 'Chest' : 'Poitrine')} ({unitLabel})
                        </th>
                        {!isCap && (
                          <th className="py-2 px-2 font-bold text-foreground text-xs">{lang === 'en' ? 'Length' : 'Longueur'} ({unitLabel})</th>
                        )}
                        {chart[Object.keys(chart)[0]]?.sleeve && (
                          <th className="py-2 px-2 font-bold text-foreground text-xs">{lang === 'en' ? 'Sleeve' : 'Manche'} ({unitLabel})</th>
                        )}
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map(size => {
                        const row = chart[size];
                        return (
                          <tr key={size} className="border-b border-border/50 hover:bg-secondary/50">
                            <td className="py-2.5 px-2 font-bold text-foreground">{size}</td>
                            <td className="py-2.5 px-2 text-muted-foreground">{convertValue(row.chest, unit)}</td>
                            {!isCap && <td className="py-2.5 px-2 text-muted-foreground">{convertValue(row.length, unit)}</td>}
                            {row.sleeve && <td className="py-2.5 px-2 text-muted-foreground">{convertValue(row.sleeve, unit)}</td>}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>

                  <p className="text-[11px] text-muted-foreground mt-3 text-center">
                    {lang === 'en'
                      ? `Measurements may vary ±${unit === 'in' ? '0.8 in' : '2 cm'}. When in doubt, size up.`
                      : `Les mesures peuvent varier de ±${unit === 'in' ? '0.8 in' : '2 cm'}. En cas de doute, prenez la taille au-dessus.`}
                  </p>
                </>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
