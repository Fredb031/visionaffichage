# Customizer fixes — done + pending

Per Frederick's report, addressing all customizer bugs and gaps.

## ✅ Fixed in this commit

1. **Black option disappears after picking another color**
   - Removed the `filteredShopifyColors` filter in `ProductCustomizer.tsx`
     that hid colors lacking a per-color image entry.
   - All Shopify-returned colors now stay visible at all times.
   - The "Real color" badge in the canvas (emerald, top-left) signals
     when the picked color comes with a true per-color photo.

2. **Logo + placement reset when color changes**
   - Split `ProductCanvas.tsx` useEffect into two:
     - **Init effect** runs only on mount + canvas resize (`canvasKey` dep)
     - **Photo-swap effect** reacts to `imageDevant`/`imageDos`/`activeView`/
       `garmentColor` and replaces just the underlying photo + tint in-place
       via new `photoObj.current` + `tintObj.current` refs.
   - Logo position, scale, rotation now persist perfectly across color
     picks — no more flicker, no more reset.

3. **No clear "center" button**
   - Step 3 now opens with a prominent gradient CTA: "Centrer le logo
     sur le vêtement" — single click sets x=50% (horizontal center) and
     snaps to the chest/center print zone.
   - Followed by a divider "ou choisis une zone" before the regular zone list.

4. **Manual placement was a tiny hint text**
   - Replaced with an explicit border-dashed button: "✋ Placer manuellement
     (glisse sur le produit)".
   - Active state highlights when `mode === 'manual'`.

5. **Duplicate Color row in ProductDetail**
   - Removed the decorative "Colors · N" swatch row at top of ProductDetail
     (it was non-interactive).
   - The interactive "Couleur" option below (real swatches with selection
     state, "Couleur" label in French) is now the only color UI.

6. **Multi-color × multi-size at the end**
   - New `MultiVariantPicker.tsx` component: pick a color via the swatch
     row, then add quantities per size for that color. Switch colors and
     keep adding — every combination becomes a separate variant.
   - Live summary card at the bottom shows each color × size × qty.
   - Bulk discount banner reflects total across all variants.
   - Wired into Step 4 of ProductCustomizer; `totalQty` derived from
     multi-variants when populated, falls back to legacy `sizeQuantities`.

## 🔧 Still to wire (next commits)

- **Cart line items per variant**: currently ProductCustomizer's
  `handleAddToCart` builds a single line item with `totalQty`. With
  multi-variants this should generate one cart line item per
  (color × size) combination. The cart store already supports this
  shape — just need to iterate `multiVariants` in handleAddToCart.

- **Persist multi-variants to customizer store**: currently held in
  local state. If user steps back/forth, it's preserved by React but
  lost on full unmount. Consider adding `variantQuantities: VariantQty[]`
  to `customizerStore.ts`.

- **Photoshop-style alignment guides**: already added in earlier commit.
  Verify they appear when dragging logo near canvas center.

- **Color ↔ image sync in Step 1**: when picking a color in Step 1
  (ColorPicker), the canvas should preview that color immediately
  before the user uploads a logo. Currently works — verify.

- **Print zone outline visibility**: ensure the dashed outline is clearly
  visible on every garment color (currently white at 50% opacity — may
  be hard to see on white/cream garments).

- **Front/back zone awareness**: when user toggles to back view, the
  zone presets in Step 3 should reflect back-side zones (currently
  shows the full zones list regardless of view).

- **Logo upload validation**: ensure SVG/AI/PDF uploads work as well
  as PNG/JPG.

- **Undo/Redo**: nice-to-have for the canvas.
