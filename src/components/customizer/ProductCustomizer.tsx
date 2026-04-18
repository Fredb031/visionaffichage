/**
 * ProductCustomizer — 5-step modal
 * Fixes applied:
 *  - Full i18n (no more hardcoded French)
 *  - REMOVED step-1 product image thumbnails (they showed Shopify CDN mockup
 *    images with "VOTRE LOGO" embedded in the actual JPG — causing logo
 *    duplication on step 3). The 3D viewer on the left already shows the garment.
 */
import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ShoppingBag, ChevronRight, ChevronLeft, Check } from 'lucide-react';
import { toast } from 'sonner';
import { ProductCanvas } from './ProductCanvas';
import { LogoUploader } from './LogoUploader';
import { SizeQuantityPicker } from './SizeQuantityPicker';
import { MultiVariantPicker, type VariantQty } from './MultiVariantPicker';
import { ColorPicker } from './ColorPicker';
import { useCustomizerStore } from '@/store/customizerStore';
import { useCartStore } from '@/store/cartStore';
import { useCartStore as useShopifyCartStore } from '@/stores/cartStore';
import { useProductColors } from '@/hooks/useProductColors';
import { PRODUCTS, PRINT_PRICE, BULK_DISCOUNT_THRESHOLD, BULK_DISCOUNT_RATE, findColorImage } from '@/data/products';
import type { ShopifyVariantColor, ShopifyProduct } from '@/lib/shopify';
import type { ProductColor } from '@/data/products';
import { useLang } from '@/lib/langContext';

