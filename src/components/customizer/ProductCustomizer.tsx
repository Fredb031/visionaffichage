/**
 * ProductCustomizer — 5-step modal
 * Fixes applied:
 *  - Full i18n (no more hardcoded French)
 *  - REMOVED step-1 product image thumbnails (they showed Shopify CDN mockup
 *    images with "VOTRE LOGO" embedded in the actual JPG — causing logo
 *    duplication on step 3). The 3D viewer on the left already shows the garment.
 */
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ShoppingBag, ChevronRight, ChevronLeft, Check } from 'lucide-react';
import { ProductCanvas } from './ProductCanvas';
import { LogoUploader } from './LogoUploader';
import { SizeQuantityPicker } from './SizeQuantityPicker';
import { ColorPicker } from './ColorPicker';
import { useCustomizerStore } from '@/store/customizerStore';
import { useCartStore } from '@/store/cartStore';
import { useCartStore as useShopifyCartStore } from '@/stores/cartStore';
import { useProductColors } from '@/hooks/useProductColors';
import { PRODUCTS, PRINT_PRICE, BULK_DISCOUNT_THRESHOLD, BULK_DISCOUNT_RATE } from '@/data/products';
import type { ShopifyVariantColor, ShopifyProduct } from '@/lib/shopify';
import type { ProductColor } from '@/data/products';
import { useLang } from '@/lib/langContext';

