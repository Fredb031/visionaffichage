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
import { useLang } from '@/lib/langContext';

export function ProductCustomizer({ productId, onClose }: { productId: string; onClose: () => void }) {
  const { t } = useLang();
  const store = useCustomizerStore();
  const cartStore = useCartStore();

  const product = PRODUCTS.find((p) => p.id === productId);
  if (!product) return null;
  if (store.productId !== productId) store.setProduct(productId);

  const selectedColor = product.colors.find((c) => c.id === store.colorId) ?? null;
  const totalQty = store.getTotalQuantity();
  const hasDiscount = totalQty >= BULK_DISCOUNT_THRESHOLD;
  const unitPrice = product.basePrice + PRINT_PRICE;
  const discountMult = hasDiscount ? 1 - BULK_DISCOUNT_RATE : 1;
  const totalPrice = parseFloat((totalQty * unitPrice * discountMult).toFixed(2));

  const STEPS = [
    { id: 1, label: t('couleur') },
    { id: 2, label: t('tonLogo') },
    { id: 3, label: t('zoneImpression') },
    { id: 4, label: t('taillesQuantites') },
    { id: 5, label: t('resume') },
  ];

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
      className="fixed inset-0 z-50 flex items-end justify-center p-2 md:p-4"
      style={{ background: 'rgba(8,14,32,.72)', backdropFilter: 'blur(16px)' }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <motion.div
        initial={{ y: 80, scale: 0.96 }}
        animate={{ y: 0, scale: 1 }}
        exit={{ y: 80, opacity: 0 }}
        transition={{ type: 'spring', stiffness: 260, damping: 28 }}
        className="bg-background rounded-2xl w-full max-w-5xl overflow-hidden border border-border/50"
        style={{ maxHeight: '96vh', display: 'grid', gridTemplateRows: 'auto 1fr auto' }}
      >
        {/* Header */}
        <div className="px-5 py-3.5 border-b border-border flex items-center justify-between gap-4">
          <div>
            <h2 className="text-sm font-black text-foreground">{product.name}</h2>
            <p className="text-xs text-muted-foreground">{t('personnaliserProduit')}</p>
          </div>
          {/* Steps progress bar */}
          <div className="hidden md:flex items-center gap-1 flex-1 justify-center">
            {STEPS.map((s, i) => (
              <div key={s.id} className="flex items-center gap-1">
                <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer ${
                  store.step === s.id ? 'bg-primary text-primary-foreground' :
                  store.step > s.id ? 'bg-green-600/15 text-green-700' : 'text-muted-foreground hover:text-foreground'
                }`} onClick={() => store.step > s.id && store.setStep(s.id as any)}>
                  <span>{store.step > s.id ? '✓' : s.id}</span>
                  <span className="hidden lg:inline">{s.label}</span>
                </div>
                {i < STEPS.length - 1 && <div className="w-3 h-px bg-border" />}
              </div>
            ))}
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-full border border-border flex items-center justify-center text-muted-foreground hover:bg-secondary flex-shrink-0">
            <X size={15} />
          </button>
        </div>

        {/* Body */}
        <div className="overflow-auto grid md:grid-cols-[1.4fr_1fr] divide-y md:divide-y-0 md:divide-x divide-border">
          {/* LEFT — 3D viewer + color swatches */}
          <div className="p-4 md:p-5">
            <ProductViewer3D
              product={product}
              selectedColor={selectedColor}
              logoPlacement={store.logoPlacement}
              activeView={store.activeView}
              onViewChange={store.setView}
            />
            {/* Color swatches always visible under 3D */}
            <div className="mt-3">
              <p className="text-xs font-bold text-muted-foreground mb-2">{t('couleur')}</p>
              <div className="flex flex-wrap gap-2">
                {product.colors.map((color) => (
                  <button
                    key={color.id}
                    onClick={() => { store.setColor(color.id); if (store.step === 1) store.setStep(2); }}
                    title={color.name}
                    className={`w-8 h-8 rounded-full transition-all duration-200 flex-shrink-0 ${
                      store.colorId === color.id
                        ? 'ring-2 ring-offset-2 ring-primary scale-110'
                        : 'hover:scale-105 ring-1 ring-border'
                    }`}
                    style={{ background: color.hex }}
                  />
                ))}
              </div>
              {selectedColor && (
                <p className="text-xs text-muted-foreground mt-2">
                  {t('couleurLabel')} : <strong className="text-foreground">{selectedColor.name}</strong>
                </p>
              )}
            </div>
          </div>

          {/* RIGHT — Steps panel */}
          <div className="p-4 md:p-5 overflow-auto">
            <AnimatePresence mode="wait">

              {store.step === 1 && (
                <motion.div key="s1" initial={{opacity:0,x:20}} animate={{opacity:1,x:0}} exit={{opacity:0,x:-20}}>
                  <h3 className="text-sm font-black text-foreground mb-1">{t('choisirCouleur')}</h3>
                  <p className="text-xs text-muted-foreground mb-4">La couleur s'applique en direct sur le produit 3D</p>
                  <div className="grid grid-cols-2 gap-2">
                    {product.colors.map((color) => (
                      <button
                        key={color.id}
                        onClick={() => { store.setColor(color.id); store.setStep(2); }}
                        className={`flex items-center gap-3 p-3 rounded-xl border transition-all text-left ${
                          store.colorId === color.id ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/40'
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
                <motion.div key="s2" initial={{opacity:0,x:20}} animate={{opacity:1,x:0}} exit={{opacity:0,x:-20}}>
                  <h3 className="text-sm font-black text-foreground mb-1">{t('tonLogo')}</h3>
                  <p className="text-xs text-muted-foreground mb-4">Le fond est supprimé automatiquement. PNG, JPG, SVG.</p>
                  <LogoUploader
                    onLogoReady={(previewUrl, processedUrl, file) => {
                      store.setLogoPlacement({ zoneId: product.printZones[0]?.id ?? '', mode: 'preset', previewUrl, processedUrl, originalFile: file, x: product.printZones[0]?.x, y: product.printZones[0]?.y, width: product.printZones[0]?.width });
                      store.setStep(3);
                    }}
                  />
                </motion.div>
              )}

              {store.step === 3 && store.logoPlacement?.previewUrl && (
                <motion.div key="s3" initial={{opacity:0,x:20}} animate={{opacity:1,x:0}} exit={{opacity:0,x:-20}}>
                  <h3 className="text-sm font-black text-foreground mb-1">{t('zoneImpression')}</h3>
                  <p className="text-xs text-muted-foreground mb-3">Zone prédéfinie ou placement libre</p>
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
                <motion.div key="s4" initial={{opacity:0,x:20}} animate={{opacity:1,x:0}} exit={{opacity:0,x:-20}}>
                  <h3 className="text-sm font-black text-foreground mb-1">{t('taillesQuantites')}</h3>
                  <p className="text-xs text-muted-foreground mb-3">Rabais de 15% dès 12 unités</p>
                  <SizeQuantityPicker product={product} sizeQuantities={store.sizeQuantities} onUpdate={store.setSizeQuantity} />
                </motion.div>
              )}

              {store.step === 5 && (
                <motion.div key="s5" initial={{opacity:0,x:20}} animate={{opacity:1,x:0}} exit={{opacity:0,x:-20}} className="space-y-4">
                  <h3 className="text-sm font-black text-foreground">{t('resume')}</h3>
                  <div className="bg-secondary rounded-xl p-4 space-y-2.5">
                    {[
                      [t('produit'), product.name],
                      [t('couleurLabel'), selectedColor?.name ?? '—'],
                      [t('quantiteTotale'), `${totalQty} ${totalQty !== 1 ? t('unitPluralLabel') : t('unitLabel')}`],
                      [t('prixUnitaire'), `${product.basePrice.toFixed(2)} $`],
                      [t('impression'), `${PRINT_PRICE.toFixed(2)} $`],
                    ].map(([label, val]) => (
                      <div key={label} className="flex justify-between text-sm">
                        <span className="text-muted-foreground">{label}</span>
                        <span className="font-bold">{val}</span>
                      </div>
                    ))}
                    {hasDiscount && (
                      <div className="flex justify-between text-sm text-green-700">
                        <span>{t('rabaisQuantite')}</span>
                        <span className="font-bold">−15%</span>
                      </div>
                    )}
                    <div className="border-t border-border pt-2.5 flex justify-between">
                      <span className="font-black text-foreground">{t('totalEstime')}</span>
                      <span className="font-black text-primary text-base">{totalPrice.toFixed(2)} $</span>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground text-center">{t('taxesNote')}</p>
                </motion.div>
              )}

            </AnimatePresence>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3.5 border-t border-border flex items-center justify-between bg-background">
          <button
            onClick={() => store.setStep(Math.max(1, store.step - 1) as any)}
            disabled={store.step === 1}
            className="flex items-center gap-1.5 text-sm font-bold text-muted-foreground disabled:opacity-30 hover:text-foreground transition-colors"
          >
            <ChevronLeft size={16} /> {t('retour')}
          </button>

          {totalQty > 0 && (
            <div className="text-center">
              <div className="text-xs text-muted-foreground">{totalQty} {totalQty !== 1 ? t('unitPluralLabel') : t('unitLabel')}</div>
              <div className="text-sm font-black text-primary">{totalPrice.toFixed(2)} $</div>
            </div>
          )}

          {store.step < 5 ? (
            <button
              onClick={() => canProceed() && store.setStep((store.step + 1) as any)}
              disabled={!canProceed()}
              className="flex items-center gap-1.5 bg-primary text-primary-foreground text-sm font-black px-5 py-2.5 rounded-full disabled:opacity-40 hover:bg-navy-dark transition-all"
            >
              {t('suivant')} <ChevronRight size={16} />
            </button>
          ) : (
            <button
              onClick={handleAddToCart}
              disabled={totalQty === 0}
              className="flex items-center gap-2 gradient-navy-dark text-primary-foreground text-sm font-black px-6 py-2.5 rounded-full disabled:opacity-40 transition-all shadow-navy"
            >
              <ShoppingBag size={15} /> {t('ajouterPanier')}
            </button>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}
