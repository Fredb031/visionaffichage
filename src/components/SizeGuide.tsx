import { X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useLang } from '@/lib/langContext';
import { useEscapeKey } from '@/hooks/useEscapeKey';
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
  },
};

export function SizeGuide({ product, isOpen, onClose }: { product: Product; isOpen: boolean; onClose: () => void }) {
  const { lang } = useLang();

  const chartKey = ['hoodie', 'crewneck'].includes(product.category) ? 'hoodie'
    : ['cap', 'toque'].includes(product.category) ? 'cap'
    : 'tshirt';
  const chart = SIZE_CHARTS[chartKey];
  const isCap = chartKey === 'cap';

  useEscapeKey(isOpen, onClose);

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
            initial={{ y: 30, scale: 0.95 }} animate={{ y: 0, scale: 1 }} exit={{ y: 30, opacity: 0 }}
            className="bg-background rounded-2xl border border-border shadow-2xl max-w-md w-full max-h-[80vh] overflow-hidden"
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
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left border-b border-border">
                    <th className="py-2 px-2 font-bold text-foreground text-xs">{lang === 'en' ? 'Size' : 'Taille'}</th>
                    <th className="py-2 px-2 font-bold text-foreground text-xs">
                      {isCap ? (lang === 'en' ? 'Circumference' : 'Circonférence') : (lang === 'en' ? 'Chest' : 'Poitrine')} (cm)
                    </th>
                    {!isCap && (
                      <th className="py-2 px-2 font-bold text-foreground text-xs">{lang === 'en' ? 'Length' : 'Longueur'} (cm)</th>
                    )}
                    {chart[Object.keys(chart)[0]]?.sleeve && (
                      <th className="py-2 px-2 font-bold text-foreground text-xs">{lang === 'en' ? 'Sleeve' : 'Manche'} (cm)</th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {product.sizes.map(size => {
                    const row = chart[size];
                    if (!row) return null;
                    return (
                      <tr key={size} className="border-b border-border/50 hover:bg-secondary/50">
                        <td className="py-2.5 px-2 font-bold text-foreground">{size}</td>
                        <td className="py-2.5 px-2 text-muted-foreground">{row.chest}</td>
                        {!isCap && <td className="py-2.5 px-2 text-muted-foreground">{row.length}</td>}
                        {row.sleeve && <td className="py-2.5 px-2 text-muted-foreground">{row.sleeve}</td>}
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              <p className="text-[11px] text-muted-foreground mt-3 text-center">
                {lang === 'en'
                  ? 'Measurements may vary ±2 cm. When in doubt, size up.'
                  : 'Les mesures peuvent varier de ±2 cm. En cas de doute, prenez la taille au-dessus.'}
              </p>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