export function ProductCustomizer({ productId, onClose }: { productId: string; onClose: () => void }) {
  const { t, lang } = useLang();
  const store    = useCustomizerStore();
  const cartStore = useCartStore();
  const shopifyCartStore = useShopifyCartStore();

  const product = PRODUCTS.find(p => p.id === productId);

  // Init store when productId changes — use effect to avoid
  // "Cannot update a component while rendering" warnings.
  useEffect(() => {
    if (product && store.productId !== productId) store.setProduct(productId);
  }, [productId, product, store]);

  // If the canvas-level trash removed the logo while we're on step 3
  // (preview gone), bounce back to step 2 so the user can re-upload.
  useEffect(() => {
    if (store.step === 3 && !store.logoPlacement?.previewUrl) {
      store.setStep(2);
    }
  }, [store.step, store.logoPlacement?.previewUrl, store]);

  if (!product) return null;

  // Live Shopify colours (falls back gracefully)
  const { data: shopifyColors = [], isLoading: colorsLoading } = useProductColors(product.shopifyHandle);

  // Selected colour — single state, either Shopify variant or local
  const [shopifyColor, setShopifyColor] = useState<ShopifyVariantColor | null>(null);
  // Step 4: multi-color × multi-size matrix
  const [multiVariants, setMultiVariants] = useState<VariantQty[]>([]);
  // Debounce guard against double-click double-add
  const [adding, setAdding] = useState(false);

  // The active ProductColor — uses per-colour Drive images when available,
  // falls back to the product's default (black) image + tint overlay
  const activeColor: ProductColor | null = (() => {
    if (shopifyColor) {
      // Look for a per-colour Drive image matching this colour name
      const colorImg = findColorImage(product.sku, shopifyColor.colorName);
      return {
        id: shopifyColor.variantId,
        name: shopifyColor.colorName,
        nameEn: shopifyColor.colorName,
        hex: shopifyColor.hex,
        imageDevant: colorImg?.front ?? product.imageDevant,
        imageDos:    colorImg?.back  ?? product.imageDos,
      };
    }
    const localColor = product.colors.find(c => c.id === store.colorId) ?? product.colors[0] ?? null;
    if (localColor) {
      // Also try per-colour Drive image for local colours
      const colorImg = findColorImage(product.sku, localColor.nameEn);
      if (colorImg) {
        return {
          ...localColor,
          imageDevant: colorImg.front ?? localColor.imageDevant ?? product.imageDevant,
          imageDos:    colorImg.back  ?? localColor.imageDos    ?? product.imageDos,
        };
      }
    }
    return localColor;
  })();

  const multiTotalQty = multiVariants.reduce((s, v) => s + v.qty, 0);
  const totalQty    = multiTotalQty > 0 ? multiTotalQty : store.getTotalQuantity();
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
    if (adding) return;
    setAdding(true);
    try {
    // ── Multi-variant flow: emit ONE local cart line per color group AND
    //    push each (color × size) Shopify variant to the Shopify cart store
    //    so checkoutUrl resolves at /checkout. Without this push, the local
    //    UI shows items but Shopify never sees them → checkout = null.
    if (multiVariants.length > 0) {
      const byColor = new Map<string, { color: VariantQty; sizes: { size: string; qty: number }[]; total: number }>();
      for (const v of multiVariants) {
        const existing = byColor.get(v.colorId);
        if (existing) {
          existing.sizes.push({ size: v.size, qty: v.qty });
          existing.total += v.qty;
        } else {
          byColor.set(v.colorId, {
            color: v,
            sizes: [{ size: v.size, qty: v.qty }],
            total: v.qty,
          });
        }
      }

      // 1) Local cart lines (for cart UI display) — track shopifyVariantIds
      //    so removing the line later also removes from Shopify.
      for (const [colorId, group] of byColor.entries()) {
        const colorImg = findColorImage(product.sku, group.color.colorName);
        const linePreview = store.logoPlacement?.previewUrl ?? colorImg?.front ?? product.imageDevant;
        const variantIdsForLine = multiVariants
          .filter(v => v.colorId === colorId && v.shopifyVariantId)
          .map(v => v.shopifyVariantId as string);
        cartStore.addItem({
          productId: product.id,
          colorId: group.color.colorId,
          logoPlacement: store.logoPlacement,
          sizeQuantities: group.sizes,
          activeView: store.activeView,
          step: store.step,
          productName: `${product.name} — ${group.color.colorName}`,
          previewSnapshot: linePreview,
          unitPrice: unitPrice * discount,
          totalQuantity: group.total,
          totalPrice: parseFloat((group.total * unitPrice * discount).toFixed(2)),
          shopifyVariantIds: variantIdsForLine,
        });
      }

      // 2) Shopify cart sync — one line per (color × size) Shopify variant
      const minimalProduct: ShopifyProduct = {
        node: {
          id: product.id,
          title: product.name,
          description: product.description,
          handle: product.shopifyHandle,
          productType: '',
          tags: [],
          priceRange: { minVariantPrice: { amount: product.basePrice.toFixed(2), currencyCode: 'CAD' } },
          images: { edges: [{ node: { url: product.imageDevant, altText: product.shortName } }] },
          variants: { edges: [] },
          options: [{ name: 'Couleur', values: [] }],
        },
      };

      for (const v of multiVariants) {
        if (!v.shopifyVariantId) {
          console.warn('Skipping Shopify sync — no variantId for', v.colorName, v.size);
          continue;
        }
        await shopifyCartStore.addItem({
          product: minimalProduct,
          variantId: v.shopifyVariantId,
          variantTitle: `${v.colorName} / ${v.size}`,
          price: { amount: (unitPrice * discount).toFixed(2), currencyCode: 'CAD' },
          quantity: v.qty,
          selectedOptions: [
            { name: 'Couleur', value: v.colorName },
            { name: 'Taille', value: v.size },
          ],
        });
      }
    } else if (shopifyColor && totalQty > 0) {
      // ── Legacy single-color flow (fallback) ──
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
            edges: [{ node: { url: product.imageDevant, altText: product.shortName } }],
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
    }

    const colorCount = multiVariants.length > 0 ? new Set(multiVariants.map(v => v.colorId)).size : 1;
    store.reset();
    setMultiVariants([]);
    onClose();
    toast.success(
      lang === 'en'
        ? `${product.shortName} × ${colorCount > 1 ? `${colorCount} colors` : '1 color'} added to cart!`
        : `${product.shortName} × ${colorCount > 1 ? `${colorCount} couleurs` : '1 couleur'} ajouté au panier !`,
      { duration: 3000 },
    );
    } finally {
      setAdding(false);
    }
  };

  // ALL colors stay visible — never hide one (Black + others must always
  // be selectable). The "Real color" badge inside the canvas signals
  // whether the picked color comes with a true per-color image.
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
      className="fixed inset-0 z-[600] flex items-end md:items-center justify-center p-0 md:p-4"
      style={{ background: 'rgba(8,14,32,.75)', backdropFilter: 'blur(18px)' }}
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <motion.div
        initial={{ y: 80, scale: 0.97 }} animate={{ y: 0, scale: 1 }} exit={{ y: 80, opacity: 0 }}
        transition={{ type: 'spring', stiffness: 260, damping: 28 }}
        className="bg-background w-full md:rounded-2xl md:max-w-5xl border border-border/50 shadow-[0_32px_80px_rgba(0,0,0,0.35)] overflow-hidden"
        style={{ maxHeight: '92dvh', height: '92dvh', display: 'grid', gridTemplateRows: 'auto minmax(0, 1fr) auto' }}
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
        <div className="overflow-auto grid md:grid-cols-[1.2fr_1fr] divide-y md:divide-y-0 md:divide-x divide-border min-h-0">

          {/* LEFT — Single interactive canvas (CustomInk-style: customize and preview in one) */}
          <div className="p-3 md:p-4 space-y-2.5 flex flex-col min-h-0">
            <ProductCanvas
              product={product}
              garmentColor={activeColor?.hex}
              hasRealColorImage={activeColor?.imageDevant !== product.imageDevant}
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
                        // Zone center — NOT top-left. Top-left would put
                        // the logo at the corner of the print zone, not
                        // visually inside it.
                        x: zone ? zone.x + zone.width / 2 : undefined,
                        y: zone ? zone.y + zone.height / 2 : undefined,
                        width: zone ? zone.width * 0.85 : undefined,
                      });
                      goNext();
                    }}
                  />
                </motion.div>
              )}

              {/* Step 3 — Logo placement with visual presets */}
              {store.step === 3 && store.logoPlacement?.previewUrl && (
                <motion.div key="s3" initial={{ opacity:0, x:16 }} animate={{ opacity:1, x:0 }} exit={{ opacity:0, x:-16 }} className="space-y-4">
                  <div>
                    <h3 className="text-sm font-black mb-1">{t('zoneImpression')}</h3>
                    <p className="text-xs text-muted-foreground">
                      {lang === 'en'
                        ? 'Pick a position or drag your logo freely on the preview.'
                        : 'Choisis une position ou glisse ton logo librement sur le produit.'}
                    </p>
                  </div>

                  {/* Quick CENTER button — true visual center of the garment.
                      Uses the picked zone's WIDTH for sizing but always
                      places the logo at the EXACT geometric center of the
                      product photo (x=50, y=50 in canvas %). Many garment
                      photos have the shirt centered vertically too, so this
                      is the "center of the shirt" the customer expects when
                      they say 'center'. */}
                  <button
                    type="button"
                    onClick={() => {
                      const zone = product.printZones.find(z => /centre|center|coeur|heart|chest|poitrine/i.test(z.label) || /centre|center|coeur|heart|chest|poitrine/i.test(z.labelEn ?? '')) ?? product.printZones[0];
                      const widthPct = zone ? Math.min(zone.width * 0.85, 32) : 26;
                      store.setLogoPlacement({
                        ...store.logoPlacement!,
                        zoneId: zone?.id ?? 'centre-vetement',
                        mode: 'preset',
                        x: 50,
                        y: 50,
                        width: widthPct,
                      });
                    }}
                    className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-gradient-to-br from-[#0052CC] to-[#1B3A6B] text-white text-sm font-extrabold shadow-md hover:shadow-lg hover:-translate-y-px transition-all"
                  >
                    <span aria-hidden="true">⊕</span>
                    {lang === 'en' ? 'Center on garment (50/50)' : 'Centrer sur le vêtement (50/50)'}
                  </button>

                  {/* Quick CHEST button — chest area (the typical logo spot) */}
                  <button
                    type="button"
                    onClick={() => {
                      const zone = product.printZones.find(z => /poitrine|chest/i.test(z.label) || /poitrine|chest/i.test(z.labelEn ?? '')) ?? product.printZones[0];
                      if (!zone) return;
                      store.setLogoPlacement({
                        ...store.logoPlacement!,
                        zoneId: zone.id,
                        mode: 'preset',
                        x: zone.x + zone.width / 2,
                        y: zone.y + zone.height / 2,
                        width: zone.width * 0.85,
                      });
                    }}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border-2 border-primary/30 text-primary text-sm font-bold hover:bg-primary/5 transition-all"
                  >
                    {lang === 'en' ? '↑ Center on chest' : '↑ Centrer sur la poitrine'}
                  </button>

                  <div className="flex items-center gap-2 my-2">
                    <div className="flex-1 h-px bg-border" />
                    <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                      {lang === 'en' ? 'or pick a zone' : 'ou choisis une zone'}
                    </span>
                    <div className="flex-1 h-px bg-border" />
                  </div>

                  {/* Zone grid with pricing */}
                  <div className="space-y-1.5">
                    {product.printZones.map(z => {
                      const active = store.logoPlacement?.zoneId === z.id;
                      const isFree = !z.extraPrice || z.extraPrice === 0;
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
                          className={`w-full flex items-center gap-3 px-3.5 py-3 rounded-xl border text-left transition-all ${
                            active
                              ? 'border-primary bg-primary/5 text-primary shadow-sm'
                              : 'border-border text-muted-foreground hover:border-primary/40 hover:bg-secondary/50'
                          }`}
                        >
                          <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${active ? 'bg-primary' : 'bg-border'}`} />
                          <span className="text-xs font-bold flex-1">
                            {lang === 'en' ? (z.labelEn ?? z.label) : z.label}
                          </span>
                          <span className={`text-[11px] font-extrabold ${isFree ? 'text-green-600' : 'text-muted-foreground'}`}>
                            {isFree
                              ? (lang === 'en' ? 'Included' : 'Inclus')
                              : `+${z.extraPrice?.toFixed(2)} $`}
                          </span>
                        </button>
                      );
                    })}
                  </div>

                  {/* Manual placement explicit option */}
                  <button
                    type="button"
                    onClick={() => {
                      store.setLogoPlacement({
                        ...store.logoPlacement!,
                        mode: 'manual',
                        zoneId: 'manual',
                      });
                    }}
                    className={`w-full mt-2 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border-2 border-dashed text-xs font-bold transition-all ${
                      store.logoPlacement?.mode === 'manual'
                        ? 'border-primary bg-primary/5 text-primary'
                        : 'border-border text-muted-foreground hover:border-primary/40'
                    }`}
                  >
                    ✋ {lang === 'en'
                      ? 'Place manually (drag on the product)'
                      : 'Placer manuellement (glisse sur le produit)'}
                  </button>

                  {/* Remove logo button */}
                  <button
                    type="button"
                    onClick={() => {
                      store.setLogoPlacement(null);
                      store.setStep(2);
                    }}
                    className="w-full mt-3 flex items-center justify-center gap-2 px-3 py-2 rounded-xl border border-dashed border-destructive/40 text-destructive text-xs font-bold hover:bg-destructive/5 transition-colors"
                  >
                    <X size={13} />
                    {lang === 'en' ? 'Remove logo' : 'Retirer le logo'}
                  </button>
                </motion.div>
              )}

              {/* Step 4 — Multi-color × multi-size matrix */}
              {store.step === 4 && (
                <motion.div key="s4" initial={{ opacity:0, x:16 }} animate={{ opacity:1, x:0 }} exit={{ opacity:0, x:-16 }}>
                  <h3 className="text-sm font-black mb-1">{t('taillesQuantites')}</h3>
                  <p className="text-xs text-muted-foreground mb-3">
                    {lang === 'en'
                      ? 'Pick one or several colors. For each, choose sizes and quantities.'
                      : 'Choisis une ou plusieurs couleurs. Pour chacune, sélectionne les tailles et quantités.'}
                  </p>
                  <MultiVariantPicker
                    product={shopifyColor?.sizeOptions?.length
                      ? { ...product, sizes: shopifyColor.sizeOptions.map(s => s.size) }
                      : product}
                    colors={displayColors}
                    variants={multiVariants}
                    onChange={setMultiVariants}
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
                        <span className="font-bold">−{Math.round(BULK_DISCOUNT_RATE * 100)}%</span>
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
            <button
              type="button"
              onClick={handleAddToCart}
              disabled={totalQty === 0 || adding}
              className="flex items-center gap-2 bg-primary text-primary-foreground text-sm font-black px-5 py-2.5 rounded-full disabled:opacity-30 hover:opacity-90 transition-all shadow-md"
            >
              <ShoppingBag size={14} />
              {adding ? (lang === 'en' ? 'Adding…' : 'Ajout…') : t('ajouterPanier')}
            </button>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}
