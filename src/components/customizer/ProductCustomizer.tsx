/**
 * ProductCustomizer — 3-step modal.
 *
 * Step flow after the 2026-04-20 simplification (user feedback was
 * "make it dumb fucking simple and so nice"):
 *   1 = Design   (colour picker + logo upload + placement — all on one
 *                 screen with progressive disclosure: placement tiles +
 *                 zone grid only reveal after a logo is uploaded)
 *   2 = Tailles  (sizes × quantities matrix + bulk discount preview)
 *   3 = Récap    (summary + add-to-cart)
 *
 * Previous flow had 4 steps (Logo / Where / Sizes / Review) which forced
 * the user through two navigation taps before they had a usable preview.
 * The old "Where" (placement zones, auto-centre, chest, manual) is now
 * an inline section on Step 1 that unlocks the moment the logo decodes.
 *
 * Everything else (canvas, placement logic, cart sync, per-side 'both'
 * handling) is untouched. Only the step scaffolding, progress indicator,
 * swatch layout, and placement-tile visuals changed.
 */
import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
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
import { PRODUCTS, PRINT_PRICE, BULK_DISCOUNT_THRESHOLD, BULK_DISCOUNT_RATE, findColorImage, pickDefaultZone, pickDefaultZoneForSide } from '@/data/products';
import type { ShopifyVariantColor, ShopifyProduct } from '@/lib/shopify';
import type { ProductColor } from '@/data/products';
import type { LogoPlacement, PlacementSides } from '@/types/customization';
import { autoPlaceOnUpload, centerOnGarment, centerOnChest, centerOnZone } from '@/lib/placement';
import { useLang } from '@/lib/langContext';
import { useEscapeKey } from '@/hooks/useEscapeKey';
import { useBodyScrollLock } from '@/hooks/useBodyScrollLock';
import { useFocusTrap } from '@/hooks/useFocusTrap';
import { fmtMoney } from '@/lib/format';

