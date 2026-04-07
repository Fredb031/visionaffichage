/**
 * ProductCustomizer — 5-step modal
 * Step 1: Colour (real Shopify colours + front/back images per colour)
 * Step 2: Upload logo (remove.bg auto)
 * Step 3: Placement (Canva-style LogoCanvas)
 * Step 4: Sizes & quantities
 * Step 5: Summary + Add to cart
 */
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ShoppingBag, ChevronRight, ChevronLeft, Check, Loader2 } from 'lucide-react';
import { ProductViewer3D } from './ProductViewer3D';
import { LogoUploader } from './LogoUploader';
import { PlacementSelector } from './PlacementSelector';
import { SizeQuantityPicker } from './SizeQuantityPicker';
import { ColorPicker } from './ColorPicker';
import { useCustomizerStore } from '@/store/customizerStore';
import { useCartStore } from '@/store/cartStore';
import { useProductColors } from '@/hooks/useProductColors';
import { PRODUCTS, PRINT_PRICE, BULK_DISCOUNT_THRESHOLD, BULK_DISCOUNT_RATE } from '@/data/products';
import type { ShopifyVariantColor } from '@/lib/shopify';
import type { ProductColor } from '@/data/products';
import { useLang } from '@/lib/langContext';

export function ProductCustomizer({ productId, onClose }: { productId: string; onClose: () => void }) {
  const { t } = useLang();
  const store = useCustomizerStore();
  const cartStore = useCartStore();

  const product = PRODUCTS.find(p => p.id === productId);
  if (!product) return null;
  if (store.productId !== productId) store.setProduct(productId);

  // Live Shopify colours
  const { data: shopifyColors = [], isLoading: colorsLoading } = useProductColors(product.shopifyHandle);

  // Selected colour state — uses Shopify colours if available, falls back to local
  const [selectedShopifyColor, setSelectedShopifyColor] = useState<ShopifyVariantColor | null>(null);

  // Build ProductColor from Shopify or local data
  const activeColor: ProductColor | null = selectedShopifyColor
    ? {
        id: selectedShopifyColor.variantId,
        name: selectedShopifyColor.colorName,
        hex: selectedShopifyColor.hex,
        imageDevant: selectedShopifyColor.imageDevant ?? product.imageDevant,
        imageDos: selectedShopifyColor.imageDos ?? product.imageDos,
      }
    : (product.colors.find(c => c.id === store.colorId) ?? null);

  const totalQty = store.getTotalQuantity();
  const hasDiscount = totalQty >= BULK_DISCOUNT_THRESHOLD;
  const unitPrice = product.basePrice + PRINT_PRICE;
  const discountMult = hasDiscount ? 1 - BULK_DISCOUNT_RATE : 1;
  const totalPrice = parseFloat((totalQty * unitPrice * discountMult).toFixed(2));

  const STEPS = [
    { id: 1, label: t('couleur'), done: !!(selectedShopifyColor || store.colorId) },
    { id: 2, label: t('tonLogo'), done: !!store.logoPlacement?.previewUrl },
    { id: 3, label: t('zoneImpression'), done: !!store.logoPlacement?.zoneId },
    { id: 4, label: t('taillesQuantites'), done: totalQty > 0 },
    { id: 5, label: t('resume'), done: false },
  ];

  const canProceed = () => {
    if (store.step === 1) return !!(selectedShopifyColor || store.colorId);
    if (store.step === 2) return !!store.logoPlacement?.previewUrl;
    if (store.step === 3) return !!store.logoPlacement?.zoneId;
    if (store.step === 4) return totalQty > 0;
    return true;
  };

  const handleSelectShopifyColor = (color: ShopifyVariantColor) => {
    setSelectedShopifyColor(color);
    store.setColor(color.variantId);
    if (store.step === 1) store.setStep(2);
  };

  const handleAddToCart = () => {
    const snapshot = store.logoPlacement?.previewUrl ?? activeColor?.imageDevant ?? product.imageDevant;
    cartStore.addItem({
      productId: product.id,
      colorId: activeColor?.id ?? store.colorId,
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

  // Colours to display in ColorPicker — Shopify live or local fallback
  const displayColors: ShopifyVariantColor[] = shopifyColors.length > 0
    ? shopifyColors
    : product.colors.map(c => ({
        variantId: c.id,
        colorName: c.name,
        hex: c.hex,
        imageDevant: c.imageDevant ?? product.imageDevant,
        imageDos: c.imageDos ?? product.imageDos,
        price: product.basePrice.toString(),
        availableForSale: true,
        sizeOptions: product.sizes.map(s => ({ variantId: c.id + '_' + s, size: s, available: true })),
      }));

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[50] flex items-end md:items-center justify-center p-0 md:p-4"
      style={{ background: 'rgba(8,14,32,.72)', backdropFilter: 'blur(18px)' }}
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <motion.div
        initial={{ y: 80, scale: 0.97 }}
        animate={{ y: 0, scale: 1 }}
        exit={{ y: 80, opacity: 0 }}
        transition={{ type: 'spring', stiffness: 260, damping: 28 }}
        className="bg-background w-full md:rounded-2xl md:max-w-5xl border border-border/50 shadow-[0_32px_80px_rgba(0,0,0,0.35)] overflow-hidden"
        style={{ maxHeight: '96dvh', display: 'grid', gridTemplateRows: 'auto 1fr auto' }}
      >
        {/* Header */}
        <div className="px-5 py-3 border-b border-border flex items-center gap-3">
          <div className="flex-shrink-0">
            <h2 className="text-sm font-black text-foreground">{product.shortName}</h2>
            <p className="text-xs text-muted-foreground">Personnalise ton produit</p>
          </div>

          {/* Step indicators */}
          <div className="flex-1 flex items-center justify-center gap-1 overflow-x-auto px-2">
            {STEPS.map((s, i) => (
              <div key={s.id} className="flex items-center gap-1 flex-shrink-0">
                <button
                  onClick={() => s.done && s.id < store.step && store.setStep(s.id as any)}
                  className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold transition-all ${
                    store.step === s.id ? 'bg-primary text-primary-foreground' :
                    s.done ? 'bg-green-100 text-green-700 cursor-pointer' :
                    'text-muted-foreground cursor-default'
                  }`}
                >
                  {s.done && store.step !== s.id ? <Check size={9} /> : <span>{s.id}</span>}
                  <span className="hidden sm:inline">{s.label}</span>
                </button>
                {i < STEPS.length - 1 && <div className="w-2 h-px bg-border flex-shrink-0" />}
              </div>
            ))}
          </div>

          <button onClick={onClose} className="w-8 h-8 rounded-full border border-border flex items-center justify-center text-muted-foreground hover:bg-secondary flex-shrink-0">
            <X size={14} />
          </button>
        </div>

        {/* Body */}
        <div className="overflow-auto grid md:grid-cols-[1.45fr_1fr] divide-y md:divide-y-0 md:divide-x divide-border">

          {/* LEFT — 3D viewer + live colour swatches */}
          <div className="p-4 space-y-3">
            <ProductViewer3D
              product={product}
              selectedColor={activeColor}
              logoPlacement={store.logoPlacement}
              activeView={store.activeView}
              onViewChange={store.setView}
            />

            {/* Colour palette — always visible under 3D */}
            <div>
              <p className="text-[11px] font-bold text-muted-foreground mb-2 flex items-center gap-1.5">
                {t('couleur')}
                {colorsLoading && <Loader2 size={10} className="animate-spin" />}
                {!colorsLoading && shopifyColors.length > 0 && (
                  <span className="text-green-600 font-bold">· {shopifyColors.length} couleurs</span>
                )}
              </p>
              <ColorPicker
                colors={displayColors}
                loading={colorsLoading}
                selectedColorName={selectedShopifyColor?.colorName ?? null}
                onSelect={handleSelectShopifyColor}
                compact
              />
            </div>
          </div>

          {/* RIGHT — Step panel */}
          <div className="p-4 overflow-auto">
            <AnimatePresence mode="wait">

              {/* STEP 1 — Colour */}
              {store.step === 1 && (
                <motion.div key="s1" initial={{ opacity:0, x:16 }} animate={{ opacity:1, x:0 }} exit={{ opacity:0, x:-16 }}>
                  <h3 className="text-sm font-black mb-1">{t('choisirCouleur')}</h3>
                  <p className="text-xs text-muted-foreground mb-3">
                    {colorsLoading ? 'Chargement depuis Shopify...' : `${displayColors.length} couleurs disponibles · La couleur s'applique en direct sur le modèle 3D`}
                  </p>
                  <ColorPicker
                    colors={displayColors}
                    loading={colorsLoading}
                    selectedColorName={selectedShopifyColor?.colorName ?? null}
                    onSelect={handleSelectShopifyColor}
                  />

                  {/* Front/Back preview for selected colour */}
                  {selectedShopifyColor && (
                    <motion.div initial={{ opacity:0, y:8 }} animate={{ opacity:1, y:0 }} className="mt-4 grid grid-cols-2 gap-2">
                      {[
                        { url: selectedShopifyColor.imageDevant, label: t('devant') },
                        { url: selectedShopifyColor.imageDos ?? selectedShopifyColor.imageDevant, label: t('dos') },
                      ].map(({ url, label }) => url && (
                        <div key={label} className="rounded-xl overflow-hidden border border-border bg-secondary">
                          <img src={url} alt={label} className="w-full aspect-square object-cover" />
                          <p className="text-center text-[10px] font-bold text-muted-foreground py-1.5">{label}</p>
                        </div>
                      ))}
                    </motion.div>
                  )}
                </motion.div>
              )}

              {/* STEP 2 — Logo upload */}
              {store.step === 2 && (
                <motion.div key="s2" initial={{ opacity:0, x:16 }} animate={{ opacity:1, x:0 }} exit={{ opacity:0, x:-16 }}>
                  <h3 className="text-sm font-black mb-1">{t('tonLogo')}</h3>
                  <p className="text-xs text-muted-foreground mb-3">PNG, JPG, SVG · Fond supprimé automatiquement</p>
                  <LogoUploader
                    onLogoReady={(previewUrl, processedUrl, file) => {
                      const firstZone = product.printZones[0];
                      store.setLogoPlacement({
                        zoneId: firstZone?.id ?? '', mode: 'preset',
                        previewUrl, processedUrl, originalFile: file,
                        x: firstZone?.x, y: firstZone?.y, width: firstZone?.width,
                      });
                      store.setStep(3);
                    }}
                  />
                </motion.div>
              )}

              {/* STEP 3 — Placement */}
              {store.step === 3 && store.logoPlacement?.previewUrl && (
                <motion.div key="s3" initial={{ opacity:0, x:16 }} animate={{ opacity:1, x:0 }} exit={{ opacity:0, x:-16 }}>
                  <h3 className="text-sm font-black mb-1">{t('zoneImpression')}</h3>
                  <p className="text-xs text-muted-foreground mb-2">Zones recommandées ou placement libre</p>
                  <PlacementSelector
                    product={product}
                    selectedColor={activeColor}
                    logoPreviewUrl={store.logoPlacement.previewUrl}
                    currentPlacement={store.logoPlacement}
                    onPlacementChange={p => store.setLogoPlacement(p)}
                  />
                </motion.div>
              )}

              {/* STEP 4 — Sizes */}
              {store.step === 4 && (
                <motion.div key="s4" initial={{ opacity:0, x:16 }} animate={{ opacity:1, x:0 }} exit={{ opacity:0, x:-16 }}>
                  <h3 className="text-sm font-black mb-1">{t('taillesQuantites')}</h3>
                  <p className="text-xs text-muted-foreground mb-3">Rabais de 15% dès 12 unités</p>

                  {/* Use Shopify size options if available */}
                  {selectedShopifyColor?.sizeOptions.length ? (
                    <SizeQuantityPicker
                      product={{ ...product, sizes: selectedShopifyColor.sizeOptions.map(s => s.size) }}
                      sizeQuantities={store.sizeQuantities}
                      onUpdate={store.setSizeQuantity}
                    />
                  ) : (
                    <SizeQuantityPicker
                      product={product}
                      sizeQuantities={store.sizeQuantities}
                      onUpdate={store.setSizeQuantity}
                    />
                  )}
                </motion.div>
              )}

              {/* STEP 5 — Summary */}
              {store.step === 5 && (
                <motion.div key="s5" initial={{ opacity:0, x:16 }} animate={{ opacity:1, x:0 }} exit={{ opacity:0, x:-16 }} className="space-y-3">
                  <h3 className="text-sm font-black">{t('resume')}</h3>
                  <div className="bg-secondary rounded-xl p-4 space-y-2">
                    {[
                      [t('produit'),       product.shortName],
                      [t('couleurLabel'),  activeColor?.name ?? '—'],
                      [t('quantiteTotale'), `${totalQty} ${totalQty !== 1 ? 'unités' : 'unité'}`],
                      [t('prixUnitaire'),  `${product.basePrice.toFixed(2)} $`],
                      [t('impression'),    `${PRINT_PRICE.toFixed(2)} $`],
                    ].map(([l, v]) => (
                      <div key={l} className="flex justify-between text-sm">
                        <span className="text-muted-foreground">{l}</span>
                        <span className="font-bold">{v}</span>
                      </div>
                    ))}
                    {hasDiscount && (
                      <div className="flex justify-between text-sm text-green-700">
                        <span>Rabais quantité (12+)</span>
                        <span className="font-bold">−15%</span>
                      </div>
                    )}
                    <div className="border-t border-border pt-2 flex justify-between">
                      <span className="font-black">{t('totalEstime')}</span>
                      <span className="font-black text-primary text-base">{totalPrice.toFixed(2)} $</span>
                    </div>
                  </div>

                  {/* Logo + colour preview */}
                  {store.logoPlacement?.previewUrl && activeColor && (
                    <div className="flex gap-3 p-3 bg-secondary rounded-xl border border-border">
                      <img src={store.logoPlacement.previewUrl} alt="Logo" className="w-12 h-12 object-contain rounded-lg border border-border" />
                      <div>
                        <p className="text-xs font-bold text-foreground">{product.name}</p>
                        <div className="flex items-center gap-1.5 mt-1">
                          <div className="w-3 h-3 rounded-full ring-1 ring-border" style={{ background: activeColor.hex }} />
                          <span className="text-xs text-muted-foreground">{activeColor.name}</span>
                        </div>
                      </div>
                    </div>
                  )}

                  <p className="text-xs text-muted-foreground text-center">{t('taxesNote')}</p>
                </motion.div>
              )}

            </AnimatePresence>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-border flex items-center justify-between bg-background">
          <button
            onClick={() => store.setStep(Math.max(1, store.step - 1) as any)}
            disabled={store.step === 1}
            className="flex items-center gap-1.5 text-sm font-bold text-muted-foreground disabled:opacity-25 hover:text-foreground transition-colors"
          >
            <ChevronLeft size={15} /> {t('retour')}
          </button>

          {totalQty > 0 && (
            <div className="text-center">
              <div className="text-[10px] text-muted-foreground">{totalQty} {totalQty !== 1 ? 'unités' : 'unité'}</div>
              <div className="text-sm font-black text-primary">{totalPrice.toFixed(2)} $</div>
            </div>
          )}

          {store.step < 5 ? (
            <button
              onClick={() => canProceed() && store.setStep((store.step + 1) as any)}
              disabled={!canProceed()}
              className="flex items-center gap-1.5 bg-primary text-primary-foreground text-sm font-black px-5 py-2.5 rounded-full disabled:opacity-35 hover:opacity-90 transition-all"
            >
              {t('suivant')} <ChevronRight size={15} />
            </button>
          ) : (
            <button
              onClick={handleAddToCart}
              disabled={totalQty === 0}
              className="flex items-center gap-2 gradient-navy-dark text-primary-foreground text-sm font-black px-5 py-2.5 rounded-full disabled:opacity-35 transition-all shadow-navy hover:opacity-90"
            >
              <ShoppingBag size={14} /> {t('ajouterPanier')}
            </button>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}
