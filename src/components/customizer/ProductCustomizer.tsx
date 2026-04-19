/**
 * ProductCustomizer — 5-step modal
 * Fixes applied:
 *  - Full i18n (no more hardcoded French)
 *  - REMOVED step-1 product image thumbnails (they showed Shopify CDN mockup
 *    images with "VOTRE LOGO" embedded in the actual JPG — causing logo
 *    duplication on step 3). The 3D viewer on the left already shows the garment.
 */
import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ShoppingBag, ChevronRight, ChevronLeft, Check, Download } from 'lucide-react';
import { toast } from 'sonner';
import { ProductCanvas } from './ProductCanvas';
import { LogoUploader } from './LogoUploader';
import { MultiVariantPicker, type VariantQty } from './MultiVariantPicker';
import { ColorPicker } from './ColorPicker';
import { useCustomizerStore } from '@/stores/customizerStore';
import { useCartStore } from '@/stores/localCartStore';
import { useCartStore as useShopifyCartStore } from '@/stores/cartStore';
import { useProductColors } from '@/hooks/useProductColors';
import { PRODUCTS, PRINT_PRICE, BULK_DISCOUNT_THRESHOLD, BULK_DISCOUNT_RATE, findColorImage } from '@/data/products';
import type { ShopifyVariantColor, ShopifyProduct } from '@/lib/shopify';
import type { ProductColor } from '@/data/products';
import type { LogoPlacement, PlacementSides } from '@/types/customization';
import { autoPlaceOnUpload, centerOnGarment, centerOnChest, centerOnZone } from '@/lib/placement';
import { useLang } from '@/lib/langContext';
import { useEscapeKey } from '@/hooks/useEscapeKey';
import { useBodyScrollLock } from '@/hooks/useBodyScrollLock';