export function ProductCustomizer({ productId, onClose }: { productId: string; onClose: () => void }) {
  const { t, lang } = useLang();
  const store    = useCustomizerStore();
  const cartStore = useCartStore();
  const shopifyCartStore = useShopifyCartStore();

  const product = PRODUCTS.find(p => p.id === productId);
  if (!product) return null;

  // Init store when productId changes
  if (store.productId !== productId) store.setProduct(productId);

  // Live Shopify colours (falls back gracefully)
  const { data: shopifyColors = [], isLoading: colorsLoading } = useProductColors(product.shopifyHandle);

  // Selected colour — single state, either Shopify variant or local
  const [shopifyColor, setShopifyColor] = useState<ShopifyVariantColor | null>(null);

  // The active ProductColor used by the 3D viewer
  const activeColor: ProductColor | null = shopifyColor
    ? {
        id: shopifyColor.variantId,
        name: shopifyColor.colorName,
        nameEn: shopifyColor.colorName,
        hex: shopifyColor.hex,
        imageDevant: shopifyColor.imageDevant ?? product.imageDevant,
        imageDos:    shopifyColor.imageDos    ?? product.imageDos,
      }
    : (product.colors.find(c => c.id === store.colorId) ?? product.colors[0] ?? null);

  const totalQty    = store.getTotalQuantity();
  const hasDiscount = totalQty >= BULK_DISCOUNT_THRESHOLD;
  const unitPrice   = product.basePrice + PRINT_PRICE;
  const discount    = hasDiscount ? 1 - BULK_DISCOUNT_RATE : 1;
  const totalPrice  = parseFloat((totalQty * unitPrice * discount).toFixed(2));

  const colorChosen = !!(shopifyColor || store.colorId);

  const STEPS = [
    { id: 1, label: t('couleur'),         done: colorChosen },
    { id: 2, label: t('tonLogo'),         done: !!store.logoPlacement?.previewUrl },
    { id: 3, label: t('zoneImpression'),  done: !!store.logoPlacement?.zoneId },
    { id: 4, label: t('taillesQuantites'),done: totalQty > 0 },
    { id: 5, label: t('resume'),          done: false },
  ];

  const canNext = () => {
    if (store.step === 1) return colorChosen;
    if (store.step === 2) return !!store.logoPlacement?.previewUrl;
    if (store.step === 3) return !!store.logoPlacement?.zoneId;
    if (store.step === 4) return totalQty > 0;
    return true;
  };

  const goNext = () => { if (canNext()) store.setStep((store.step + 1) as any); };
  const goBack = () => store.setStep(Math.max(1, store.step - 1) as any);

  const handleSelectColor = (c: ShopifyVariantColor) => {
    setShopifyColor(c);
    store.setColor(c.variantId);
  };

  const handleAddToCart = async () => {
    if (shopifyColor && totalQty > 0) {
      const minimalProduct: ShopifyProduct = {
        node: {
          id: shopifyColor.variantId,
          title: product.name,
          description: product.description,
          handle: product.shopifyHandle,
          productType: '',
          tags: [],
          priceRange: {
            minVariantPrice: { amount: product.basePrice.toFixed(2), currencyCode: 'CAD' },
          },
          images: {
            edges: [{ node: { url: shopifyColor.imageDevant ?? product.imageDevant, altText: product.shortName } }],
          },
          variants: {
            edges: [{
              node: {
                id: shopifyColor.variantId,
                title: shopifyColor.colorName,
                price: { amount: shopifyColor.price, currencyCode: 'CAD' },
                availableForSale: true,
                selectedOptions: [{ name: 'Couleur', value: shopifyColor.colorName }],
                image: null,
              },
            }],
          },
          options: [{ name: 'Couleur', values: [shopifyColor.colorName] }],
        },
      };
      await shopifyCartStore.addItem({
        product: minimalProduct,
        variantId: shopifyColor.variantId,
        variantTitle: shopifyColor.colorName,
        price: { amount: (unitPrice * discount).toFixed(2), currencyCode: 'CAD' },
        quantity: totalQty,
        selectedOptions: [{ name: 'Couleur', value: shopifyColor.colorName }],
      });
    }

    cartStore.addItem({
      productId: product.id,
      colorId: activeColor?.id ?? '',
      logoPlacement: store.logoPlacement,
      sizeQuantities: store.sizeQuantities,
      activeView: store.activeView,
      step: store.step,
      productName: product.name,
      previewSnapshot: store.logoPlacement?.previewUrl ?? activeColor?.imageDevant ?? product.imageDevant,
      unitPrice: unitPrice * discount,
      totalQuantity: totalQty,
      totalPrice,
    });

    store.reset();
    onClose();
  };

  const displayColors: ShopifyVariantColor[] = shopifyColors.length > 0
    ? shopifyColors
    : product.colors.map(c => ({
        variantId: c.id, colorName: c.name, hex: c.hex,
        imageDevant: c.imageDevant ?? product.imageDevant,
        imageDos: c.imageDos ?? product.imageDos,
        price: product.basePrice.toString(),
        availableForSale: true,
        sizeOptions: product.sizes.map(s => ({ variantId: `${c.id}_${s}`, size: s, available: true })),
      }));

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-[50] flex items-end md:items-center justify-center p-0 md:p-4"
      style={{ background: 'rgba(8,14,32,.75)', backdropFilter: 'blur(18px)' }}
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <motion.div
        initial={{ y: 80, scale: 0.97 }} animate={{ y: 0, scale: 1 }} exit={{ y: 80, opacity: 0 }}
        transition={{ type: 'spring', stiffness: 260, damping: 28 }}
        className="bg-background w-full md:rounded-2xl md:max-w-5xl border border-border/50 shadow-[0_32px_80px_rgba(0,0,0,0.35)] overflow-hidden"
        style={{ maxHeight: '96dvh', display: 'grid', gridTemplateRows: 'auto 1fr auto' }}
      >
        {/* ── Header ── */}
        <div className="px-5 py-3 border-b border-border flex items-center gap-3">
          <div className="flex-shrink-0">
            <h2 className="text-sm font-black text-foreground">{product.shortName}</h2>
            <p className="text-xs text-muted-foreground">{t('personnaliseTonProduit')}</p>
          </div>

          {/* Step indicators */}
          <div className="flex-1 flex items-center justify-center gap-1 overflow-x-auto px-1 scrollbar-hide">
            {STEPS.map((s, i) => (
              <div key={s.id} className="flex items-center gap-1 flex-shrink-0">
                <button
                  onClick={() => s.done && s.id < store.step && store.setStep(s.id as any)}
                  className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold transition-all ${
                    store.step === s.id ? 'bg-primary text-primary-foreground' :
                    s.done ? 'bg-green-100 text-green-700 cursor-pointer hover:bg-green-200' :
                    'text-muted-foreground cursor-default'
                  }`}
                >
                  {s.done && store.step !== s.id ? <Check size={9} /> : <span>{s.id}</span>}
                  <span className="hidden sm:inline">{s.label}</span>
                </button>
                {i < STEPS.length - 1 && <div className="w-1.5 h-px bg-border flex-shrink-0" />}
              </div>
            ))}
          </div>

          <button onClick={onClose} className="w-8 h-8 rounded-full border border-border flex items-center justify-center text-muted-foreground hover:bg-secondary flex-shrink-0 transition-colors">
            <X size={14} />
          </button>
        </div>

        {/* ── Body ── */}
        <div className="overflow-auto grid md:grid-cols-[1.4fr_1fr] divide-y md:divide-y-0 md:divide-x divide-border">

          {/* LEFT — Single interactive canvas (CustomInk-style: customize and preview in one) */}
          <div className="p-4 space-y-3 flex flex-col">
            <ProductCanvas
              product={product}
              garmentColor={activeColor?.hex}
              imageDevant={activeColor?.imageDevant ?? product.imageDevant}
              imageDos={activeColor?.imageDos ?? product.imageDos}
              logoUrl={store.logoPlacement?.previewUrl ?? null}
              currentPlacement={store.logoPlacement}
              activeView={store.activeView}
              onViewChange={store.setView}
              onPlacementChange={p => store.setLogoPlacement(p)}
            />

            <div>
              <p className="text-[11px] font-bold text-muted-foreground mb-2">
                {t('couleur')}
                {!colorsLoading && shopifyColors.length > 0 && (
                  <span className="ml-1 text-green-600">
                    · {shopifyColors.length} {lang === 'en' ? 'colors' : 'couleurs'}
                  </span>
                )}
              </p>
              <ColorPicker
                colors={displayColors}
                loading={colorsLoading}
                selectedColorName={shopifyColor?.colorName ?? activeColor?.name ?? null}
                onSelect={handleSelectColor}
                compact
              />
            </div>
          </div>

          {/* RIGHT — Step content */}
          <div className="p-4 overflow-auto">
            <AnimatePresence mode="wait">

              {/* Step 1 — Choose colour */}
              {store.step === 1 && (
                <motion.div key="s1" initial={{ opacity:0, x:16 }} animate={{ opacity:1, x:0 }} exit={{ opacity:0, x:-16 }}>
                  <h3 className="text-sm font-black mb-1">{t('choisirCouleur')}</h3>
                  <p className="text-xs text-muted-foreground mb-3">
                    {colorsLoading
                      ? t('chargementCouleurs')
                      : t('couleursDisponibles', displayColors.length)}
                  </p>
                  <ColorPicker
                    colors={displayColors}
                    loading={colorsLoading}
                    selectedColorName={shopifyColor?.colorName ?? null}
                    onSelect={c => { handleSelectColor(c); goNext(); }}
                  />
                </motion.div>
              )}

              {/* Step 2 — Upload logo */}
              {store.step === 2 && (
                <motion.div key="s2" initial={{ opacity:0, x:16 }} animate={{ opacity:1, x:0 }} exit={{ opacity:0, x:-16 }}>
                  <h3 className="text-sm font-black mb-1">{t('tonLogo')}</h3>
                  <p className="text-xs text-muted-foreground mb-3">{t('fondSupprimeAuto')}</p>
                  <LogoUploader
                    onLogoReady={(previewUrl, processedUrl, file) => {
                      const zone = product.printZones[0];
                      store.setLogoPlacement({
                        zoneId: zone?.id ?? 'centre',
                        mode: 'preset',
                        previewUrl, processedUrl, originalFile: file,
                        x: zone?.x, y: zone?.y, width: zone?.width,
                      });
                      goNext();
                    }}
                  />
                </motion.div>
              )}

              {/* Step 3 — Logo placement instructions (the canvas on the left IS the editor) */}
              {store.step === 3 && store.logoPlacement?.previewUrl && (
                <motion.div key="s3" initial={{ opacity:0, x:16 }} animate={{ opacity:1, x:0 }} exit={{ opacity:0, x:-16 }} className="space-y-3">
                  <h3 className="text-sm font-black mb-1">{t('zoneImpression')}</h3>
                  <p className="text-xs text-muted-foreground">
                    {lang === 'en'
                      ? 'Drag your logo on the preview to position it. Use the corner handles to resize, the rotation handle to angle it, or pick a preset zone below.'
                      : "Glisse ton logo sur l'aperçu pour le positionner. Utilise les coins pour le redimensionner, la poignée du haut pour le pivoter, ou choisis une zone prédéfinie ci-dessous."}
                  </p>
                  <div className="space-y-1.5">
                    {product.printZones.map(z => {
                      const active = store.logoPlacement?.zoneId === z.id;
                      return (
                        <button
                          key={z.id}
                          onClick={() => store.setLogoPlacement({
                            ...store.logoPlacement!,
                            zoneId: z.id,
                            mode: 'preset',
                            x: z.x + z.width / 2,
                            y: z.y + z.height / 2,
                            width: z.width * 0.85,
                          })}
                          className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl border text-left text-xs font-semibold transition-all ${
                            active
                              ? 'border-primary bg-primary/5 text-primary'
                              : 'border-border text-muted-foreground hover:border-primary/40'
                          }`}
                        >
                          <div className={`w-2 h-2 rounded-full flex-shrink-0 ${active ? 'bg-primary' : 'bg-border'}`} />
                          {z.label}
                        </button>
                      );
                    })}
                  </div>
                </motion.div>
              )}

              {/* Step 4 — Sizes */}
              {store.step === 4 && (
                <motion.div key="s4" initial={{ opacity:0, x:16 }} animate={{ opacity:1, x:0 }} exit={{ opacity:0, x:-16 }}>
                  <h3 className="text-sm font-black mb-1">{t('taillesQuantites')}</h3>
                  <p className="text-xs text-muted-foreground mb-3">{t('rabaisVolume12')}</p>
                  <SizeQuantityPicker
                    product={shopifyColor?.sizeOptions.length
                      ? { ...product, sizes: shopifyColor.sizeOptions.map(s => s.size) }
                      : product}
                    sizeQuantities={store.sizeQuantities}
                    onUpdate={store.setSizeQuantity}
                  />
                </motion.div>
              )}

              {/* Step 5 — Summary */}
              {store.step === 5 && (
                <motion.div key="s5" initial={{ opacity:0, x:16 }} animate={{ opacity:1, x:0 }} exit={{ opacity:0, x:-16 }} className="space-y-3">
                  <h3 className="text-sm font-black">{t('resume')}</h3>
                  <div className="bg-secondary rounded-xl p-4 space-y-2.5">
                    {[
                      [t('produit'),        product.shortName],
                      [t('couleurLabel'),   activeColor?.name ?? '—'],
                      [t('quantiteTotale'), `${totalQty} ${t(totalQty !== 1 ? 'unitPluralLabel' : 'unitLabel')}`],
                      [t('prixUnitaire'),   `${product.basePrice.toFixed(2)} $`],
                      [t('impression'),     `${PRINT_PRICE.toFixed(2)} $`],
                    ].map(([l, v]) => (
                      <div key={l} className="flex justify-between text-sm">
                        <span className="text-muted-foreground">{l}</span>
                        <span className="font-bold">{v}</span>
                      </div>
                    ))}
                    {hasDiscount && (
                      <div className="flex justify-between text-sm text-green-700">
                        <span>{t('rabaisQuantite')}</span>
                        <span className="font-bold">−15%</span>
                      </div>
                    )}
                    <div className="border-t border-border pt-2.5 flex justify-between">
                      <span className="font-black">{t('totalEstime')}</span>
                      <span className="font-black text-primary text-lg">{totalPrice.toFixed(2)} $</span>
                    </div>
                  </div>
                  {store.logoPlacement?.previewUrl && (
                    <div className="flex gap-3 items-center p-3 bg-secondary rounded-xl border border-border">
                      <img src={store.logoPlacement.previewUrl} alt="Logo" className="w-12 h-12 object-contain rounded-lg border border-border bg-white" />
                      <div>
                        <p className="text-xs font-bold">{product.shortName} · {activeColor?.name}</p>
                        <p className="text-[11px] text-muted-foreground mt-0.5">
                          {totalQty} {t(totalQty !== 1 ? 'unitPluralLabel' : 'unitLabel')} · {totalPrice.toFixed(2)} $
                        </p>
                      </div>
                      {activeColor && (
                        <div className="ml-auto w-6 h-6 rounded-full ring-1 ring-border" style={{ background: activeColor.hex }} />
                      )}
                    </div>
                  )}
                  <p className="text-xs text-muted-foreground text-center">{t('taxesNote')}</p>
                </motion.div>
              )}

            </AnimatePresence>
          </div>
        </div>

        {/* ── Footer ── */}
        <div className="px-5 py-3.5 border-t border-border flex items-center justify-between bg-background">
          <button onClick={goBack} disabled={store.step === 1}
            className="flex items-center gap-1.5 text-sm font-bold text-muted-foreground disabled:opacity-20 hover:text-foreground transition-colors"
          >
            <ChevronLeft size={15} /> {t('retour')}
          </button>

          {totalQty > 0 && store.step >= 4 && (
            <div className="text-center">
              <div className="text-[10px] text-muted-foreground">
                {totalQty} {t(totalQty !== 1 ? 'unitPluralLabel' : 'unitLabel')}
              </div>
              <div className="text-sm font-black text-primary">{totalPrice.toFixed(2)} $</div>
            </div>
          )}

          {store.step < 5 ? (
            <button onClick={goNext} disabled={!canNext()}
              className="flex items-center gap-1.5 bg-primary text-primary-foreground text-sm font-black px-5 py-2.5 rounded-full disabled:opacity-30 hover:opacity-90 transition-all"
            >
              {t('suivant')} <ChevronRight size={15} />
            </button>
          ) : (
            <button onClick={handleAddToCart} disabled={totalQty === 0}
              className="flex items-center gap-2 bg-primary text-primary-foreground text-sm font-black px-5 py-2.5 rounded-full disabled:opacity-30 hover:opacity-90 transition-all shadow-md"
            >
              <ShoppingBag size={14} /> {t('ajouterPanier')}
            </button>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}