export function ProductCustomizer({ productId, onClose }: { productId: string; onClose: () => void }) {
  const { t, lang } = useLang();
  const navigate = useNavigate();
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
  // Mirror bbox in a ref so async callbacks (e.g. LogoUploader's
  // onLogoReady, which fires after file decode) always read the LIVE
  // bbox rather than whatever snapshot they captured at render time.
  // Subsequent uploads were landing with stale placement because the
  // closure captured a null/old bbox before the canvas had finished
  // measuring the garment photo.
  const bboxRef = useRef(bbox);
  useEffect(() => { bboxRef.current = bbox; }, [bbox]);

  // RESET the customizer state every time the modal mounts. User
  // explicitly asked: 'when we go back on the customiser, it restarts
  // the process'. The persisted customizer store was designed to keep
  // state across navigations, but that confused users who expected a
  // fresh canvas each time they opened the flow. Always start at
  // step 1, no logo, no sizes — then set the current product so the
  // canvas has something to render.
  useEffect(() => {
    if (!product) return;
    store.reset();
    store.setProduct(productId);
    setMultiVariants([]);
    setShopifyColor(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productId, product]);

  // Design + placement now share Step 1 — there is no longer a dedicated
  // "placement" step to bounce back from. Kept as a guard anyway: if the
  // user is past Step 1 (Tailles / Récap) and somehow lost their logo
  // (e.g. fabric trash-on-canvas from the old code path, or a hydrate
  // replacing state mid-flow), send them back so they can re-upload
  // before committing sizes.
  useEffect(() => {
    if (store.step <= 1) return;
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
  // Trap Tab inside the modal so keyboard users can't tab past the
  // backdrop into the dimmed page underneath. Auto-focuses the first
  // focusable element on mount (the close button in the header) and
  // restores focus to the trigger element (e.g. the PDP "Customize"
  // button) on close. role="dialog" + aria-modal alone are only screen-
  // reader hints — browsers don't enforce focus containment.
  const trapRef = useFocusTrap<HTMLDivElement>(true);

  // ── Display colours (computed above the early return so the mount
  // effect below can sync the store to the FIRST truly-available colour).
  //
  // STRICT: a colour only appears if findColorImage(sku, name) returns a
  // real front drive image for this product. No drive image → the colour
  // does not exist for this product and must not be shown. (Previously
  // we let 'noir'/'black' through even without photography, which showed
  // the generic product fallback and confused users.)
  //
  // Back images are NOT required — many products are front-only; the
  // canvas already handles a missing back gracefully.
  //
  // Order: black first (when present), then catalog order. Shopify
  // metadata (variantId, price, sizeOptions) is merged by name match.
  // Shopify-only colours that have no local entry are dropped — they
  // by definition have no drive photography keyed to our SKU.
  const displayColors: ShopifyVariantColor[] = (() => {
    if (!product) return [];
    const norm = (s: string) => s.toLowerCase().trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

    // Only keep local colours with a REAL front drive image for this SKU.
    const withImages = product.colors
      .map(c => {
        const img = findColorImage(product.sku, c.nameEn) ?? findColorImage(product.sku, c.name);
        return { c, img };
      })
      .filter(({ img }) => !!img?.front)
      .map(({ c, img }) => ({
        variantId: c.id,
        colorName: c.name,
        hex: c.hex,
        imageDevant: img!.front!,
        imageDos: img!.back ?? c.imageDos ?? product.imageDos,
        price: product.basePrice.toString(),
        availableForSale: true,
        sizeOptions: product.sizes.map(s => ({ variantId: `${c.id}_${s}`, size: s, available: true })),
      } as ShopifyVariantColor));

    // Merge Shopify metadata (variantId, price, sizeOptions) where names match.
    const merged = withImages.map(loc => {
      const sm = shopifyColors.find(s => norm(s.colorName) === norm(loc.colorName));
      if (sm) {
        return {
          variantId: sm.variantId,
          colorName: loc.colorName,
          hex: loc.hex,
          imageDevant: loc.imageDevant,
          imageDos: loc.imageDos,
          price: sm.price,
          availableForSale: sm.availableForSale,
          sizeOptions: sm.sizeOptions,
        } as ShopifyVariantColor;
      }
      return loc;
    });

    // Put black first, then the rest in catalog order.
    const isBlack = (name: string) => /^noir|^black/i.test(name.trim());
    const ordered = [
      ...merged.filter(c => isBlack(c.colorName)),
      ...merged.filter(c => !isBlack(c.colorName)),
    ];

    // Dedup by normalized name (prevents "Noir / Black" double entry).
    const seen = new Set<string>();
    return ordered.filter(c => {
      const key = norm(c.colorName);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  })();

  // Auto-select the first DISPLAYED colour on mount so the default preview
  // matches what the user sees at the top of the palette (black when it
  // has real photography, otherwise the first real-image colour).
  // This replaces the previous effect that picked shopifyColors[0] — that
  // could be a colour with no drive photography, landing users on the
  // generic fallback.
  useEffect(() => {
    if (!product) return;
    if (!displayColors.length) return;
    // Pick displayColors[0] whenever the current shopifyColor/storeColorId
    // doesn't correspond to a DISPLAYED colour for this product.
    const currentName = shopifyColor?.colorName ?? null;
    const currentId   = shopifyColor?.variantId ?? store.colorId ?? null;
    const norm = (s: string) => s.toLowerCase().trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    const matchesDisplay = displayColors.some(c =>
      (currentName && norm(c.colorName) === norm(currentName)) ||
      (currentId && c.variantId === currentId),
    );
    if (matchesDisplay) return;
    const first = displayColors[0];
    setShopifyColor(first);
    store.setColor(first.variantId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [product?.sku, displayColors.length, shopifyColor?.variantId]);

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

  // The active ProductColor — resolved from the strict, Drive-backed
  // displayColors list. shopifyColor wins when set, otherwise we look up
  // the store's colorId against displayColors, and finally fall back to
  // displayColors[0] (black-first ordering) so the opening preview always
  // matches what's visually first in the palette.
  const activeColor: ProductColor | null = (() => {
    if (shopifyColor) {
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
    // Prefer the displayColors entry matching the store's colorId so the
    // selected swatch in the palette matches the canvas.
    const displayMatch = displayColors.find(c => c.variantId === store.colorId);
    const fallbackDisplay = displayMatch ?? displayColors[0] ?? null;
    if (fallbackDisplay) {
      const colorImg = findColorImage(product.sku, fallbackDisplay.colorName);
      return {
        id: fallbackDisplay.variantId,
        name: fallbackDisplay.colorName,
        nameEn: fallbackDisplay.colorName,
        hex: fallbackDisplay.hex,
        imageDevant: colorImg?.front ?? fallbackDisplay.imageDevant ?? product.imageDevant,
        imageDos:    colorImg?.back  ?? fallbackDisplay.imageDos    ?? product.imageDos,
      };
    }
    return null;
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

  // 3-step flow (collapsed from 4). The colour palette lives at the top
  // of the right panel at every step so the user can re-swap mid-flow.
  //   1 = Design   (logo upload + side + placement — one screen)
  //   2 = Tailles  (sizes × quantities)
  //   3 = Récap    (summary + add to cart)
  const STEPS = [
    { id: 1 as const, label: lang === 'en' ? 'Design'  : 'Design',   shortLabel: 'Design',                                 done: (anyLogoUploaded || store.placementSides === 'none') && placementComplete },
    { id: 2 as const, label: lang === 'en' ? 'Sizes'   : 'Tailles',  shortLabel: lang === 'en' ? 'Sizes'  : 'Tailles',     done: totalQty > 0 },
    { id: 3 as const, label: lang === 'en' ? 'Review'  : 'Récap',    shortLabel: lang === 'en' ? 'Review' : 'Récap',       done: false },
  ];

  const canNext = () => {
    if (store.step === 1) {
      // Need either "no logo" OR a placed logo on every picked side.
      if (store.placementSides === 'none') return true;
      return anyLogoUploaded && placementComplete;
    }
    if (store.step === 2) return totalQty > 0;
    return true;
  };

  const goNext = () => {
    if (!canNext()) return;
    const next = Math.min(3, store.step + 1) as 1 | 2 | 3;
    store.setStep(next);
  };
  const goBack = () => {
    const prev = Math.max(1, store.step - 1) as 1 | 2 | 3;
    store.setStep(prev);
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
        // Also refuse obvious non-gid strings up front. A local-only
        // color catalog entry can reach multiVariants via the size
        // fallback, and its variantId is e.g. 'noir_M' — cartLinesAdd
        // silently userErrors on it but addItem doesn't throw, so the
        // post-call state check below wouldn't fire either. Skip here.
        if (!v.shopifyVariantId.startsWith('gid://shopify/')) {
          console.warn('Skipping Shopify sync — variantId is not a Shopify gid:', v.shopifyVariantId);
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
          // shopifyCartStore.addItem doesn't throw on Shopify userErrors —
          // it logs and returns without committing to items. Confirm the
          // line actually landed by reading the store back via getState
          // (the hook-bound `shopifyCartStore` here is the snapshot from
          // render time, not the live post-await state). Without this
          // check, silent rejections would still register as success and
          // we'd commit the local cart line for a variant that was never
          // added to Shopify.
          const liveItems = useShopifyCartStore.getState().items;
          const landed = liveItems.some(i => i.variantId === v.shopifyVariantId);
          if (landed) {
            succeededVariantIds.add(v.shopifyVariantId);
          } else {
            shopifyFailures.push(v);
          }
        } catch (e) {
          console.warn('[customizer] Shopify addItem failed for', v.colorName, v.size, e);
          shopifyFailures.push(v);
        }
      }

      // If EVERY REAL-SHOPIFY-GID attempt failed, bail out — committing
      // local lines at this point guarantees the cart won't reconcile at
      // checkout. Previously `matchedCount` counted any variant with a
      // truthy shopifyVariantId, including local-only fake IDs like
      // 'noir_M' that we explicitly skip above. That turned the bail
      // condition into "any fake IDs present → throw" — blocking the
      // add-to-cart path entirely for products whose colors are
      // local-catalog only (the user-reported 'can't add to cart' bug).
      // Re-check the same gid:// filter the Shopify loop uses so the
      // denominator matches what was actually attempted.
      const shopifyValidCount = multiVariants.filter(
        v => !!v.shopifyVariantId && v.shopifyVariantId.startsWith('gid://shopify/'),
      ).length;
      if (shopifyValidCount > 0 && succeededVariantIds.size === 0) {
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

      // Prefer the uploaded (Supabase) URL over the blob: previewUrl so
      // the thumbnail survives a page reload. Blob URLs are scoped to
      // the session that created them; persisting one into localStorage
      // means the cart thumbnail renders broken after refresh.
      const pickPersistableLogo = (p: LogoPlacement | null): string | undefined => {
        if (!p) return undefined;
        const prev = p.previewUrl;
        const proc = p.processedUrl;
        const isBlob = (u?: string) => !!u && u.startsWith('blob:');
        if (prev && !isBlob(prev)) return prev;
        if (proc && !isBlob(proc)) return proc;
        return undefined;
      };
      for (const [, group] of byColor.entries()) {
        const colorImg = findColorImage(product.sku, group.color.colorName);
        // Prefer the actual canvas mockup (garment + logo composited)
        // so the cart shows what the customer is buying, not just a
        // product stock photo or a bare logo. Falls back to the same
        // chain as before if the canvas hasn't exposed its snapshot
        // function yet.
        const mockup = getSnapshotRef.current?.();
        const linePreview = mockup
          ?? pickPersistableLogo(store.logoPlacement)
          ?? pickPersistableLogo(store.logoPlacementBack)
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
      // Guard: if the selected color came from the local catalog only
      // (no Shopify match), its variantId is a plain string like 'noir',
      // not a real Shopify gid. Firing that at cartLinesAdd produces a
      // silent userError, the Shopify cart stays empty, but the local
      // cart still gets the line — checkout then 404s on the permalink.
      // Bail with a clear error so the user knows we need help matching.
      if (!shopifyColor.variantId.startsWith('gid://shopify/')) {
        toast.error(
          lang === 'en'
            ? 'We couldn\u2019t match this color to our Shopify catalog. Call us at 367-380-4808 or pick a different color.'
            : 'Impossible d\u2019associer cette couleur à notre catalogue Shopify. Appelle-nous au 367-380-4808 ou choisis une autre couleur.',
          { duration: 6000 },
        );
        return;
      }
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
      // addItem doesn't throw on Shopify userErrors / 402 / network
      // drops — it logs and returns. Confirm the line actually landed
      // before committing the local line, otherwise the cart shows an
      // item the checkout can't reconcile (customer pays zero or the
      // permalink 404s). Mirrors the multi-variant flow's post-check.
      const landed = useShopifyCartStore.getState().items
        .some(i => i.variantId === shopifyColor.variantId);
      if (!landed) {
        throw new Error('Shopify cart line addition failed');
      }

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
        previewSnapshot: (() => {
          // Prefer the composited canvas mockup so the cart thumbnail
          // shows the actual garment + logo the customer configured,
          // not just the bare logo or a stock product photo.
          const mockup = getSnapshotRef.current?.();
          if (mockup) return mockup;
          // Same blob:-safe resolution as the multi-color path — blob
          // URLs don't survive a page reload, so prefer uploaded
          // (Supabase) URLs and fall back to the product photo.
          const isBlob = (u?: string) => !!u && u.startsWith('blob:');
          const p = store.logoPlacement;
          const pb = store.logoPlacementBack;
          if (p?.previewUrl && !isBlob(p.previewUrl)) return p.previewUrl;
          if (p?.processedUrl && !isBlob(p.processedUrl)) return p.processedUrl;
          if (pb?.previewUrl && !isBlob(pb.previewUrl)) return pb.previewUrl;
          if (pb?.processedUrl && !isBlob(pb.processedUrl)) return pb.processedUrl;
          return activeColor?.imageDevant ?? product.imageDevant;
        })(),
        unitPrice: unitPrice * discount,
        totalQuantity: totalQty,
        totalPrice,
        // Include the Shopify variant ID so removing this line from
        // CartDrawer / Cart also pulls it from the Shopify cart. Without
        // this, the single-color flow left the line in Shopify after a
        // local remove — at checkout the customer paid for an item they
        // thought they'd deleted.
        shopifyVariantIds: [shopifyColor.variantId],
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
      {
        duration: 5000,
        // Inline action so the customer can jump straight to checkout
        // instead of hunting for the cart icon. Bumped duration from 3s
        // to 5s so the action button stays clickable long enough on
        // touch devices where toast tap targets feel rushed at 3s.
        action: {
          label: lang === 'en' ? 'View cart' : 'Voir le panier',
          onClick: () => navigate('/cart'),
        },
      },
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

  return (
    <motion.div
      ref={trapRef}
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

          {/* Horizontal progress bar — each step is a segment that
              brightens as the user advances. A thick fill underneath the
              labels makes the current step unambiguous at a glance, and
              completed segments go full primary so the user sees how
              much is left. Semantic ol preserved so screen readers still
              announce "step X of 3" with aria-current on the live step. */}
          <ol
            className="flex-1 flex items-stretch gap-1.5 px-1"
            aria-label={lang === 'en' ? 'Customizer progress' : 'Progression du personnalisateur'}
          >
            {STEPS.map((s) => {
              const isActive = store.step === s.id;
              const isDone = store.step > s.id;
              const isClickable = (isDone || s.done) && s.id < store.step;
              const stateSr = isDone
                ? (lang === 'en' ? 'completed' : 'complété')
                : isActive
                  ? (lang === 'en' ? 'current step' : 'étape courante')
                  : (lang === 'en' ? 'upcoming' : 'à venir');
              return (
                <li
                  key={s.id}
                  className="flex-1 min-w-0 flex flex-col gap-1"
                  aria-current={isActive ? 'step' : undefined}
                >
                  <button
                    type="button"
                    onClick={() => isClickable && store.setStep(s.id)}
                    disabled={!isClickable && !isActive}
                    aria-label={`${s.id}. ${s.label} — ${stateSr}`}
                    className={`group flex items-center gap-1.5 text-[11px] font-bold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 rounded px-1 ${
                      isActive
                        ? 'text-[#1B3A6B]'
                      : isDone
                        ? 'text-primary cursor-pointer hover:text-primary/80'
                      : 'text-muted-foreground cursor-default'
                    }`}
                  >
                    <span
                      aria-hidden="true"
                      className={`inline-flex items-center justify-center w-4 h-4 rounded-full flex-shrink-0 text-[9px] font-black ${
                        isActive ? 'bg-[#1B3A6B] text-white'
                        : isDone ? 'bg-primary text-primary-foreground'
                        : 'bg-border text-muted-foreground'
                      }`}
                    >
                      {isDone ? <Check size={9} strokeWidth={4} /> : s.id}
                    </span>
                    <span className="truncate">
                      <span className="sm:hidden">{s.shortLabel}</span>
                      <span className="hidden sm:inline">{s.label}</span>
                    </span>
                  </button>
                  {/* Segment fill — the load-bearing "what step am I on"
                      signal. Active = gold accent (matches the primary
                      CTA). Done = solid navy. Pending = faint border. */}
                  <span
                    aria-hidden="true"
                    className={`h-1 rounded-full transition-all ${
                      isActive
                        ? 'bg-gradient-to-r from-[#1B3A6B] to-[#E8A838] shadow-[0_1px_4px_rgba(232,168,56,0.45)]'
                      : isDone
                        ? 'bg-[#1B3A6B]'
                      : 'bg-border/60'
                    }`}
                  />
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

        {/* ── Body ──
            Mobile (<768px): stacks vertically — canvas square at top,
            full-width panel below. Desktop (>=md): side-by-side columns. */}
        <div className="overflow-auto grid grid-cols-1 md:grid-cols-[1.2fr_1fr] divide-y md:divide-y-0 md:divide-x divide-border min-h-0">

          {/* LEFT (top on mobile) — Just the interactive canvas. No duplicated
              controls. Color palette + step content live in the right panel.
              Mobile: force a square aspect so the canvas doesn't collapse
              into a cramped sliver when the panel below expands. */}
          <div className="p-3 md:p-4 flex flex-col min-h-0 w-full aspect-square md:aspect-auto">
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
              // Tools only appear when the user is actively placing the
              // logo (Step 1 after the 2026-04-20 revamp). No more
              // leaking into sizes / review steps.
              showPlacementTools={store.step === 1 && anyLogoUploaded && store.placementSides !== 'none'}
              onBboxDetected={setBbox}
              hasLogoPerSide={{
                front: !!store.logoPlacement?.previewUrl,
                back:  !!store.logoPlacementBack?.previewUrl,
              }}
              showBboxCenter={store.step === 1 && previewCenter}
            />
          </div>

          {/* RIGHT (bottom on mobile) — persistent color palette at the TOP
              + step content below. Colors live here and only here: swap
              preview color anytime, at any step. This matches the user
              request to place the palette "tout à droite" and removes the
              duplicate that used to sit under the canvas. On mobile this
              panel spans full width beneath the canvas. */}
          <div className="p-4 overflow-auto flex flex-col gap-4 w-full">
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

              {/* Step 1 — Design
                  Merged from the old Step 1 (logo upload + side toggle)
                  and Step 2 (placement zones). One screen, progressive
                  disclosure: side tiles + uploader render immediately;
                  the zone/manual/center controls only appear AFTER a
                  logo is decoded so a first-time user doesn't see a wall
                  of disabled buttons on mount. */}
              {store.step === 1 && (
                <motion.div key="s1" initial={{ opacity:0, x:16 }} animate={{ opacity:1, x:0 }} exit={{ opacity:0, x:-16 }} className="space-y-4">
                  {/* Big visual placement tiles — replaces the old 2×2
                      radio grid. Each tile draws a simplified shirt
                      silhouette with the print zone highlighted so the
                      user grasps Devant / Dos / Devant+Dos at a glance
                      without parsing text. "Sans logo" keeps a plain
                      outline. All four share the same role="radio" API
                      so keyboard users still get Tab/Space/Enter. */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                        {lang === 'en' ? 'Placement' : 'Placement'}
                      </div>
                      {anyLogoUploaded && placementComplete && (
                        <span className="text-[10px] font-bold text-emerald-600 inline-flex items-center gap-1">
                          <Check size={10} strokeWidth={3} aria-hidden="true" />
                          {lang === 'en' ? 'Logo placed' : 'Logo placé'}
                        </span>
                      )}
                    </div>
                    <div
                      className="grid grid-cols-4 gap-1.5"
                      role="radiogroup"
                      aria-label={lang === 'en' ? 'Print sides' : 'Côtés à imprimer'}
                    >
                      {([
                        { id: 'front', label: lang === 'en' ? 'Front'        : 'Devant' },
                        { id: 'back',  label: lang === 'en' ? 'Back'         : 'Dos' },
                        { id: 'both',  label: lang === 'en' ? 'Both'         : 'Recto-verso' },
                        { id: 'none',  label: lang === 'en' ? 'Blank'        : 'Vierge' },
                      ] as const).map(opt => {
                        const active = store.placementSides === opt.id;
                        // Logo dot colour + position on the silhouette
                        // tells the whole story. Kept tiny (SVG inline,
                        // no raster) so the tiles stay crisp at any DPI
                        // and the file doesn't balloon with PNG imports.
                        return (
                          <button
                            key={opt.id}
                            type="button"
                            role="radio"
                            aria-checked={active}
                            onClick={() => {
                              store.setPlacementSides(opt.id as PlacementSides);
                              if (opt.id === 'back') store.setView('back');
                              else store.setView('front');
                            }}
                            className={`flex flex-col items-center gap-1 p-2 rounded-xl border-2 transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 ${
                              active
                                ? 'border-[#1B3A6B] bg-primary/5 shadow-sm'
                                : 'border-border text-muted-foreground hover:border-primary/40 hover:bg-secondary/40'
                            }`}
                          >
                            <PlacementTile kind={opt.id} active={active} />
                            <span className={`text-[10px] font-black leading-tight ${active ? 'text-[#1B3A6B]' : 'text-muted-foreground'}`}>
                              {opt.label}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Logo uploader — prominent dashed drop zone, the
                      user's first real action on the page. Hidden only
                      when they picked "Blank" (nothing to upload). */}
                  {store.placementSides !== 'none' && (
                    <LogoUploader
                      onLogoReady={(previewUrl, processedUrl, file) => {
                        const zone = pickDefaultZone(product.printZones);
                        const kind: 'garment' | 'cap' | 'beanie' =
                          product.category === 'cap' ? 'cap'
                          : product.category === 'toque' ? 'beanie'
                          : 'garment';
                        const auto = autoPlaceOnUpload({ bbox: bboxRef.current, zone }, kind);
                        const placement: LogoPlacement = {
                          zoneId: zone?.id ?? 'centre',
                          mode: 'preset',
                          previewUrl, processedUrl, originalFile: file,
                          ...auto,
                        };
                        if (store.placementSides === 'back') {
                          store.setLogoPlacementBack(placement);
                          store.setLogoPlacement(null);
                        } else if (store.placementSides === 'both') {
                          // Don't clone the active-view's bbox-derived
                          // placement onto BOTH sides — on products
                          // whose front/back silhouettes differ (hoodie
                          // with a big back graphic, zip vs pullover),
                          // the back placement would land wrong. Use
                          // the auto placement for the currently
                          // displayed view; seed the OTHER view from
                          // its own default zone (no bbox available
                          // for the un-mounted image yet — the user's
                          // first manual adjustment on that view will
                          // snap to the detected silhouette). */
                          const activeSide = store.activeView;
                          const otherSide: 'front' | 'back' =
                            activeSide === 'front' ? 'back' : 'front';
                          const otherZone = pickDefaultZoneForSide(product.printZones, otherSide) ?? zone;
                          const otherAuto = centerOnChest({ zone: otherZone });
                          const otherPlacement: LogoPlacement = {
                            zoneId: otherZone?.id ?? 'centre',
                            mode: 'preset',
                            previewUrl, processedUrl, originalFile: file,
                            ...otherAuto,
                          };
                          if (activeSide === 'back') {
                            store.setLogoPlacementBack(placement);
                            store.setLogoPlacement(otherPlacement);
                          } else {
                            store.setLogoPlacement(placement);
                            store.setLogoPlacementBack(otherPlacement);
                          }
                        } else {
                          store.setLogoPlacement(placement);
                          store.setLogoPlacementBack(null);
                        }
                        // Don't auto-advance — the user stays on the
                        // Design step so they can tweak the zone inline.
                        // This removes the old "flash to the next
                        // screen the moment you upload" surprise. The
                        // Continuer button unlocks as soon as the
                        // placement is complete.
                      }}
                    />
                  )}

                  {store.placementSides === 'none' && (
                    <div className="rounded-xl border border-dashed border-border p-4 text-center text-xs text-muted-foreground">
                      {lang === 'en'
                        ? 'No logo will be printed. Pick a color above — sizes come next.'
                        : 'Aucun logo ne sera imprimé. Choisis une couleur plus haut — les tailles viennent ensuite.'}
                    </div>
                  )}

                  {/* Placement controls (auto-center, chest, zone grid,
                      manual, remove) — revealed only after at least one
                      side has a decoded logo. Wrapping them in a single
                      gated block means the Design step looks tidy on
                      first render: a user with no logo yet sees only
                      the side tiles + the big drop zone, no clutter. */}
                  {store.placementSides !== 'none' && currentPlacement?.previewUrl && (
                    <div className="space-y-2 pt-1 border-t border-border/50">
                      <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground pt-2">
                        {lang === 'en' ? 'Fine-tune the placement' : 'Ajuste le placement'}
                      </div>

                      {/* Front/Back editing toggle — only relevant when
                          the user picked "Front + Back". Each side has
                          its own placement so they can be tuned
                          independently. */}
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
                                  ? (lang === 'en' ? 'Editing FRONT' : 'Édition DEVANT')
                                  : (lang === 'en' ? 'Editing BACK'  : 'Édition DOS')}
                              </button>
                            );
                          })}
                        </div>
                      )}

                      {/* Quick CENTER button — uses the REAL garment
                          bounding box from the photo so "center" lands
                          on the shirt body, not on canvas whitespace. */}
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
                        className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-br from-[#0052CC] to-[#1B3A6B] text-white text-sm font-extrabold shadow-md hover:shadow-lg hover:-translate-y-px transition-all"
                      >
                        <span aria-hidden="true">⊕</span>
                        {lang === 'en' ? 'Auto-center on garment' : 'Auto-centrer sur le vêtement'}
                      </button>

                      {store.activeView === 'front' && (
                        <button
                          type="button"
                          onClick={() => {
                            const zone = product.printZones.find(z => /poitrine|chest/i.test(z.label) || /poitrine|chest/i.test(z.labelEn ?? '')) ?? pickDefaultZone(product.printZones);
                            setCurrentPlacement({
                              ...currentPlacement!,
                              zoneId: zone?.id ?? 'poitrine-centre',
                              mode: 'preset',
                              ...centerOnChest({ bbox, zone }),
                            });
                          }}
                          className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-xl border-2 border-primary/30 text-primary text-sm font-bold hover:bg-primary/5 transition-all"
                        >
                          {lang === 'en' ? '↑ Center on chest' : '↑ Centrer sur la poitrine'}
                        </button>
                      )}

                      {/* Zone grid — filter by active view so back-view
                          users don't see chest zones. */}
                      {(() => {
                        const visibleZones = product.printZones.filter(z => !z.side || z.side === store.activeView);
                        if (visibleZones.length === 0) return null;
                        return (
                          <details className="rounded-xl border border-border bg-secondary/30">
                            <summary className="cursor-pointer select-none px-3.5 py-2.5 text-[11px] font-bold text-muted-foreground hover:text-foreground flex items-center justify-between">
                              <span>{lang === 'en' ? 'Pick a specific zone' : 'Choisir une zone précise'}</span>
                              <span className="text-[10px] text-muted-foreground/70">{visibleZones.length}</span>
                            </summary>
                            <div className="p-2 space-y-1">
                              {visibleZones.map(z => {
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
                                    className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg border text-left transition-all ${
                                      active
                                        ? 'border-primary bg-primary/5 text-primary shadow-sm'
                                        : 'border-border/60 text-muted-foreground hover:border-primary/40 hover:bg-secondary/70'
                                    }`}
                                  >
                                    <div className={`w-2 h-2 rounded-full flex-shrink-0 ${active ? 'bg-primary' : 'bg-border'}`} />
                                    <span className="text-[11px] font-bold flex-1">
                                      {lang === 'en' ? (z.labelEn ?? z.label) : z.label}
                                    </span>
                                    <span className={`text-[10px] font-extrabold ${isFree ? 'text-green-600' : 'text-muted-foreground'}`}>
                                      {isFree
                                        ? (lang === 'en' ? 'Included' : 'Inclus')
                                        : `+${fmtMoney(z.extraPrice, lang)}`}
                                    </span>
                                  </button>
                                );
                              })}
                            </div>
                          </details>
                        );
                      })()}

                      {/* Manual drag-to-place and remove share a row so
                          the secondary actions don't compete with the
                          primary Continuer button in the footer. */}
                      <div className="grid grid-cols-2 gap-2">
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
                          className={`flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl border-2 border-dashed text-[11px] font-bold transition-all ${
                            currentPlacement?.mode === 'manual'
                              ? 'border-primary bg-primary/5 text-primary'
                              : 'border-border text-muted-foreground hover:border-primary/40'
                          }`}
                        >
                          ✋ {lang === 'en' ? 'Drag' : 'Glisser'}
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            store.setLogoPlacement(null);
                            store.setLogoPlacementBack(null);
                          }}
                          className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl border border-dashed border-destructive/40 text-destructive text-[11px] font-bold hover:bg-destructive/5 transition-colors"
                        >
                          <X size={12} />
                          {lang === 'en' ? 'Remove' : 'Retirer'}
                        </button>
                      </div>
                    </div>
                  )}
                </motion.div>
              )}

              {/* Step 2 (was Step 3) — Multi-color × multi-size matrix */}
              {store.step === 2 && (
                <motion.div key="s2" initial={{ opacity:0, x:16 }} animate={{ opacity:1, x:0 }} exit={{ opacity:0, x:-16 }}>
                  <h3 className="text-sm font-black mb-1">{t('taillesQuantites')}</h3>
                  <p className="text-xs text-muted-foreground mb-3">
                    {lang === 'en'
                      ? 'Pick one or several colors. For each, choose sizes and quantities.'
                      : 'Choisis une ou plusieurs couleurs. Pour chacune, sélectionne les tailles et quantités.'}
                  </p>
                  {store.placementSides !== 'none' && !placementComplete && (
                    <div className="mb-3 rounded-xl border border-amber-500/40 bg-amber-500/5 text-amber-800 text-[11px] font-semibold p-2.5 flex items-start gap-2">
                      <span aria-hidden="true">⚠</span>
                      <div className="flex-1">
                        {lang === 'en'
                          ? 'Your logo placement isn\u2019t complete. Go back to Design to finish, or pick "Blank" for a plain garment.'
                          : 'Le placement de ton logo n\u2019est pas terminé. Reviens à l\u2019étape Design, ou choisis « Vierge » pour un vêtement sans logo.'}
                      </div>
                    </div>
                  )}
                  <MultiVariantPicker
                    product={shopifyColor?.sizeOptions?.length
                      ? { ...product, sizes: shopifyColor.sizeOptions.map(s => s.size) }
                      : product}
                    colors={displayColors}
                    activeColor={shopifyColor ?? displayColors[0] ?? null}
                    variants={multiVariants}
                    onChange={setMultiVariants}
                  />
                </motion.div>
              )}

              {/* Step 3 (was Step 4) — Summary */}
              {store.step === 3 && (
                <motion.div key="s3" initial={{ opacity:0, x:16 }} animate={{ opacity:1, x:0 }} exit={{ opacity:0, x:-16 }} className="space-y-3">
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

                  {/* Per-color × size itemized breakdown — mockup-style confirmation.
                      Each (color × size) cell is its own line with qty × unit → line total,
                      so the customer sees exactly what they're paying for. Only shown when
                      the multi-variant flow was used. */}
                  {multiVariants.length > 0 && (
                    <div className="bg-secondary/70 rounded-xl p-3 border border-border">
                      <div className="flex items-center justify-between mb-2.5">
                        <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                          {lang === 'en' ? 'Itemized breakdown' : 'Détail par article'}
                        </div>
                        <div className="text-[10px] font-bold text-muted-foreground">
                          {new Set(multiVariants.map(v => v.colorId)).size} {lang === 'en' ? (new Set(multiVariants.map(v => v.colorId)).size === 1 ? 'color' : 'colors') : (new Set(multiVariants.map(v => v.colorId)).size === 1 ? 'couleur' : 'couleurs')}
                          {' · '}
                          {multiVariants.length} {lang === 'en' ? (multiVariants.length === 1 ? 'row' : 'rows') : (multiVariants.length === 1 ? 'ligne' : 'lignes')}
                        </div>
                      </div>
                      <div className="space-y-2">
                        {Array.from(
                          multiVariants.reduce<Map<string, { name: string; hex: string; sizes: { size: string; qty: number }[]; qty: number }>>((acc, v) => {
                            const existing = acc.get(v.colorId);
                            if (existing) {
                              existing.sizes.push({ size: v.size, qty: v.qty });
                              existing.qty += v.qty;
                            } else {
                              acc.set(v.colorId, { name: v.colorName, hex: v.hex, sizes: [{ size: v.size, qty: v.qty }], qty: v.qty });
                            }
                            return acc;
                          }, new Map()).values(),
                        ).map(g => {
                          const groupLineTotal = parseFloat((g.qty * unitPrice).toFixed(2));
                          return (
                            <div key={g.name} className="rounded-lg bg-background/70 border border-border/60 p-2.5">
                              <div className="flex items-center gap-2 mb-1.5">
                                <span className="w-3.5 h-3.5 rounded-full ring-1 ring-border flex-shrink-0 shadow-sm" style={{ background: g.hex }} />
                                <span className="font-extrabold text-xs flex-shrink-0">{g.name}</span>
                                <span className="ml-auto text-[11px] font-bold text-foreground/70">
                                  {g.qty} × {fmtMoney(unitPrice, lang)}
                                  <span className="ml-1.5 font-black text-foreground">= {fmtMoney(groupLineTotal, lang)}</span>
                                </span>
                              </div>
                              <div className="flex flex-wrap gap-1">
                                {g.sizes.map((s, i) => (
                                  <span
                                    key={`${s.size}-${i}`}
                                    className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-secondary text-[10px] font-bold text-foreground/80"
                                  >
                                    <span className="uppercase tracking-wide">{s.size}</span>
                                    <span className="text-muted-foreground">×</span>
                                    <span className="text-primary">{s.qty}</span>
                                  </span>
                                ))}
                              </div>
                            </div>
                          );
                        })}
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
                      [t('prixUnitaire'),   fmtMoney(product.basePrice, lang)],
                      [
                        t('impression'),
                        store.placementSides === 'none'
                          ? (lang === 'en' ? 'Not included' : 'Non inclus')
                          : store.placementSides === 'both'
                            ? `${fmtMoney(PRINT_PRICE, lang)} · ${lang === 'en' ? 'front + back included' : 'recto-verso inclus'}`
                            : fmtMoney(PRINT_PRICE, lang),
                      ],
                    ].map(([l, v]) => (
                      <div key={l} className="flex justify-between text-sm">
                        <span className="text-muted-foreground">{l}</span>
                        <span className="font-bold">{v}</span>
                      </div>
                    ))}

                    {/* Line totals — subtotal (before discount) → savings → total.
                        This reads like a professional invoice so the customer
                        can see exactly where each dollar goes. */}
                    {(() => {
                      const subtotal = parseFloat((totalQty * unitPrice).toFixed(2));
                      const savings  = parseFloat((subtotal - totalPrice).toFixed(2));
                      return (
                        <>
                          <div className="border-t border-border/60 pt-2.5 flex justify-between text-sm">
                            <span className="text-muted-foreground">
                              {lang === 'en' ? 'Subtotal' : 'Sous-total'}
                            </span>
                            <span className={`font-bold ${hasDiscount ? 'text-muted-foreground line-through decoration-muted-foreground/40' : ''}`}>
                              {fmtMoney(subtotal, lang)}
                            </span>
                          </div>
                          {hasDiscount ? (
                            <div className="flex items-center justify-between text-sm -mt-0.5">
                              <span className="inline-flex items-center gap-1.5">
                                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-emerald-100 text-emerald-700 text-[10px] font-black uppercase tracking-wide">
                                  −{Math.round(BULK_DISCOUNT_RATE * 100)}%
                                </span>
                                <span className="text-emerald-700 font-bold">{t('rabaisQuantite')}</span>
                              </span>
                              <span className="font-black text-emerald-600">
                                −{fmtMoney(savings, lang)}
                              </span>
                            </div>
                          ) : (
                            totalQty > 0 && totalQty < BULK_DISCOUNT_THRESHOLD && (
                              <div className="flex items-center justify-between text-[11px] text-muted-foreground -mt-0.5">
                                <span className="italic">
                                  {lang === 'en'
                                    ? `Add ${BULK_DISCOUNT_THRESHOLD - totalQty} more to unlock −${Math.round(BULK_DISCOUNT_RATE * 100)}%`
                                    : `Ajoute ${BULK_DISCOUNT_THRESHOLD - totalQty} de plus pour débloquer −${Math.round(BULK_DISCOUNT_RATE * 100)}%`}
                                </span>
                              </div>
                            )
                          )}
                        </>
                      );
                    })()}
                    <div className="border-t border-border pt-2.5 flex items-baseline justify-between">
                      <span className="font-black">{t('totalEstime')}</span>
                      <span className="font-black text-primary text-xl tracking-tight">{fmtMoney(totalPrice, lang)}</span>
                    </div>
                  </div>

                  {/* Larger mockup-style preview card — 96px thumbnail reads
                      like a professional confirmation. Shows whichever side(s)
                      have a placement. Each side has inline edit + remove so
                      the customer can adjust without going back through the
                      whole flow. */}
                  {(store.logoPlacement?.previewUrl || store.logoPlacementBack?.previewUrl) && (
                    <div className="p-3.5 bg-secondary rounded-xl border border-border space-y-3">
                      {([
                        { key: 'front' as const, p: store.logoPlacement,     label: lang === 'en' ? 'Front' : 'Devant' },
                        { key: 'back'  as const, p: store.logoPlacementBack, label: lang === 'en' ? 'Back'  : 'Dos' },
                      ]).filter(s => !!s.p?.previewUrl).map(s => (
                        <div key={s.key} className="flex gap-3.5 items-center">
                          <div className="relative w-24 h-24 rounded-xl border border-border bg-white overflow-hidden flex-shrink-0 shadow-sm">
                            <div
                              className="absolute inset-0"
                              style={{ backgroundImage: 'repeating-conic-gradient(#eee 0% 25%, white 0% 50%)', backgroundSize: '10px 10px' }}
                              aria-hidden="true"
                            />
                            <img src={s.p!.previewUrl} alt={s.label} className="relative w-full h-full object-contain p-2" onError={e => { (e.currentTarget as HTMLImageElement).style.visibility = 'hidden'; }} />
                            <span className="absolute top-1 left-1 px-1.5 py-0.5 rounded-md bg-primary/90 text-primary-foreground text-[9px] font-black uppercase tracking-wider shadow-sm">
                              {s.label}
                            </span>
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] font-bold uppercase tracking-wider text-primary">{s.label}</span>
                              {s.p?.mode === 'manual' && (
                                <span className="text-[10px] text-muted-foreground">· {lang === 'en' ? 'manual' : 'manuel'}</span>
                              )}
                            </div>
                            <p className="text-sm font-black truncate">{product.shortName}</p>
                            <p className="text-[10px] text-muted-foreground mt-0.5">
                              {lang === 'en' ? 'Zone' : 'Zone'}: <span className="font-semibold text-foreground">{s.p?.zoneId}</span>
                            </p>
                          </div>
                          <div className="flex items-center gap-1 flex-shrink-0">
                            <button
                              type="button"
                              onClick={() => {
                                store.setView(s.key);
                                // Design + placement share Step 1 after
                                // the 2026-04-20 collapse — edit lands
                                // back on the Design screen with the
                                // placement controls revealed.
                                store.setStep(1);
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
                      <div className="flex items-center gap-2 pt-2 border-t border-border/50 text-[11px]">
                        <span className="text-muted-foreground">
                          {totalQty} {t(totalQty !== 1 ? 'unitPluralLabel' : 'unitLabel')}
                        </span>
                        <span className="text-muted-foreground/50">·</span>
                        <span className="font-extrabold text-foreground">{fmtMoney(totalPrice, lang)}</span>
                        {hasDiscount && (
                          <span className="ml-auto inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-emerald-100 text-emerald-700 text-[9px] font-black uppercase tracking-wider">
                            −{Math.round(BULK_DISCOUNT_RATE * 100)}%
                          </span>
                        )}
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
        <div className="px-5 py-3.5 border-t border-border flex items-center justify-between bg-background gap-2">
          <button
            type="button"
            onClick={goBack}
            disabled={store.step === 1}
            className="flex items-center gap-1.5 text-sm font-bold text-muted-foreground disabled:opacity-20 hover:text-foreground transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 rounded"
          >
            <ChevronLeft size={15} aria-hidden="true" /> {t('retour')}
          </button>

          {/* Persistent "Export PNG" action — available at every step so the
              customer can snapshot their mockup without first completing
              sizes / quantities. Needs a logo or a chosen colour so there's
              actually something to export; greyed out otherwise. */}
          <button
            type="button"
            onClick={handleDownloadMockup}
            disabled={!anyLogoUploaded && !colorChosen}
            aria-label={lang === 'en' ? 'Download mockup PNG' : 'Télécharger l\u2019aperçu PNG'}
            title={lang === 'en' ? 'Download mockup PNG' : 'Télécharger l\u2019aperçu PNG'}
            className="flex items-center gap-1.5 px-3 py-2 rounded-full border border-border text-xs font-bold text-muted-foreground hover:text-primary hover:border-primary hover:bg-primary/5 disabled:opacity-40 disabled:cursor-not-allowed transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1"
          >
            <Download size={13} aria-hidden="true" />
            <span className="hidden sm:inline">{lang === 'en' ? 'Export PNG' : 'Télécharger aperçu'}</span>
          </button>

          {totalQty > 0 && store.step >= 2 && (
            <div className="text-center">
              <div className="text-[10px] text-muted-foreground">
                {totalQty} {t(totalQty !== 1 ? 'unitPluralLabel' : 'unitLabel')}
              </div>
              <div className="text-sm font-black text-primary">{fmtMoney(totalPrice, lang)}</div>
            </div>
          )}

          {store.step < 3 ? (
            <button
              type="button"
              onClick={goNext}
              disabled={!canNext()}
              className="flex items-center gap-1.5 bg-primary text-primary-foreground text-sm font-black px-5 py-2.5 rounded-full disabled:opacity-30 hover:opacity-90 transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
            >
              {t('suivant')} <ChevronRight size={15} aria-hidden="true" />
            </button>
          ) : (
            <button
              type="button"
              onClick={handleAddToCart}
              disabled={totalQty === 0 || adding}
              aria-busy={adding}
              className="flex items-center gap-2 bg-primary text-primary-foreground text-sm font-black px-5 py-2.5 rounded-full disabled:opacity-30 hover:opacity-90 transition-all shadow-md focus:outline-none focus-visible:ring-4 focus-visible:ring-[#E8A838]/60 focus-visible:ring-offset-2"
            >
              <ShoppingBag size={14} aria-hidden="true" />
              {adding ? (lang === 'en' ? 'Adding…' : 'Ajout…') : t('ajouterPanier')}
            </button>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}

/** Visual placement tile — inline SVG silhouette with a logo dot drawn
 * at the relevant position. Picked over raster thumbnails so it stays
 * crisp at any DPI and we don't ship four extra PNGs just for the picker.
 * Palette mirrors the brand (#1B3A6B navy + #E8A838 gold) when active,
 * muted neutral otherwise. Kept fully presentational — no state, no
 * props beyond the two visual inputs, so it plays nice with the
 * button wrapper's click/aria behaviour. */
function PlacementTile({ kind, active }: { kind: 'front' | 'back' | 'both' | 'none'; active: boolean }) {
  const stroke = active ? '#1B3A6B' : '#9CA3AF';   // navy / muted
  const fill = active ? '#EEF2F7' : 'transparent'; // faint navy tint when active
  const dotColor = active ? '#E8A838' : '#9CA3AF'; // brand gold / muted
  const dotOpacity = kind === 'none' ? 0 : 1;
  return (
    <svg viewBox="0 0 40 44" width="34" height="38" aria-hidden="true" role="presentation">
      {/* Shirt silhouette — one path, same for front/back/both/none.
          The logo dot is what differentiates the tiles. */}
      <path
        d="M6 10 L14 5 L20 7 L26 5 L34 10 L32 14 L28 13 L28 40 L12 40 L12 13 L8 14 Z"
        fill={fill}
        stroke={stroke}
        strokeWidth={1.5}
        strokeLinejoin="round"
      />
      {/* Front logo dot — chest area */}
      {(kind === 'front' || kind === 'both') && (
        <circle cx={20} cy={20} r={3} fill={dotColor} opacity={dotOpacity} />
      )}
      {/* Back logo dot — drawn slightly offset so a "both" tile shows
          both locations without overlap; the tile silhouette is the
          same front shape for simplicity. */}
      {(kind === 'back' || kind === 'both') && (
        <circle
          cx={kind === 'both' ? 20 : 20}
          cy={kind === 'both' ? 30 : 22}
          r={3}
          fill={dotColor}
          opacity={dotOpacity}
          stroke={kind === 'both' ? '#fff' : undefined}
          strokeWidth={kind === 'both' ? 1 : 0}
        />
      )}
    </svg>
  );
}