export function ProductCustomizer({ productId, onClose }: { productId: string; onClose: () => void }) {
  const { t, lang } = useLang();
  const store    = useCustomizerStore();
  const cartStore = useCartStore();
  const shopifyCartStore = useShopifyCartStore();

  const product = PRODUCTS.find(p => p.id === productId);

  // ─── ALL HOOKS MUST STAY ABOVE ANY EARLY RETURN ───────────────────
  // Rules of Hooks: React tracks hooks by call order. Returning null
  // above a hook changes the order between renders and causes the
  // "Maximum update depth exceeded" crash we were seeing. Every
  // useState/useEffect/custom hook MUST fire on every render.

  // Live Shopify colours (falls back gracefully). Hook is keyed by
  // handle so passing an empty string when product is missing is safe.
  const { data: shopifyColors = [], isLoading: colorsLoading } = useProductColors(product?.shopifyHandle ?? '');

  // Selected colour — single state, either Shopify variant or local
  const [shopifyColor, setShopifyColor] = useState<ShopifyVariantColor | null>(null);
  // Step 4: multi-color × multi-size matrix
  const [multiVariants, setMultiVariants] = useState<VariantQty[]>([]);
  // Debounce guard against double-click double-add
  const [adding, setAdding] = useState(false);
  // Holds the canvas snapshot function once ProductCanvas is ready.
  const getSnapshotRef = useRef<(() => string | null) | null>(null);
  // Garment bounding box in percentages of canvas — computed from photo
  // pixels so "center on garment" lands on the shirt body, not whitespace.
  const [bbox, setBbox] = useState<{ x: number; y: number; w: number; h: number; cx: number; cy: number } | null>(null);

  // Init store when productId changes — use effect to avoid
  // "Cannot update a component while rendering" warnings.
  // NOTE: do NOT include `store` in the deps — Zustand returns a fresh
  // state object on every render, so including it causes an infinite
  // update loop. Action functions (store.setProduct) are stable refs.
  useEffect(() => {
    if (product && store.productId !== productId) store.setProduct(productId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productId, product]);

  // If the canvas-level trash wiped the current side's logo while we're
  // on step 2, bounce back to step 1 so the user can re-upload.
  useEffect(() => {
    if (store.step !== 2) return;
    if (store.placementSides === 'none') return;
    const currentSideHasLogo =
      store.placementSides === 'back'  ? !!store.logoPlacementBack?.previewUrl :
      store.placementSides === 'both'  ? (store.activeView === 'back'
        ? !!store.logoPlacementBack?.previewUrl
        : !!store.logoPlacement?.previewUrl) :
      !!store.logoPlacement?.previewUrl;
    if (!currentSideHasLogo) store.setStep(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [store.step, store.placementSides, store.activeView, store.logoPlacement?.previewUrl, store.logoPlacementBack?.previewUrl]);

  // Escape closes the modal (but only when not focused in a text field
  // — fabric IText editing uses Escape to exit text mode).
  // Don't let Escape close the modal while an add-to-cart is in flight —
  // the async work keeps running post-unmount and fires setState on a
  // dead component (React dev warning) + the user sees the success
  // toast appear on an unrelated page seconds after they dismissed.
  useEscapeKey(!adding, onClose, { skipInTextInputs: true });
  useBodyScrollLock(true);

  // Auto-select the first Shopify color on mount so a default preview is
  // always shown — users don't need a dedicated "pick color" step with
  // the palette persistent on the right.
  useEffect(() => {
    if (shopifyColor || !shopifyColors.length) return;
    const first = shopifyColors[0];
    setShopifyColor(first);
    store.setColor(first.variantId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shopifyColors, shopifyColor]);

  // Toggled while the user hovers/focuses the "Auto-center on garment"
  // button so a crosshair overlay on the canvas shows exactly where the
  // click will drop the logo. Builds trust that the centring is correct.
  const [previewCenter, setPreviewCenter] = useState(false);

  // Early return comes AFTER all hooks so hook call order stays stable
  // across renders. Critical for React — otherwise it crashes with
  // "Maximum update depth exceeded" once the product is missing.
  if (!product) return null;

  const handleDownloadMockup = () => {
    const snap = getSnapshotRef.current?.();
    if (!snap) {
      toast.error(lang === 'en' ? 'Mockup not ready yet' : 'Aperçu pas encore prêt');
      return;
    }
    const a = document.createElement('a');
    a.href = snap;
    a.download = `vision-affichage-${product.sku.toLowerCase()}-${Date.now()}.png`;
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

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

  // Side-aware placement routing. Canvas edits the placement that
  // matches the current view when sides='both'; otherwise it edits
  // the single relevant side.
  const currentPlacement =
    store.placementSides === 'back' ? store.logoPlacementBack
    : store.placementSides === 'both' && store.activeView === 'back' ? store.logoPlacementBack
    : store.logoPlacement;

  const setCurrentPlacement = (p: LogoPlacement | null) => {
    if (store.placementSides === 'back') {
      store.setLogoPlacementBack(p);
    } else if (store.placementSides === 'both' && store.activeView === 'back') {
      store.setLogoPlacementBack(p);
    } else {
      store.setLogoPlacement(p);
    }
  };

  // A "placement is ready" when the picked sides all have a previewUrl.
  const placementComplete = (() => {
    if (store.placementSides === 'none') return true;
    if (store.placementSides === 'front') return !!store.logoPlacement?.previewUrl;
    if (store.placementSides === 'back')  return !!store.logoPlacementBack?.previewUrl;
    return !!store.logoPlacement?.previewUrl && !!store.logoPlacementBack?.previewUrl;
  })();

  const anyLogoUploaded =
    !!store.logoPlacement?.previewUrl || !!store.logoPlacementBack?.previewUrl;

  // Whether the canvas should render a logo on the currently VISIBLE view.
  // E.g. when sides='front' and the user toggles to Back, we must NOT
  // smear the front logo on the back photo.
  const showLogoForActiveView = (() => {
    if (store.placementSides === 'none') return false;
    if (store.placementSides === 'front') return store.activeView === 'front' && !!store.logoPlacement?.previewUrl;
    if (store.placementSides === 'back')  return store.activeView === 'back'  && !!store.logoPlacementBack?.previewUrl;
    // both — use the placement attached to the currently shown view
    return store.activeView === 'front'
      ? !!store.logoPlacement?.previewUrl
      : !!store.logoPlacementBack?.previewUrl;
  })();

  // 4-step flow (collapsed from 5). Color selection is handled by the
  // persistent palette on the right — no dedicated step needed, which
  // makes the whole flow one click shorter.
  //   1 = Logo upload   (+ side selection)
  //   2 = Where to print
  //   3 = Sizes & quantities
  //   4 = Review & cart
  const STEPS = [
    { id: 1, label: t('tonLogo'),          shortLabel: lang === 'en' ? 'Logo'   : 'Logo',    done: anyLogoUploaded || store.placementSides === 'none' },
    { id: 2, label: t('zoneImpression'),   shortLabel: lang === 'en' ? 'Where'  : 'Où',      done: placementComplete },
    { id: 3, label: t('taillesQuantites'), shortLabel: lang === 'en' ? 'Sizes'  : 'Tailles', done: totalQty > 0 },
    { id: 4, label: t('resume'),           shortLabel: lang === 'en' ? 'Review' : 'Récap',   done: false },
  ];

  const canNext = () => {
    if (store.step === 1) return anyLogoUploaded || store.placementSides === 'none';
    if (store.step === 2) return placementComplete;
    if (store.step === 3) return totalQty > 0;
    return true;
  };

  const goNext = () => {
    if (!canNext()) return;
    let next = store.step + 1;
    // Skip "Where to print" entirely when the user picked a blank garment.
    if (store.step === 1 && store.placementSides === 'none' && next === 2) next = 3;
    store.setStep(next as 1 | 2 | 3 | 4);
  };
  const goBack = () => {
    let prev = store.step - 1;
    if (store.step === 3 && store.placementSides === 'none' && prev === 2) prev = 1;
    store.setStep(Math.max(1, prev) as 1 | 2 | 3 | 4);
  };

  const handleSelectColor = (c: ShopifyVariantColor) => {
    setShopifyColor(c);
    store.setColor(c.variantId);
  };

  const handleAddToCart = async () => {
    if (adding) return;
    // Guard: if the single-color fallback flow is in play but we have no
    // resolvable color (Shopify empty + no local colors defined), block
    // add-to-cart instead of sending an empty colorId to the server.
    if (multiVariants.length === 0 && !activeColor && !shopifyColor) {
      toast.error(
        lang === 'en'
          ? 'Pick a color before adding to cart.'
          : 'Choisis une couleur avant d\u2019ajouter au panier.',
      );
      return;
    }
    setAdding(true);
    try {
    // ── Multi-variant flow: push each (color × size) Shopify variant to
    //    the Shopify cart FIRST so a mid-loop failure doesn't leave the
    //    local cart stocked with items Shopify can't fulfil. Local lines
    //    are committed only for colours where at least one size
    //    succeeded on Shopify's side.
    if (multiVariants.length > 0) {
      // 1) Shopify cart sync — one line per (color × size) Shopify variant.
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

      const succeededVariantIds = new Set<string>();
      const shopifyFailures: VariantQty[] = [];
      const unmatched: VariantQty[] = [];
      for (const v of multiVariants) {
        if (!v.shopifyVariantId) {
          console.warn('Skipping Shopify sync — no variantId for', v.colorName, v.size);
          unmatched.push(v);
          continue;
        }
        try {
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
          succeededVariantIds.add(v.shopifyVariantId);
        } catch (e) {
          console.warn('[customizer] Shopify addItem failed for', v.colorName, v.size, e);
          shopifyFailures.push(v);
        }
      }

      // If EVERY matched Shopify attempt failed, bail out — committing
      // local lines at this point guarantees the cart won't reconcile at
      // checkout. Throw so the outer catch shows the generic error toast.
      const matchedCount = multiVariants.filter(v => !!v.shopifyVariantId).length;
      if (matchedCount > 0 && succeededVariantIds.size === 0) {
        throw new Error('All Shopify cart line additions failed');
      }

      // 2) Local cart lines — one per colour group, limited to the sizes
      //    whose Shopify add actually succeeded. This keeps the local
      //    UI and Shopify cart in lockstep when the network dropped a
      //    subset of additions.
      const byColor = new Map<string, { color: VariantQty; sizes: { size: string; qty: number }[]; total: number; variantIds: string[] }>();
      for (const v of multiVariants) {
        if (!v.shopifyVariantId || !succeededVariantIds.has(v.shopifyVariantId)) continue;
        const existing = byColor.get(v.colorId);
        if (existing) {
          existing.sizes.push({ size: v.size, qty: v.qty });
          existing.total += v.qty;
          existing.variantIds.push(v.shopifyVariantId);
        } else {
          byColor.set(v.colorId, {
            color: v,
            sizes: [{ size: v.size, qty: v.qty }],
            total: v.qty,
            variantIds: [v.shopifyVariantId],
          });
        }
      }

      for (const [, group] of byColor.entries()) {
        const colorImg = findColorImage(product.sku, group.color.colorName);
        const linePreview = store.logoPlacement?.previewUrl
          ?? store.logoPlacementBack?.previewUrl
          ?? colorImg?.front ?? product.imageDevant;
        cartStore.addItem({
          productId: product.id,
          colorId: group.color.colorId,
          logoPlacement: store.logoPlacement,
          logoPlacementBack: store.logoPlacementBack,
          placementSides: store.placementSides,
          textAssets: store.textAssets,
          sizeQuantities: group.sizes,
          activeView: store.activeView,
          step: store.step,
          productName: `${product.name} — ${group.color.colorName}`,
          previewSnapshot: linePreview,
          unitPrice: unitPrice * discount,
          totalQuantity: group.total,
          totalPrice: parseFloat((group.total * unitPrice * discount).toFixed(2)),
          shopifyVariantIds: group.variantIds,
        });
      }

      // Surface partial-failure warnings AFTER both stores are aligned.
      if (unmatched.length > 0) {
        toast.warning(
          lang === 'en'
            ? `${unmatched.length} variant${unmatched.length > 1 ? 's' : ''} couldn\u2019t match a Shopify product. We\u2019ll contact you to confirm.`
            : `${unmatched.length} variante${unmatched.length > 1 ? 's' : ''} n\u2019a pas pu être associée à un produit Shopify. On te contactera pour confirmer.`,
          { duration: 5000 },
        );
      }
      if (shopifyFailures.length > 0) {
        toast.warning(
          lang === 'en'
            ? `${shopifyFailures.length} size${shopifyFailures.length > 1 ? 's' : ''} couldn\u2019t be added (network issue). Re-add them from the cart.`
            : `${shopifyFailures.length} taille${shopifyFailures.length > 1 ? 's' : ''} n\u2019a pas pu être ajoutée (erreur réseau). Réessaie depuis le panier.`,
          { duration: 5000 },
        );
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
        logoPlacementBack: store.logoPlacementBack,
        placementSides: store.placementSides,
        textAssets: store.textAssets,
        sizeQuantities: store.sizeQuantities,
        activeView: store.activeView,
        step: store.step,
        productName: product.name,
        previewSnapshot: store.logoPlacement?.previewUrl
          ?? store.logoPlacementBack?.previewUrl
          ?? activeColor?.imageDevant ?? product.imageDevant,
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
    } catch (err) {
      // A Shopify network blip or bad variantId would otherwise throw
      // here silently — the finally block resets `adding` but the
      // customizer just closes with no user-visible feedback. Surface
      // the error so the user knows to retry or call.
      console.error('[customizer] addToCart failed:', err);
      toast.error(
        lang === 'en'
          ? 'Could not add to cart. Try again or call us at 367-380-4808.'
          : "Impossible d'ajouter au panier. Réessaie ou appelle au 367-380-4808.",
      );
    } finally {
      setAdding(false);
    }
  };

  // ── Display colours ─────────────────────────────────────────────────────
  // Source of truth for which colours show up = the LOCAL catalog
  // (product.colors). That guarantees Black + other core colours are always
  // pickable even when Shopify's variant list is missing one.
  //
  // For each local colour we:
  //   1. Use findColorImage(sku, colourName) to get the REAL front+back
  //      drive images so the canvas swaps to the right photo.
  //   2. Drop colours that don't have a unique drive image AND don't have
  //      their own hardcoded imageDevant — those were "stubs" that would
  //      just show the generic Clean fallback and confuse the user.
  //   3. Merge in Shopify metadata (variantId, price, sizeOptions) when the
  //      names match, so checkout sends the right Shopify variant.
  //
  // We then append any Shopify-only colours not in the local catalog at
  // the end (rare, but don't drop them silently).
  const displayColors: ShopifyVariantColor[] = (() => {
    const norm = (s: string) => s.toLowerCase().trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

    // Start with local colors, enriched with drive images.
    const local = product.colors.map(c => {
      const img = findColorImage(product.sku, c.nameEn) ?? findColorImage(product.sku, c.name);
      const imageDevant = img?.front ?? c.imageDevant ?? product.imageDevant;
      const imageDos    = img?.back  ?? c.imageDos    ?? product.imageDos;
      return {
        variantId: c.id,
        colorName: c.name,
        hex: c.hex,
        imageDevant,
        imageDos,
        price: product.basePrice.toString(),
        availableForSale: true,
        sizeOptions: product.sizes.map(s => ({ variantId: `${c.id}_${s}`, size: s, available: true })),
        hasRealImage: img?.front != null || (c.imageDevant != null && c.imageDevant !== product.imageDevant),
      };
    });

    // Only keep colours that have EITHER a drive image OR a hardcoded
    // unique imageDevant. Drops stubs that would render as the generic
    // product fallback and mislead the user.
    const filtered = local.filter(c => c.hasRealImage || c.colorName.toLowerCase() === 'noir' || c.colorName.toLowerCase() === 'black');

    // Merge Shopify metadata where names match.
    const merged = filtered.map(loc => {
      const sm = shopifyColors.find(s => norm(s.colorName) === norm(loc.colorName));
      if (sm) {
        return {
          variantId: sm.variantId,
          colorName: loc.colorName,        // keep the local (bilingual) name
          hex: loc.hex,                     // drive-matched hex beats Shopify's guess
          imageDevant: loc.imageDevant,
          imageDos: loc.imageDos,
          price: sm.price,
          availableForSale: sm.availableForSale,
          sizeOptions: sm.sizeOptions,
        };
      }
      // Local-only: strip hasRealImage marker before returning.
      const { hasRealImage: _hasRealImage, ...rest } = loc;
      void _hasRealImage;
      return rest;
    });

    // Append Shopify-only colours not represented locally. These won't
    // have a drive image, so use the Shopify variant image if any.
    const mergedNames = new Set(merged.map(c => norm(c.colorName)));
    for (const s of shopifyColors) {
      if (mergedNames.has(norm(s.colorName))) continue;
      merged.push(s);
    }

    // Put black first, then the rest in their original catalog order.
    const isBlack = (name: string) => /^noir|^black/i.test(name.trim());
    const ordered = [
      ...merged.filter(c => isBlack(c.colorName)),
      ...merged.filter(c => !isBlack(c.colorName)),
    ];

    // Final dedup pass: keep the FIRST entry for each normalized name.
    // Prevents the "Noir / Black" double-listing the user reported.
    const seen = new Set<string>();
    return ordered.filter(c => {
      const key = norm(c.colorName);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  })();

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-[600] flex items-end md:items-center justify-center p-0 md:p-4"
      style={{ background: 'rgba(8,14,32,.75)', backdropFilter: 'blur(18px)' }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="customizer-title"
      onClick={e => { if (!adding && e.target === e.currentTarget) onClose(); }}
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
            <h2 id="customizer-title" className="text-sm font-black text-foreground">{product.shortName}</h2>
            <p className="text-xs text-muted-foreground">{t('personnaliseTonProduit')}</p>
          </div>

          {/* Step indicators — semantic ol so screen readers announce
              "step X of 4" + aria-current on the live step. */}
          <ol
            className="flex-1 flex items-center justify-center gap-1 overflow-x-auto px-1 scrollbar-hide"
            aria-label={lang === 'en' ? 'Customizer progress' : 'Progression du personnalisateur'}
          >
            {STEPS.map((s, i) => {
              const isActive = store.step === s.id;
              const isDone = s.done && !isActive;
              const isClickable = s.done && s.id < store.step;
              const stateSr = isDone
                ? (lang === 'en' ? 'completed' : 'complété')
                : isActive
                  ? (lang === 'en' ? 'current step' : 'étape courante')
                  : (lang === 'en' ? 'upcoming' : 'à venir');
              return (
                <li
                  key={s.id}
                  className="flex items-center gap-1 flex-shrink-0"
                  aria-current={isActive ? 'step' : undefined}
                >
                  <button
                    type="button"
                    onClick={() => isClickable && store.setStep(s.id as 1 | 2 | 3 | 4)}
                    disabled={!isClickable && !isActive}
                    aria-label={`${s.label} — ${stateSr}`}
                    className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 ${
                      isActive ? 'bg-primary text-primary-foreground' :
                      isDone ? 'bg-green-100 text-green-700 cursor-pointer hover:bg-green-200' :
                      'text-muted-foreground cursor-default disabled:opacity-70'
                    }`}
                  >
                    {isDone ? <Check size={9} aria-hidden="true" /> : <span aria-hidden="true">{s.id}</span>}
                    <span className="sm:hidden">{s.shortLabel}</span>
                    <span className="hidden sm:inline">{s.label}</span>
                  </button>
                  {i < STEPS.length - 1 && <div className="w-1.5 h-px bg-border flex-shrink-0" aria-hidden="true" />}
                </li>
              );
            })}
          </ol>

          <button
            type="button"
            onClick={onClose}
            disabled={adding}
            aria-label={lang === 'en' ? 'Close customizer' : 'Fermer le personnalisateur'}
            className="w-8 h-8 rounded-full border border-border flex items-center justify-center text-muted-foreground hover:bg-secondary flex-shrink-0 transition-colors disabled:opacity-40 disabled:cursor-not-allowed focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1"
          >
            <X size={14} aria-hidden="true" />
          </button>
        </div>

        {/* ── Body ── */}
        <div className="overflow-auto grid md:grid-cols-[1.2fr_1fr] divide-y md:divide-y-0 md:divide-x divide-border min-h-0">

          {/* LEFT — Just the interactive canvas. No duplicated controls.
              Color palette + step content live in the right panel. */}
          <div className="p-3 md:p-4 flex flex-col min-h-0">
            <ProductCanvas
              product={product}
              garmentColor={activeColor?.hex}
              hasRealColorImage={activeColor?.imageDevant !== product.imageDevant}
              imageDevant={activeColor?.imageDevant ?? product.imageDevant}
              imageDos={activeColor?.imageDos ?? product.imageDos}
              logoUrl={showLogoForActiveView ? currentPlacement?.previewUrl ?? null : null}
              currentPlacement={currentPlacement}
              activeView={store.activeView}
              onViewChange={store.setView}
              onPlacementChange={setCurrentPlacement}
              onSnapshotReady={fn => { getSnapshotRef.current = fn; }}
              onTextAssetsChange={store.setTextAssets}
              // Tools only appear when the user is actively placing the logo.
              // No more leaking into color / sizes / review steps.
              showPlacementTools={store.step === 2 && store.placementSides !== 'none'}
              onBboxDetected={setBbox}
              hasLogoPerSide={{
                front: !!store.logoPlacement?.previewUrl,
                back:  !!store.logoPlacementBack?.previewUrl,
              }}
              showBboxCenter={store.step === 2 && previewCenter}
            />
          </div>

          {/* RIGHT — persistent color palette at the TOP + step content below.
              Colors live here and only here: swap preview color anytime, at
              any step. This matches the user request to place the palette
              "tout à droite" and removes the duplicate that used to sit
              under the canvas. */}
          <div className="p-4 overflow-auto flex flex-col gap-4">
            <div className="flex-shrink-0">
              <div className="flex items-center justify-between mb-2">
                <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                  {t('couleur')}
                </p>
                {!colorsLoading && shopifyColors.length > 0 && (
                  <span className="text-[10px] font-bold text-emerald-600">
                    {shopifyColors.length} {lang === 'en' ? 'colors' : 'couleurs'}
                  </span>
                )}
              </div>
              <ColorPicker
                colors={displayColors}
                loading={colorsLoading}
                selectedColorName={shopifyColor?.colorName ?? activeColor?.name ?? null}
                onSelect={handleSelectColor}
              />
            </div>

            <div className="flex-1 min-h-0">
            <AnimatePresence mode="wait">

              {/* Step 1 — Upload logo + pick which sides to print on.
                  (Color selection lives in the persistent palette at the
                  top of this panel, available at every step.) */}
              {store.step === 1 && (
                <motion.div key="s1" initial={{ opacity:0, x:16 }} animate={{ opacity:1, x:0 }} exit={{ opacity:0, x:-16 }} className="space-y-4">
                  {/* Side selector — tighter copy, the paragraph explaining
                      BG-removal was redundant with the uploader's own
                      affordance ("Remove background" button). */}
                  <div>
                    <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-2">
                      {lang === 'en' ? 'Where do you want to print?' : 'Où imprimer ?'}
                    </div>
                    <div className="grid grid-cols-2 gap-1.5" role="radiogroup" aria-label={lang === 'en' ? 'Print sides' : 'Côtés à imprimer'}>
                      {([
                        { id: 'front', label: lang === 'en' ? 'Front'        : 'Devant' },
                        { id: 'back',  label: lang === 'en' ? 'Back'         : 'Dos' },
                        { id: 'both',  label: lang === 'en' ? 'Front + Back' : 'Devant + Dos' },
                        { id: 'none',  label: lang === 'en' ? 'No logo'      : 'Sans logo' },
                      ] as const).map(opt => {
                        const active = store.placementSides === opt.id;
                        return (
                          <button
                            key={opt.id}
                            type="button"
                            role="radio"
                            aria-checked={active}
                            onClick={() => {
                              store.setPlacementSides(opt.id as PlacementSides);
                              // Keep the visible side consistent with the
                              // pick. "both" / "none" → default to front
                              // so the canvas shows something meaningful.
                              if (opt.id === 'back') store.setView('back');
                              else store.setView('front');
                            }}
                            className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border text-left text-[11px] font-bold transition-all ${
                              active
                                ? 'border-primary bg-primary/5 text-primary shadow-sm'
                                : 'border-border text-muted-foreground hover:border-primary/40'
                            }`}
                          >
                            <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${active ? 'bg-primary' : 'bg-border'}`} />
                            <span className="flex-1">{opt.label}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Logo uploader (hidden when user picks "Blank") */}
                  {store.placementSides !== 'none' && (
                    <LogoUploader
                      onLogoReady={(previewUrl, processedUrl, file) => {
                        const zone = product.printZones[0];
                        const auto = autoPlaceOnUpload({ bbox, zone });
                        const placement: LogoPlacement = {
                          zoneId: zone?.id ?? 'centre',
                          mode: 'preset',
                          previewUrl, processedUrl, originalFile: file,
                          ...auto,
                        };
                        // Apply to the picked side(s). When 'both', start
                        // with identical placements on front + back — user
                        // can tweak each independently in step 3.
                        if (store.placementSides === 'back') {
                          store.setLogoPlacementBack(placement);
                          store.setLogoPlacement(null);
                        } else if (store.placementSides === 'both') {
                          store.setLogoPlacement(placement);
                          store.setLogoPlacementBack({ ...placement });
                        } else {
                          store.setLogoPlacement(placement);
                          store.setLogoPlacementBack(null);
                        }
                        goNext();
                      }}
                    />
                  )}

                  {store.placementSides === 'none' && (
                    <div className="rounded-xl border border-dashed border-border p-4 text-center text-xs text-muted-foreground">
                      {lang === 'en'
                        ? 'No logo will be printed. You can still pick colors + sizes in the next step.'
                        : 'Aucun logo ne sera imprimé. Tu peux quand même choisir les couleurs et tailles à l\u2019étape suivante.'}
                    </div>
                  )}
                </motion.div>
              )}

              {/* Step 2 — Where to print (zones + centering) */}
              {store.step === 2 && currentPlacement?.previewUrl && (
                <motion.div key="s2" initial={{ opacity:0, x:16 }} animate={{ opacity:1, x:0 }} exit={{ opacity:0, x:-16 }} className="space-y-4">
                  <div>
                    <h3 className="text-sm font-black mb-1">{t('zoneImpression')}</h3>
                    <p className="text-xs text-muted-foreground">
                      {lang === 'en'
                        ? 'Pick a position or drag your logo freely on the preview.'
                        : 'Choisis une position ou glisse ton logo librement sur le produit.'}
                    </p>
                  </div>

                  {/* Front/Back editing toggle — only relevant when the
                      user picked "Front + Back". Each side has its own
                      placement so they can be tuned independently. */}
                  {store.placementSides === 'both' && (
                    <div className="flex items-center gap-1 p-1 bg-secondary rounded-full border border-border">
                      {(['front', 'back'] as const).map(side => {
                        const active = store.activeView === side;
                        return (
                          <button
                            key={side}
                            type="button"
                            onClick={() => store.setView(side)}
                            className={`flex-1 py-1.5 rounded-full text-[11px] font-bold transition-all ${
                              active ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground'
                            }`}
                          >
                            {side === 'front'
                              ? (lang === 'en' ? `Editing FRONT` : `Édition DEVANT`)
                              : (lang === 'en' ? `Editing BACK`  : `Édition DOS`)}
                          </button>
                        );
                      })}
                    </div>
                  )}

                  {/* Quick CENTER button — uses the REAL garment bounding
                      box detected from the photo so "center" lands on the
                      shirt body, not on canvas whitespace. */}
                  <button
                    type="button"
                    onClick={() => {
                      setCurrentPlacement({
                        ...currentPlacement!,
                        zoneId: 'centre-vetement',
                        mode: 'preset',
                        ...centerOnGarment({ bbox }),
                      });
                    }}
                    onMouseEnter={() => setPreviewCenter(true)}
                    onMouseLeave={() => setPreviewCenter(false)}
                    onFocus={() => setPreviewCenter(true)}
                    onBlur={() => setPreviewCenter(false)}
                    className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-gradient-to-br from-[#0052CC] to-[#1B3A6B] text-white text-sm font-extrabold shadow-md hover:shadow-lg hover:-translate-y-px transition-all"
                  >
                    <span aria-hidden="true">⊕</span>
                    {lang === 'en' ? 'Auto-center on garment' : 'Auto-centrer sur le vêtement'}
                  </button>

                  {/* Chest button — only meaningful when we're editing the
                      FRONT view (back-of-shirt chest doesn't exist). */}
                  {store.activeView === 'front' && (
                    <button
                      type="button"
                      onClick={() => {
                        const zone = product.printZones.find(z => /poitrine|chest/i.test(z.label) || /poitrine|chest/i.test(z.labelEn ?? '')) ?? product.printZones[0];
                        setCurrentPlacement({
                          ...currentPlacement!,
                          zoneId: zone?.id ?? 'poitrine-centre',
                          mode: 'preset',
                          ...centerOnChest({ bbox, zone }),
                        });
                      }}
                      className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border-2 border-primary/30 text-primary text-sm font-bold hover:bg-primary/5 transition-all"
                    >
                      {lang === 'en' ? '↑ Center on chest' : '↑ Centrer sur la poitrine'}
                    </button>
                  )}

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
                      const active = currentPlacement?.zoneId === z.id;
                      const isFree = !z.extraPrice || z.extraPrice === 0;
                      return (
                        <button
                          key={z.id}
                          onClick={() => setCurrentPlacement({
                            ...currentPlacement!,
                            zoneId: z.id,
                            mode: 'preset',
                            ...centerOnZone(z),
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
                      setCurrentPlacement({
                        ...currentPlacement!,
                        mode: 'manual',
                        zoneId: 'manual',
                      });
                      toast.info(
                        lang === 'en'
                          ? 'Drag the logo on the preview to place it anywhere.'
                          : 'Glisse le logo sur l\u2019aperçu pour le placer où tu veux.',
                        { duration: 2800 },
                      );
                    }}
                    className={`w-full mt-2 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border-2 border-dashed text-xs font-bold transition-all ${
                      currentPlacement?.mode === 'manual'
                        ? 'border-primary bg-primary/5 text-primary'
                        : 'border-border text-muted-foreground hover:border-primary/40'
                    }`}
                  >
                    ✋ {lang === 'en'
                      ? 'Place manually (drag on the product)'
                      : 'Placer manuellement (glisse sur le produit)'}
                  </button>

                  {/* Remove-logo button goes back to Step 1 so the user can
                      re-upload. Clears every side so state stays clean. */}
                  <button
                    type="button"
                    onClick={() => {
                      store.setLogoPlacement(null);
                      store.setLogoPlacementBack(null);
                      store.setStep(1);
                    }}
                    className="w-full mt-3 flex items-center justify-center gap-2 px-3 py-2 rounded-xl border border-dashed border-destructive/40 text-destructive text-xs font-bold hover:bg-destructive/5 transition-colors"
                  >
                    <X size={13} />
                    {lang === 'en' ? 'Remove logo' : 'Retirer le logo'}
                  </button>
                </motion.div>
              )}

              {/* Step 3 — Multi-color × multi-size matrix */}
              {store.step === 3 && (
                <motion.div key="s3" initial={{ opacity:0, x:16 }} animate={{ opacity:1, x:0 }} exit={{ opacity:0, x:-16 }}>
                  <h3 className="text-sm font-black mb-1">{t('taillesQuantites')}</h3>
                  <p className="text-xs text-muted-foreground mb-3">
                    {lang === 'en'
                      ? 'Pick one or several colors. For each, choose sizes and quantities.'
                      : 'Choisis une ou plusieurs couleurs. Pour chacune, sélectionne les tailles et quantités.'}
                  </p>
                  {/* Warn if the user reached Step 4 expecting a logo but
                      never finished placing it. placementComplete already
                      reflects "every picked side has a previewUrl". */}
                  {store.placementSides !== 'none' && !placementComplete && (
                    <div className="mb-3 rounded-xl border border-amber-500/40 bg-amber-500/5 text-amber-800 text-[11px] font-semibold p-2.5 flex items-start gap-2">
                      <span aria-hidden="true">⚠</span>
                      <div className="flex-1">
                        {lang === 'en'
                          ? 'Your logo placement isn\u2019t complete. Go back to Where to finish, or switch to "Blank" in step 1 for a plain garment.'
                          : 'Le placement de ton logo n\u2019est pas terminé. Reviens à l\u2019étape « Où », ou choisis « Vierge » à l\u2019étape 1 pour un vêtement sans logo.'}
                      </div>
                    </div>
                  )}
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

              {/* Step 4 — Summary */}
              {store.step === 4 && (
                <motion.div key="s4" initial={{ opacity:0, x:16 }} animate={{ opacity:1, x:0 }} exit={{ opacity:0, x:-16 }} className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-black">{t('resume')}</h3>
                    <button
                      type="button"
                      onClick={handleDownloadMockup}
                      className="flex items-center gap-1.5 text-[11px] font-bold text-primary hover:underline"
                      aria-label={lang === 'en' ? 'Download mockup PNG' : 'Télécharger le visuel PNG'}
                    >
                      <Download size={12} />
                      {lang === 'en' ? 'Download PNG' : 'Télécharger PNG'}
                    </button>
                  </div>

                  {/* Per-color breakdown — only when multi-variant flow was used */}
                  {multiVariants.length > 0 && (
                    <div className="bg-secondary/70 rounded-xl p-3 border border-border">
                      <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-2">
                        {lang === 'en' ? 'Your selection' : 'Ta sélection'}
                      </div>
                      <div className="space-y-1.5">
                        {Array.from(
                          multiVariants.reduce<Map<string, { name: string; hex: string; lines: string[]; qty: number }>>((acc, v) => {
                            const existing = acc.get(v.colorId);
                            if (existing) {
                              existing.lines.push(`${v.size}×${v.qty}`);
                              existing.qty += v.qty;
                            } else {
                              acc.set(v.colorId, { name: v.colorName, hex: v.hex, lines: [`${v.size}×${v.qty}`], qty: v.qty });
                            }
                            return acc;
                          }, new Map()).values(),
                        ).map(g => (
                          <div key={g.name} className="flex items-center gap-2 text-xs">
                            <span className="w-3 h-3 rounded-full ring-1 ring-border flex-shrink-0" style={{ background: g.hex }} />
                            <span className="font-bold flex-shrink-0">{g.name}</span>
                            <span className="text-muted-foreground truncate">{g.lines.join(' · ')}</span>
                            <span className="ml-auto font-extrabold text-primary">{g.qty}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="bg-secondary rounded-xl p-4 space-y-2.5">
                    {[
                      [t('produit'),        product.shortName],
                      [t('couleurLabel'),   multiVariants.length > 0
                        ? `${new Set(multiVariants.map(v => v.colorName)).size} ${lang === 'en' ? 'colors' : 'couleurs'}`
                        : (shopifyColor?.colorName ?? activeColor?.name ?? '—')],
                      [lang === 'en' ? 'Print sides' : 'Côtés imprimés',
                        store.placementSides === 'none' ? (lang === 'en' ? 'Blank (no print)' : 'Vierge (aucune impression)')
                        : store.placementSides === 'front' ? (lang === 'en' ? 'Front only' : 'Devant seulement')
                        : store.placementSides === 'back'  ? (lang === 'en' ? 'Back only'  : 'Dos seulement')
                        : (lang === 'en' ? 'Front + Back' : 'Devant + Dos')],
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

                  {/* Larger preview card — replaces the cramped 48px thumbnail.
                      Shows whichever side(s) have a placement. Each side
                      has an inline edit + remove so the user can adjust
                      without going back through the whole flow. */}
                  {(store.logoPlacement?.previewUrl || store.logoPlacementBack?.previewUrl) && (
                    <div className="p-3 bg-secondary rounded-xl border border-border space-y-2">
                      {([
                        { key: 'front' as const, p: store.logoPlacement,     label: lang === 'en' ? 'Front' : 'Devant' },
                        { key: 'back'  as const, p: store.logoPlacementBack, label: lang === 'en' ? 'Back'  : 'Dos' },
                      ]).filter(s => !!s.p?.previewUrl).map(s => (
                        <div key={s.key} className="flex gap-3 items-center">
                          <div className="relative w-16 h-16 rounded-lg border border-border bg-white overflow-hidden flex-shrink-0">
                            <div
                              className="absolute inset-0"
                              style={{ backgroundImage: 'repeating-conic-gradient(#eee 0% 25%, white 0% 50%)', backgroundSize: '10px 10px' }}
                              aria-hidden="true"
                            />
                            <img src={s.p!.previewUrl} alt={s.label} className="relative w-full h-full object-contain p-1.5" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] font-bold uppercase tracking-wider text-primary">{s.label}</span>
                              {s.p?.mode === 'manual' && (
                                <span className="text-[10px] text-muted-foreground">· {lang === 'en' ? 'manual' : 'manuel'}</span>
                              )}
                            </div>
                            <p className="text-xs font-bold truncate">{product.shortName}</p>
                            <p className="text-[10px] text-muted-foreground mt-0.5">
                              {lang === 'en' ? 'Zone' : 'Zone'}: <span className="font-semibold text-foreground">{s.p?.zoneId}</span>
                            </p>
                          </div>
                          <div className="flex items-center gap-1 flex-shrink-0">
                            <button
                              type="button"
                              onClick={() => {
                                store.setView(s.key);
                                store.setStep(2);
                              }}
                              aria-label={lang === 'en' ? `Edit ${s.label} placement` : `Modifier le placement ${s.label}`}
                              className="w-8 h-8 rounded-lg border border-border text-muted-foreground hover:text-primary hover:border-primary hover:bg-primary/5 transition-all text-[11px] font-bold"
                            >
                              {lang === 'en' ? 'Edit' : 'Modif'}
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                const confirmMsg = lang === 'en'
                                  ? `Remove the ${s.label.toLowerCase()} logo? You\u2019ll need to re-upload it to add it back.`
                                  : `Retirer le logo ${s.label.toLowerCase()} ? Tu devras le téléverser à nouveau pour le remettre.`;
                                if (!window.confirm(confirmMsg)) return;
                                if (s.key === 'front') store.setLogoPlacement(null);
                                else store.setLogoPlacementBack(null);
                                // Downgrade placementSides so "both" with
                                // one side removed becomes a single-sided
                                // config, keeping state consistent.
                                const stillFront = s.key === 'back'  ? !!store.logoPlacement?.previewUrl    : false;
                                const stillBack  = s.key === 'front' ? !!store.logoPlacementBack?.previewUrl : false;
                                if (stillFront && stillBack) store.setPlacementSides('both');
                                else if (stillFront) store.setPlacementSides('front');
                                else if (stillBack)  store.setPlacementSides('back');
                                else store.setPlacementSides('none');
                              }}
                              aria-label={lang === 'en' ? `Remove ${s.label} logo` : `Retirer le logo ${s.label}`}
                              className="w-8 h-8 rounded-lg border border-border text-muted-foreground hover:text-destructive hover:border-destructive hover:bg-destructive/5 transition-all flex items-center justify-center"
                            >
                              <X size={13} />
                            </button>
                          </div>
                        </div>
                      ))}
                      <div className="text-[11px] text-muted-foreground pt-1.5 border-t border-border/50">
                        {totalQty} {t(totalQty !== 1 ? 'unitPluralLabel' : 'unitLabel')} · {totalPrice.toFixed(2)} $
                      </div>
                    </div>
                  )}
                  <p className="text-xs text-muted-foreground text-center">{t('taxesNote')}</p>
                </motion.div>
              )}

            </AnimatePresence>
            </div>
          </div>
        </div>

        {/* ── Footer ── */}
        <div className="px-5 py-3.5 border-t border-border flex items-center justify-between bg-background">
          <button onClick={goBack} disabled={store.step === 1}
            className="flex items-center gap-1.5 text-sm font-bold text-muted-foreground disabled:opacity-20 hover:text-foreground transition-colors"
          >
            <ChevronLeft size={15} /> {t('retour')}
          </button>

          {totalQty > 0 && store.step >= 3 && (
            <div className="text-center">
              <div className="text-[10px] text-muted-foreground">
                {totalQty} {t(totalQty !== 1 ? 'unitPluralLabel' : 'unitLabel')}
              </div>
              <div className="text-sm font-black text-primary">{totalPrice.toFixed(2)} $</div>
            </div>
          )}

          {store.step < 4 ? (
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
