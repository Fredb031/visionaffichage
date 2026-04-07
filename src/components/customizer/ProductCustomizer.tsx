import { useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ShoppingBag, ChevronRight, ChevronLeft } from 'lucide-react';
import { ProductViewer3D } from './ProductViewer3D';
import { LogoUploader } from './LogoUploader';
import { PlacementSelector } from './PlacementSelector';
import { SizeQuantityPicker } from './SizeQuantityPicker';
import { useCustomizerStore } from '@/store/customizerStore';
import { useCartStore } from '@/store/cartStore';
import { PRODUCTS, PRINT_PRICE, BULK_DISCOUNT_THRESHOLD, BULK_DISCOUNT_RATE } from '@/data/products';

const STEPS = [
  { id: 1, label: 'Couleur' },
  { id: 2, label: 'Logo' },
  { id: 3, label: 'Placement' },
  { id: 4, label: 'Quantités' },
  { id: 5, label: 'Résumé' },
];

export function ProductCustomizer({
  productId,
  onClose,
}: {
  productId: string;
  onClose: () => void;
}) {
  const store = useCustomizerStore();
  const cartStore = useCartStore();
  const previewRef = useRef<HTMLDivElement>(null);

  const product = PRODUCTS.find((p) => p.id === productId);
  if (!product) return null;

  if (store.productId !== productId) store.setProduct(productId);

  const selectedColor = product.colors.find((c) => c.id === store.colorId) ?? null;
  const totalQty = store.getTotalQuantity();
  const hasDiscount = totalQty >= BULK_DISCOUNT_THRESHOLD;
  const unitPrice = product.basePrice + PRINT_PRICE;
  const discountMult = hasDiscount ? 1 - BULK_DISCOUNT_RATE : 1;
  const totalPrice = parseFloat((totalQty * unitPrice * discountMult).toFixed(2));

  const canProceed = () => {
    if (store.step === 1) return !!store.colorId;
    if (store.step === 2) return !!store.logoPlacement?.previewUrl;
    if (store.step === 3) return !!store.logoPlacement?.zoneId;
    if (store.step === 4) return totalQty > 0;
    return true;
  };

  const handleAddToCart = () => {
    const snapshot = store.logoPlacement?.previewUrl ?? product.imageDevant;

    cartStore.addItem({
      productId: product.id,
      colorId: store.colorId,
      logoPlacement: store.logoPlacement,
      sizeQuantities: store.sizeQuantities,
      activeView: store.activeView,
      step: store.step,
      productName: product.name,
      previewSnapshot: snapshot,
      unitPrice: unitPrice * discountMult,
      totalQuantity: totalQty,
      totalPrice,
    });

    store.reset();
    onClose();
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-md flex items-end justify-center p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <motion.div
        initial={{ y: 60, scale: 0.97 }}
        animate={{ y: 0, scale: 1 }}
        exit={{ y: 60, opacity: 0 }}
        transition={{ type: 'spring', stiffness: 280, damping: 28 }}
        className="bg-background rounded-2xl w-full max-w-5xl overflow-hidden"
        style={{ maxHeight: '95vh', display: 'grid', gridTemplateRows: 'auto 1fr auto' }}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-border flex items-center justify-between">
          <div>
            <h2 className="text-base font-black text-foreground">{product.shortName}</h2>
            <p className="text-xs text-muted-foreground">Personnalise ton produit</p>
          </div>
          <div className="hidden md:flex items-center gap-1">
            {STEPS.map((s, i) => (
              <div key={s.id} className="flex items-center gap-1">
                <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition-all ${
                  store.step === s.id ? 'bg-navy text-white' :
                  store.step > s.id ? 'bg-green-600/15 text-green-700' :
                  'text-muted-foreground'
                }`}>
                  <span>{store.step > s.id ? '✓' : s.id}</span>
                  <span>{s.label}</span>
                </div>
                {i < STEPS.length - 1 && <div className="w-4 h-px bg-border" />}
              </div>
            ))}
          </div>
          <button onClick={onClose} className="w-9 h-9 rounded-full border border-border flex items-center justify-center text-muted-foreground hover:bg-secondary">
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="overflow-auto grid md:grid-cols-[1.4fr_1fr] divide-y md:divide-y-0 md:divide-x divide-border" ref={previewRef}>
          {/* LEFT — 3D View */}
          <div className="p-4 md:p-6">
            <ProductViewer3D
              product={product}
              selectedColor={selectedColor}
              logoPlacement={store.logoPlacement}
              activeView={store.activeView}
              onViewChange={store.setView}
            />
            {store.step === 1 && (
              <div className="mt-4">
                <p className="text-xs font-bold text-muted-foreground mb-3">Couleur du vêtement</p>
                <div className="flex flex-wrap gap-2">
                  {product.colors.map((color) => (
                    <button
                      key={color.id}
                      onClick={() => { store.setColor(color.id); store.setStep(2); }}
                      title={color.name}
                      className={`w-8 h-8 rounded-full transition-all duration-200 ${
                        store.colorId === color.id
                          ? 'scale-110 ring-2 ring-offset-2 ring-navy'
                          : 'hover:scale-105 ring-1 ring-border'
                      }`}
                      style={{ background: color.hex }}
                    />
                  ))}
                </div>
                {selectedColor && (
                  <p className="text-xs text-muted-foreground mt-2 font-medium">Couleur sélectionnée : <strong className="text-foreground">{selectedColor.name}</strong></p>
                )}
              </div>
            )}
          </div>

          {/* RIGHT — Step panel */}
          <div className="p-4 md:p-6 space-y-5 overflow-auto">
            <AnimatePresence mode="wait">
              {store.step === 1 && (
                <motion.div key="step1" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                  <h3 className="text-sm font-black text-foreground mb-1">Choisis ta couleur</h3>
                  <p className="text-xs text-muted-foreground mb-4">Sélectionne une couleur pour voir l'aperçu en direct</p>
                  <div className="grid grid-cols-2 gap-2">
                    {product.colors.map((color) => (
                      <button
                        key={color.id}
                        onClick={() => { store.setColor(color.id); store.setStep(2); }}
                        className={`flex items-center gap-3 p-3 rounded-xl border transition-all text-left ${
                          store.colorId === color.id ? 'border-navy bg-navy/5' : 'border-border hover:border-navy/40'
                        }`}
                      >
                        <div className="w-7 h-7 rounded-full flex-shrink-0 ring-1 ring-border" style={{ background: color.hex }} />
                        <span className="text-xs font-bold text-foreground">{color.name}</span>
                      </button>
                    ))}
                  </div>
                </motion.div>
              )}

              {store.step === 2 && (
                <motion.div key="step2" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                  <h3 className="text-sm font-black text-foreground mb-1">Upload ton logo</h3>
                  <p className="text-xs text-muted-foreground mb-4">Le fond est supprimé automatiquement. PNG, JPG, SVG.</p>
                  <LogoUploader
                    onLogoReady={(previewUrl, processedUrl, file) => {
                      store.setLogoPlacement({
                        zoneId: '',
                        mode: 'preset',
                        previewUrl,
                        processedUrl,
                        originalFile: file,
                      });
                      store.setStep(3);
                    }}
                  />
                </motion.div>
              )}

              {store.step === 3 && store.logoPlacement?.previewUrl && (
                <motion.div key="step3" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                  <h3 className="text-sm font-black text-foreground mb-1">Où veux-tu ton logo ?</h3>
                  <p className="text-xs text-muted-foreground mb-4">Zone prédéfinie ou placement libre sur le produit</p>
                  <PlacementSelector
                    product={product}
                    selectedColor={selectedColor}
                    logoPreviewUrl={store.logoPlacement.previewUrl}
                    currentPlacement={store.logoPlacement}
                    onPlacementChange={(p) => store.setLogoPlacement(p)}
                  />
                </motion.div>
              )}

              {store.step === 4 && (
                <motion.div key="step4" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                  <h3 className="text-sm font-black text-foreground mb-1">Tailles & quantités</h3>
                  <p className="text-xs text-muted-foreground mb-4">Ajoute les quantités par taille. Rabais de 15% dès 12 unités.</p>
                  <SizeQuantityPicker
                    product={product}
                    sizeQuantities={store.sizeQuantities}
                    onUpdate={store.setSizeQuantity}
                  />
                </motion.div>
              )}

              {store.step === 5 && (
                <motion.div key="step5" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-4">
                  <h3 className="text-sm font-black text-foreground">Résumé de ta commande</h3>
                  <div className="bg-secondary rounded-xl p-4 space-y-2.5">
                    <div className="flex justify-between text-sm"><span className="text-muted-foreground">Produit</span><span className="font-bold">{product.shortName}</span></div>
                    <div className="flex justify-between text-sm"><span className="text-muted-foreground">Couleur</span><span className="font-bold">{selectedColor?.name ?? '—'}</span></div>
                    <div className="flex justify-between text-sm"><span className="text-muted-foreground">Quantité totale</span><span className="font-bold">{totalQty} unités</span></div>
                    <div className="flex justify-between text-sm"><span className="text-muted-foreground">Prix unitaire</span><span className="font-bold">{product.basePrice.toFixed(2)} $</span></div>
                    <div className="flex justify-between text-sm"><span className="text-muted-foreground">Impression logo</span><span className="font-bold">{PRINT_PRICE.toFixed(2)} $</span></div>
                    {hasDiscount && (
                      <div className="flex justify-between text-sm text-green-700"><span>Rabais quantité</span><span className="font-bold">−15%</span></div>
                    )}
                    <div className="border-t border-border pt-2 flex justify-between">
                      <span className="font-black text-foreground">Total estimé</span>
                      <span className="font-black text-navy text-base">{totalPrice.toFixed(2)} $</span>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground text-center">Les taxes s'ajoutent au checkout · Livraison en 5 jours ouvrables</p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-border flex items-center justify-between bg-background">
          <button
            onClick={() => store.setStep(Math.max(1, store.step - 1) as 1|2|3|4|5)}
            disabled={store.step === 1}
            className="flex items-center gap-2 text-sm font-bold text-muted-foreground disabled:opacity-30 hover:text-foreground transition-colors"
          >
            <ChevronLeft size={16} /> Retour
          </button>

          {totalQty > 0 && (
            <div className="text-center">
              <div className="text-xs text-muted-foreground">{totalQty} unité{totalQty !== 1 ? 's' : ''}</div>
              <div className="text-sm font-black text-navy">{totalPrice.toFixed(2)} $</div>
            </div>
          )}

          {store.step < 5 ? (
            <button
              onClick={() => canProceed() && store.setStep((store.step + 1) as 1|2|3|4|5)}
              disabled={!canProceed()}
              className="flex items-center gap-2 bg-navy text-white text-sm font-black px-5 py-3 rounded-full disabled:opacity-40 hover:bg-navydark transition-all"
            >
              Suivant <ChevronRight size={16} />
            </button>
          ) : (
            <button
              onClick={handleAddToCart}
              disabled={totalQty === 0}
              className="flex items-center gap-2 bg-navy text-white text-sm font-black px-6 py-3 rounded-full disabled:opacity-40 hover:bg-navydark transition-all shadow-lg shadow-navy/30"
            >
              <ShoppingBag size={16} /> Ajouter au panier
            </button>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}
