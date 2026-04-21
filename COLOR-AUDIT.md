# Color-Image Sync Audit

## Post-sweep status (2026-04-20)

After the final `findColorImage` sweep (SKU_ALIAS expansions + alt-slug
additions for `concrete` and `military_green`), coverage climbed from
**92.1% → 99.0%** of palette entries. Recovered 14 of the 16 remaining misses:

- **ATCF2600** `forest-green` → ATCF2500 `darkgreen_022017` (via `ATCF2600 → ATCF2500` alias)
- **ATC1015** `gold` → ATC1000 `gold_012017` (via `ATC1015 → ATC1000` alias)
- **S445LS** `forest-green` → L445 `greenoasis_082015` (via `S445LS → [S445, L445]` alias)
- **ATC6606** `grey`, `forest-green` → ATC6277 `grey_042018` / `spruce_042015` (via `ATC6606 → ATC6277` alias)
- **ATC6277** `black-white`, `navy-white` → ATC6606 `black_white_cil` / `navy_white_cil` (via `ATC6277 → ATC6606` alias)
- **6245CM** `red`, `true-royal` → ATC6606 `red_white_cil` / `royal_white_cil` (via chained alias `6245CM → [ATC6245CM, ATC6606]`)
- **WERK250** `red`, `true-royal`, `forest-green` → ATC1000 `red_012017` / `royal_012017` / `darkgreen_v5_012017` (via `WERK250 → ATC1000` alias)
- **C100** `steel-grey` → `concrete_cil` (via new `concrete` alt-slug)
- **C100** `forest-green` → `military_green_cil` (via new `military_green` fallback in forest-green alt-slugs)

### Still genuinely unresolvable (supplier has no photography)

- **S445** `cardinal` — no cardinal/maroon/sangria/burgundy images for S445 body.
- **L445** `cardinal` — no cardinal/maroon/sangria/burgundy images for L445 body.

We deliberately do NOT alias cardinal to `truered` because cardinal and red
coexist in POLO_S445_COLORS and would collide on the same swatch. Request
cardinal/maroon photography from the supplier for these two SKUs to close
the last 1% gap.

---

_Original audit run: 2026-04-21T03:38:57.505Z_

- Products audited: **20**
- Total files in public/products: **786**
- Files referenced by COLOR_IMAGES / product data: **783**
- Dead-link paths (referenced but missing): **0**
- Orphan files (on disk but never referenced): **3**

## Legend
- **Colors without images**: entries in `product.colors` for which `hasRealColorImage` returns false (they get filtered out by `filterRealColors` → hidden from the swatch UI).
- **Image entries without matching color**: keys in `COLOR_IMAGES[sku]` that don't correspond to any color in the product's palette (via `findColorImage` lookup).
- A color being "filtered out" is not necessarily a bug — it means users never see that swatch. If all colors would be filtered, `filterRealColors` returns the full list as fallback.

## ATCF2500 (atcf2500) — palette: ATCF2500_COLORS

- Palette size: **18**, with image: **13**, filtered out: **5**
- COLOR_IMAGES entries for this SKU: **32**

### Colors without images (will be filtered)
- `steel-grey` — "Gris acier" / "Steel Grey"
- `forest-green` — "Vert forêt" / "Forest Green"
- `charcoal` — "Charbon" / "Charcoal"
- `cardinal` — "Cardinal" / "Cardinal"
- `natural` — "Naturel" / "Natural"

### Image entries without matching color (unused keys in COLOR_IMAGES)
- `ash_grey_cil` — front=/products/ATCF2500-front-ash_grey_cil.jpg, back=/products/ATCF2500-back-ash_grey_cil.jpg
- `black_022017` — front=/products/ATCF2500-front-black_022017.jpg, back=/products/ATCF2500-back-black_022017.jpg
- `caramel` — front=/products/ATCF2500-front-caramel.jpg, back=/products/ATCF2500-back-caramel.jpg
- `caramel_cil` — front=/products/ATCF2500-front-caramel_cil.jpg, back=/products/ATCF2500-back-caramel_cil.jpg
- `dark_chocolate_brown_cil` — front=/products/ATCF2500-front-dark_chocolate_brown_cil.jpg, back=/products/ATCF2500-back-dark_chocolate_brown_cil.jpg
- `dark_navy_052019` — front=/products/ATCF2500-front-dark_navy_052019.jpg, back=/products/ATCF2500-back-dark_navy_052019.jpg
- `darkgreen_022017` — front=/products/ATCF2500-front-darkgreen_022017.jpg, back=/products/ATCF2500-back-darkgreen_022017.jpg
- `darkheathergrey_012017` — front=/products/ATCF2500-front-darkheathergrey_012017.jpg, back=/products/ATCF2500-back-darkheathergrey_012017.jpg
- `darkheathergrey_1` — front=/products/ATCF2500-front-darkheathergrey_1.jpg
- `heathernavy_112017` — front=/products/ATCF2500-front-heathernavy_112017.jpg, back=/products/ATCF2500-back-heathernavy_112017.jpg
- `kelly_022017` — front=/products/ATCF2500-front-kelly_022017.jpg, back=/products/ATCF2500-back-kelly_022017.jpg
- `light-blue` — front=/products/ATCF2500-front-light-blue.jpg, back=/products/ATCF2500-back-light-blue.jpg
- `navy_022017` — front=/products/ATCF2500-front-navy_022017.jpg, back=/products/ATCF2500-back-navy_022017.jpg
- `oatmeal_heather_cil` — front=/products/ATCF2500-front-oatmeal_heather_cil.jpg, back=/products/ATCF2500-back-oatmeal_heather_cil.jpg
- `orange_022017` — front=/products/ATCF2500-front-orange_022017.jpg, back=/products/ATCF2500-back-orange_022017.jpg
- `sand_cil` — front=/products/ATCF2500-front-sand_cil.jpg, back=/products/ATCF2500-back-sand_cil.jpg
- `sangria_022017` — front=/products/ATCF2500-front-sangria_022017.jpg, back=/products/ATCF2500-back-sangria_022017.jpg
- `sapphire_022017` — front=/products/ATCF2500-front-sapphire_022017.jpg, back=/products/ATCF2500-back-sapphire_022017.jpg

## ATCY2500 (atcy2500) — palette: ATCF2500_COLORS

- Palette size: **10**, with image: **8**, filtered out: **2**
- COLOR_IMAGES entries for this SKU: **22**

### Colors without images (will be filtered)
- `steel-grey` — "Gris acier" / "Steel Grey"
- `forest-green` — "Vert forêt" / "Forest Green"

### Image entries without matching color (unused keys in COLOR_IMAGES)
- `caramel` — front=/products/ATCY2500-front-caramel.jpg, back=/products/ATCY2500-back-caramel.jpg
- `caramel_cil` — front=/products/ATCY2500-front-caramel_cil.jpg, back=/products/ATCY2500-back-caramel_cil.jpg
- `gold_022017` — front=/products/ATCY2500-front-gold_022017.jpg, back=/products/ATCY2500-back-gold_022017.jpg
- `kelly_022017` — front=/products/ATCY2500-front-kelly_022017.jpg, back=/products/ATCY2500-back-kelly_022017.jpg
- `military_gree` — front=/products/ATCY2500-front-military_gree.jpg, back=/products/ATCY2500-back-military_gree.jpg
- `military_green_cil` — front=/products/ATCY2500-front-military_green_cil.jpg, back=/products/ATCY2500-back-military_green_cil.jpg
- `oatmeal-heather` — front=/products/ATCY2500-front-oatmeal-heather.jpg, back=/products/ATCY2500-back-oatmeal-heather.jpg
- `oatmeal_heather_cil` — front=/products/ATCY2500-front-oatmeal_heather_cil.jpg, back=/products/ATCY2500-back-oatmeal_heather_cil.jpg
- `orange_022017` — front=/products/ATCY2500-front-orange_022017.jpg, back=/products/ATCY2500-back-orange_022017.jpg
- `purple_022017` — front=/products/ATCY2500-front-purple_022017.jpg, back=/products/ATCY2500-back-purple_022017.jpg
- `sand_cil` — front=/products/ATCY2500-front-sand_cil.jpg, back=/products/ATCY2500-back-sand_cil.jpg
- `sangria_022017` — front=/products/ATCY2500-front-sangria_022017.jpg, back=/products/ATCY2500-back-sangria_022017.jpg
- `sapphire_022017` — front=/products/ATCY2500-front-sapphire_022017.jpg, back=/products/ATCY2500-back-sapphire_022017.jpg

## ATCF2600 (atcf2600) — palette: ATCF2500_COLORS

- Palette size: **10**, with image: **8**, filtered out: **2**
- COLOR_IMAGES entries for this SKU: **17**

### Colors without images (will be filtered)
- `steel-grey` — "Gris acier" / "Steel Grey"
- `forest-green` — "Vert forêt" / "Forest Green"

### Image entries without matching color (unused keys in COLOR_IMAGES)
- `caramel` — front=/products/ATCF2600-front-caramel.jpg, back=/products/ATCF2600-back-caramel.jpg
- `caramel_cil` — front=/products/ATCF2600-front-caramel_cil.jpg, back=/products/ATCF2600-back-caramel_cil.jpg
- `darkheathergrey_012017` — front=/products/ATCF2600-front-darkheathergrey_012017.jpg, back=/products/ATCF2600-back-darkheathergrey_012017.jpg
- `maroon_cil` — front=/products/ATCF2600-front-maroon_cil.jpg, back=/products/ATCF2600-back-maroon_cil.jpg
- `military_gree` — front=/products/ATCF2600-front-military_gree.jpg, back=/products/ATCF2600-back-military_gree.jpg
- `military_green_cil` — front=/products/ATCF2600-front-military_green_cil.jpg, back=/products/ATCF2600-back-military_green_cil.jpg
- `navy_022017` — front=/products/ATCF2600-front-navy_022017.jpg, back=/products/ATCF2600-back-navy_022017.jpg
- `oatmeal_heather_cil` — front=/products/ATCF2600-front-oatmeal_heather_cil.jpg, back=/products/ATCF2600-back-oatmeal_heather_cil.jpg
- `orange_cil` — front=/products/ATCF2600-front-orange_cil.jpg, back=/products/ATCF2600-back-orange_cil.jpg
- `sand_cil` — front=/products/ATCF2600-front-sand_cil.jpg, back=/products/ATCF2600-back-sand_cil.jpg

## ATCF2400 (atcf2400) — palette: ATCF2500_COLORS

- Palette size: **10**, with image: **8**, filtered out: **2**
- COLOR_IMAGES entries for this SKU: **17**

### Colors without images (will be filtered)
- `steel-grey` — "Gris acier" / "Steel Grey"
- `forest-green` — "Vert forêt" / "Forest Green"

### Image entries without matching color (unused keys in COLOR_IMAGES)
- `caramel` — front=/products/ATCF2400-front-caramel.jpg, back=/products/ATCF2400-back-caramel.jpg
- `caramel_cil` — front=/products/ATCF2400-front-caramel_cil.jpg, back=/products/ATCF2400-back-caramel_cil.jpg
- `dark_green_cil` — front=/products/ATCF2400-front-dark_green_cil.jpg, back=/products/ATCF2400-back-dark_green_cil.jpg
- `darkheathergrey_v2` — front=/products/ATCF2400-front-darkheathergrey_v2.jpg, back=/products/ATCF2400-back-darkheathergrey_v2.jpg
- `maroon_cil` — front=/products/ATCF2400-front-maroon_cil.jpg, back=/products/ATCF2400-back-maroon_cil.jpg
- `military_green_cil` — front=/products/ATCF2400-front-military_green_cil.jpg, back=/products/ATCF2400-back-military_green_cil.jpg
- `navy_112017` — front=/products/ATCF2400-front-navy_112017.jpg, back=/products/ATCF2400-back-navy_112017.jpg
- `oatmeal_heather_cil` — front=/products/ATCF2400-front-oatmeal_heather_cil.jpg, back=/products/ATCF2400-back-oatmeal_heather_cil.jpg
- `sand_cil` — front=/products/ATCF2400-front-sand_cil.jpg, back=/products/ATCF2400-back-sand_cil.jpg

## ATC1000 (atc1000) — palette: ATC1000_COLORS

- Palette size: **16**, with image: **13**, filtered out: **3**
- COLOR_IMAGES entries for this SKU: **68**

### Colors without images (will be filtered)
- `forest-green` — "Vert forêt" / "Forest Green"
- `cardinal` — "Cardinal" / "Cardinal"
- `charcoal` — "Charbon" / "Charcoal"  _(FR match attempt: "charcoal_012017" (no front); EN match attempt: "charcoal_012017" (no front))_

### Image entries without matching color (unused keys in COLOR_IMAGES)
- `aquatic-blue` — front=/products/ATC1000-front-aquatic-blue.jpg, back=/products/ATC1000-back-aquatic-blue.jpg
- `aquatic_blue_cil` — front=/products/ATC1000-front-aquatic_blue_cil.jpg, back=/products/ATC1000-back-aquatic_blue_cil.jpg
- `ash_grey_cil` — front=/products/ATC1000-front-ash_grey_cil.jpg, back=/products/ATC1000-back-ash_grey_cil.jpg
- `athleticheather_012017` — back=/products/ATC1000-back-athleticheather_012017.jpg
- `athleticrheather_012017` — front=/products/ATC1000-front-athleticrheather_012017.jpg
- `black_012017` — front=/products/ATC1000-front-black_012017.jpg, back=/products/ATC1000-back-black_012017.jpg
- `bright_aqua_cil` — front=/products/ATC1000-front-bright_aqua_cil.jpg, back=/products/ATC1000-back-bright_aqua_cil.jpg
- `candy_pink_cil` — front=/products/ATC1000-front-candy_pink_cil.jpg, back=/products/ATC1000-back-candy_pink_cil.jpg
- `caramel_cil` — front=/products/ATC1000-front-caramel_cil.jpg, back=/products/ATC1000-back-caramel_cil.jpg
- `carolina_blue_cil` — front=/products/ATC1000-front-carolina_blue_cil.jpg, back=/products/ATC1000-back-carolina_blue_cil.jpg
- `charcoal_012017` — back=/products/ATC1000-back-charcoal_012017.jpg
- `charcoal_v2_012017` — front=/products/ATC1000-front-charcoal_v2_012017.jpg
- `chocolate_brown_cil` — front=/products/ATC1000-front-chocolate_brown_cil.jpg, back=/products/ATC1000-back-chocolate_brown_cil.jpg
- `clover_green_cil` — front=/products/ATC1000-front-clover_green_cil.jpg, back=/products/ATC1000-back-clover_green_cil.jpg
- `coyote_brown_cil` — front=/products/ATC1000-front-coyote_brown_cil.jpg, back=/products/ATC1000-back-coyote_brown_cil.jpg
- `dark_navy_052019` — front=/products/ATC1000-front-dark_navy_052019.jpg, back=/products/ATC1000-back-dark_navy_052019.jpg
- `dark_sand_cil` — front=/products/ATC1000-front-dark_sand_cil.jpg, back=/products/ATC1000-back-dark_sand_cil.jpg
- `darkgreen_022017` — back=/products/ATC1000-back-darkgreen_022017.jpg
- `darkgreen_v5_012017` — front=/products/ATC1000-front-darkgreen_v5_012017.jpg
- `darkheathergrey_012017` — front=/products/ATC1000-front-darkheathergrey_012017.jpg, back=/products/ATC1000-back-darkheathergrey_012017.jpg
- `fatiguegreen_092019` — front=/products/ATC1000-front-fatiguegreen_092019.jpg, back=/products/ATC1000-back-fatiguegreen_092019.jpg
- `graphite_heather_1` — front=/products/ATC1000-front-graphite_heather_1.jpg, back=/products/ATC1000-back-graphite_heather_1.jpg
- `graphite_heather_cil` — front=/products/ATC1000-front-graphite_heather_cil.jpg, back=/products/ATC1000-back-graphite_heather_cil.jpg
- `heather-navy` — front=/products/ATC1000-front-heather-navy.jpg, back=/products/ATC1000-back-heather-navy.jpg
- `kelly_012017` — front=/products/ATC1000-front-kelly_012017.jpg, back=/products/ATC1000-back-kelly_012017.jpg
- `laurel_green_cil` — front=/products/ATC1000-front-laurel_green_cil.jpg, back=/products/ATC1000-back-laurel_green_cil.jpg
- `lavender_cil` — front=/products/ATC1000-front-lavender_cil.jpg, back=/products/ATC1000-back-lavender_cil.jpg
- `mediumgrey_112017` — front=/products/ATC1000-front-mediumgrey_112017.jpg, back=/products/ATC1000-back-mediumgrey_112017.jpg
- `military_green_cil` — front=/products/ATC1000-front-military_green_cil.jpg, back=/products/ATC1000-back-military_green_cil.jpg
- `natural_cil` — front=/products/ATC1000-front-natural_cil.jpg, back=/products/ATC1000-back-natural_cil.jpg
- `navy_012017` — front=/products/ATC1000-front-navy_012017.jpg, back=/products/ATC1000-back-navy_012017.jpg
- `neon_blue_cil` — front=/products/ATC1000-front-neon_blue_cil.jpg, back=/products/ATC1000-back-neon_blue_cil.jpg
- `neon_green_cil` — front=/products/ATC1000-front-neon_green_cil.jpg, back=/products/ATC1000-back-neon_green_cil.jpg
- `neon_pink_cil` — front=/products/ATC1000-front-neon_pink_cil.jpg, back=/products/ATC1000-back-neon_pink_cil.jpg
- `neon_yellow_cil` — front=/products/ATC1000-front-neon_yellow_cil.jpg, back=/products/ATC1000-back-neon_yellow_cil.jpg
- `neptune_blue_cil` — front=/products/ATC1000-front-neptune_blue_cil.jpg, back=/products/ATC1000-back-neptune_blue_cil.jpg
- `oatmeal_heather_cil` — front=/products/ATC1000-front-oatmeal_heather_cil.jpg, back=/products/ATC1000-back-oatmeal_heather_cil.jpg
- `orange_012017` — back=/products/ATC1000-back-orange_012017.jpg
- `orange_v2_012017` — front=/products/ATC1000-front-orange_v2_012017.jpg
- `pale_blush_cil` — front=/products/ATC1000-front-pale_blush_cil.jpg, back=/products/ATC1000-back-pale_blush_cil.jpg
- `purple_012017` — front=/products/ATC1000-front-purple_012017.jpg, back=/products/ATC1000-back-purple_012017.jpg
- `red_012017` — front=/products/ATC1000-front-red_012017.jpg, back=/products/ATC1000-back-red_012017.jpg
- `safety_green_cil` — front=/products/ATC1000-front-safety_green_cil.jpg, back=/products/ATC1000-back-safety_green_cil.jpg
- `safety_orange_cil` — front=/products/ATC1000-front-safety_orange_cil.jpg, back=/products/ATC1000-back-safety_orange_cil.jpg
- `sangria_012017` — back=/products/ATC1000-back-sangria_012017.jpg
- `sangria_v2_012017` — front=/products/ATC1000-front-sangria_v2_012017.jpg
- `sapphire_012017` — front=/products/ATC1000-front-sapphire_012017.jpg, back=/products/ATC1000-back-sapphire_012017.jpg
- `silver_012017` — back=/products/ATC1000-back-silver_012017.jpg
- `silver_v2_012017` — front=/products/ATC1000-front-silver_v2_012017.jpg
- `teal_cil` — front=/products/ATC1000-front-teal_cil.jpg, back=/products/ATC1000-back-teal_cil.jpg
- `team_purple_cil` — front=/products/ATC1000-front-team_purple_cil.jpg, back=/products/ATC1000-back-team_purple_cil.jpg
- `true_celadon_cil` — front=/products/ATC1000-front-true_celadon_cil.jpg, back=/products/ATC1000-back-true_celadon_cil.jpg
- `true_royal_cil` — front=/products/ATC1000-front-true_royal_cil.jpg, back=/products/ATC1000-back-true_royal_cil.jpg
- `woodland_brown_cil` — front=/products/ATC1000-front-woodland_brown_cil.jpg, back=/products/ATC1000-back-woodland_brown_cil.jpg
- `yellow_012017` — front=/products/ATC1000-front-yellow_012017.jpg, back=/products/ATC1000-back-yellow_012017.jpg

## ATC1000L (atc1000l) — palette: ATC1000_COLORS

- Palette size: **12**, with image: **9**, filtered out: **3**
- COLOR_IMAGES entries for this SKU: **36**

### Colors without images (will be filtered)
- `steel-grey` — "Gris acier" / "Steel Grey"
- `forest-green` — "Vert forêt" / "Forest Green"
- `cardinal` — "Cardinal" / "Cardinal"

### Image entries without matching color (unused keys in COLOR_IMAGES)
- `aquatic-blue` — front=/products/ATC1000L-front-aquatic-blue.jpg, back=/products/ATC1000L-back-aquatic-blue.jpg
- `aquatic_blue_cil` — front=/products/ATC1000L-front-aquatic_blue_cil.jpg, back=/products/ATC1000L-back-aquatic_blue_cil.jpg
- `ash_grey_cil` — front=/products/ATC1000L-front-ash_grey_cil.jpg, back=/products/ATC1000L-back-ash_grey_cil.jpg
- `candy-pink` — front=/products/ATC1000L-front-candy-pink.jpg, back=/products/ATC1000L-back-candy-pink.jpg
- `candy_pink_cil` — front=/products/ATC1000L-front-candy_pink_cil.jpg, back=/products/ATC1000L-back-candy_pink_cil.jpg
- `dark-heather` — front=/products/ATC1000L-front-dark-heather.jpg, back=/products/ATC1000L-back-dark-heather.jpg
- `fatiguegreen_092019` — front=/products/ATC1000L-front-fatiguegreen_092019.jpg, back=/products/ATC1000L-back-fatiguegreen_092019.jpg
- `kelly_012017` — front=/products/ATC1000L-front-kelly_012017.jpg, back=/products/ATC1000L-back-kelly_012017.jpg
- `laurel_gree` — front=/products/ATC1000L-front-laurel_gree.jpg, back=/products/ATC1000L-back-laurel_gree.jpg
- `laurel_green_cil` — front=/products/ATC1000L-front-laurel_green_cil.jpg, back=/products/ATC1000L-back-laurel_green_cil.jpg
- `lavender_cil` — front=/products/ATC1000L-front-lavender_cil.jpg, back=/products/ATC1000L-back-lavender_cil.jpg
- `lightblue_112017` — front=/products/ATC1000L-front-lightblue_112017.jpg, back=/products/ATC1000L-back-lightblue_112017.jpg
- `lime_112017` — front=/products/ATC1000L-front-lime_112017.jpg, back=/products/ATC1000L-back-lime_112017.jpg
- `maroon_012017` — front=/products/ATC1000L-front-maroon_012017.jpg, back=/products/ATC1000L-back-maroon_012017.jpg
- `mediumgrey_112017` — front=/products/ATC1000L-front-mediumgrey_112017.jpg, back=/products/ATC1000L-back-mediumgrey_112017.jpg
- `navy_012017` — front=/products/ATC1000L-front-navy_012017.jpg, back=/products/ATC1000L-back-navy_012017.jpg
- `oatmeal_heather_cil` — front=/products/ATC1000L-front-oatmeal_heather_cil.jpg, back=/products/ATC1000L-back-oatmeal_heather_cil.jpg
- `orange_012017` — front=/products/ATC1000L-front-orange_012017.jpg, back=/products/ATC1000L-back-orange_012017.jpg
- `pale_blush_cil` — front=/products/ATC1000L-front-pale_blush_cil.jpg, back=/products/ATC1000L-back-pale_blush_cil.jpg
- `red_012017` — front=/products/ATC1000L-front-red_012017.jpg, back=/products/ATC1000L-back-red_012017.jpg
- `sangria_012017` — front=/products/ATC1000L-front-sangria_012017.jpg, back=/products/ATC1000L-back-sangria_012017.jpg
- `sapphire_012017` — front=/products/ATC1000L-front-sapphire_012017.jpg, back=/products/ATC1000L-back-sapphire_012017.jpg
- `silver_012017` — front=/products/ATC1000L-front-silver_012017.jpg, back=/products/ATC1000L-back-silver_012017.jpg
- `teal_cil` — front=/products/ATC1000L-front-teal_cil.jpg, back=/products/ATC1000L-back-teal_cil.jpg
- `true_celadon_cil` — front=/products/ATC1000L-front-true_celadon_cil.jpg, back=/products/ATC1000L-back-true_celadon_cil.jpg
- `yellow_012017` — front=/products/ATC1000L-front-yellow_012017.jpg, back=/products/ATC1000L-back-yellow_012017.jpg

## ATC1000Y (atc1000y) — palette: ATC1000_COLORS

- Palette size: **10**, with image: **1**, filtered out: **9**
- COLOR_IMAGES entries for this SKU: **0**

### Colors without images (will be filtered)
- `white` — "Blanc" / "White"
- `navy` — "Marine" / "Navy"
- `athletic-heather` — "Gris sportif chiné" / "Athletic Heather"
- `steel-grey` — "Gris acier" / "Steel Grey"
- `red` — "Rouge" / "Red"
- `true-royal` — "Bleu royal" / "True Royal"
- `forest-green` — "Vert forêt" / "Forest Green"
- `cardinal` — "Cardinal" / "Cardinal"
- `gold` — "Or" / "Gold"

### Image entries without matching color (unused keys in COLOR_IMAGES)
- _(none — every key is reachable through some palette color)_

## WERK250 (werk250) — palette: ATC1000_COLORS

- Palette size: **8**, with image: **4**, filtered out: **4**
- COLOR_IMAGES entries for this SKU: **11**

### Colors without images (will be filtered)
- `steel-grey` — "Gris acier" / "Steel Grey"
- `red` — "Rouge" / "Red"
- `true-royal` — "Bleu royal" / "True Royal"
- `forest-green` — "Vert forêt" / "Forest Green"

### Image entries without matching color (unused keys in COLOR_IMAGES)
- `athletic-grey` — front=/products/WERK250-front-athletic-grey.jpg, back=/products/WERK250-back-athletic-grey.jpg
- `black_cil` — front=/products/WERK250-front-black_cil.jpg, back=/products/WERK250-back-black_cil.jpg
- `caramel_cil` — front=/products/WERK250-front-caramel_cil.jpg, back=/products/WERK250-back-caramel_cil.jpg
- `safety_orange_cil` — front=/products/WERK250-front-safety_orange_cil.jpg, back=/products/WERK250-back-safety_orange_cil.jpg
- `safety_yellow_cil` — front=/products/WERK250-front-safety_yellow_cil.jpg, back=/products/WERK250-back-safety_yellow_cil.jpg
- `sand_cil` — front=/products/WERK250-front-sand_cil.jpg, back=/products/WERK250-back-sand_cil.jpg
- `white_cil` — front=/products/WERK250-front-white_cil.jpg, back=/products/WERK250-back-white_cil.jpg

## ATC1015 (atc1015) — palette: ATC1000_COLORS

- Palette size: **10**, with image: **7**, filtered out: **3**
- COLOR_IMAGES entries for this SKU: **24**

### Colors without images (will be filtered)
- `steel-grey` — "Gris acier" / "Steel Grey"
- `forest-green` — "Vert forêt" / "Forest Green"
- `cardinal` — "Cardinal" / "Cardinal"

### Image entries without matching color (unused keys in COLOR_IMAGES)
- `ash_grey_cil` — front=/products/ATC1015-front-ash_grey_cil.jpg, back=/products/ATC1015-back-ash_grey_cil.jpg
- `athleticheather_012017` — front=/products/ATC1015-front-athleticheather_012017.jpg, back=/products/ATC1015-back-athleticheather_012017.jpg
- `caramel` — front=/products/ATC1015-front-caramel.jpg, back=/products/ATC1015-back-caramel.jpg
- `caramel_cil` — front=/products/ATC1015-front-caramel_cil.jpg, back=/products/ATC1015-back-caramel_cil.jpg
- `darkgreen_022017` — front=/products/ATC1015-front-darkgreen_022017.jpg, back=/products/ATC1015-back-darkgreen_022017.jpg
- `darkheathergrey_012017` — front=/products/ATC1015-front-darkheathergrey_012017.jpg, back=/products/ATC1015-back-darkheathergrey_012017.jpg
- `fatiguegreen_092019` — front=/products/ATC1015-front-fatiguegreen_092019.jpg, back=/products/ATC1015-back-fatiguegreen_092019.jpg
- `heather_navy_cil` — front=/products/ATC1015-front-heather_navy_cil.jpg, back=/products/ATC1015-back-heather_navy_cil.jpg
- `kelly_012017` — front=/products/ATC1015-front-kelly_012017.jpg, back=/products/ATC1015-back-kelly_012017.jpg
- `maroon_012017` — front=/products/ATC1015-front-maroon_012017.jpg, back=/products/ATC1015-back-maroon_012017.jpg
- `navy_012017` — front=/products/ATC1015-front-navy_012017.jpg, back=/products/ATC1015-back-navy_012017.jpg
- `purple_012017` — front=/products/ATC1015-front-purple_012017.jpg, back=/products/ATC1015-back-purple_012017.jpg
- `safety_gree` — front=/products/ATC1015-front-safety_gree.jpg, back=/products/ATC1015-back-safety_gree.jpg
- `safety_green_cil` — front=/products/ATC1015-front-safety_green_cil.jpg, back=/products/ATC1015-back-safety_green_cil.jpg
- `safety_orange_cil` — front=/products/ATC1015-front-safety_orange_cil.jpg, back=/products/ATC1015-back-safety_orange_cil.jpg
- `sangria_012017` — front=/products/ATC1015-front-sangria_012017.jpg
- `sangria_v2_022017` — back=/products/ATC1015-back-sangria_v2_022017.jpg

## S445 (s445) — palette: POLO_S445_COLORS

- Palette size: **10**, with image: **1**, filtered out: **9**
- COLOR_IMAGES entries for this SKU: **29**

### Colors without images (will be filtered)
- `white` — "Blanc" / "White"  _(FR match attempt: "white_021612" (no front); EN match attempt: "white_021612" (no front))_
- `navy` — "Marine" / "Navy"  _(FR match attempt: "truenavy_021612" (no front); EN match attempt: "truenavy_021612" (no front))_
- `steel-grey` — "Gris acier" / "Steel Grey"
- `red` — "Rouge" / "Red"  _(FR match attempt: "truered_021612" (no front); EN match attempt: "truered_021612" (no front))_
- `true-royal` — "Bleu royal" / "True Royal"  _(FR match attempt: "trueroyal_021612" (no front); EN match attempt: "truenavy_021612" (no front))_
- `forest-green` — "Vert forêt" / "Forest Green"
- `gold` — "Or" / "Gold"  _(FR match attempt: "gold_021612" (no front); EN match attempt: "gold_021612" (no front))_
- `charcoal` — "Charbon" / "Charcoal"
- `cardinal` — "Cardinal" / "Cardinal"

### Image entries without matching color (unused keys in COLOR_IMAGES)
- `black_2010` — back=/products/S445-back-black_2010.jpg
- `bluelake_021612` — back=/products/S445-back-bluelake_021612.jpg
- `bluelake_082015` — front=/products/S445-front-bluelake_082015.jpg
- `gold_021612` — back=/products/S445-back-gold_021612.jpg
- `gold_082015` — front=/products/S445-front-gold_082015.jpg
- `greenoasis_032014` — back=/products/S445-back-greenoasis_032014.jpg
- `greenoasis_082015` — front=/products/S445-front-greenoasis_082015.jpg
- `greyconcrete_092015` — front=/products/S445-front-greyconcrete_092015.jpg, back=/products/S445-back-greyconcrete_092015.jpg
- `irongrey_082015` — front=/products/S445-front-irongrey_082015.jpg
- `irongrey_2010` — back=/products/S445-back-irongrey_2010.jpg
- `kellygreen_021612` — back=/products/S445-back-kellygreen_021612.jpg
- `kellygreen_082015` — front=/products/S445-front-kellygreen_082015.jpg
- `orange_082015` — front=/products/S445-front-orange_082015.jpg
- `purple_021612` — back=/products/S445-back-purple_021612.jpg
- `purple_082015` — front=/products/S445-front-purple_082015.jpg
- `safetygreen_webonly` — front=/products/S445-front-safetygreen_webonly.jpg, back=/products/S445-back-safetygreen_webonly.jpg
- `safetyorange_021612` — back=/products/S445-back-safetyorange_021612.jpg
- `safetyorange_webonly` — front=/products/S445-front-safetyorange_webonly.jpg, back=/products/S445-back-safetyorange_webonly.jpg
- `tropicblue_021612` — back=/products/S445-back-tropicblue_021612.jpg
- `tropicblue_082015` — front=/products/S445-front-tropicblue_082015.jpg
- `truenavy_021612` — back=/products/S445-back-truenavy_021612.jpg
- `truenavy_082015` — front=/products/S445-front-truenavy_082015.jpg
- `truered_021612` — back=/products/S445-back-truered_021612.jpg
- `truered_082015` — front=/products/S445-front-truered_082015.jpg
- `trueroyal_021612` — back=/products/S445-back-trueroyal_021612.jpg
- `trueroyal_082015` — front=/products/S445-front-trueroyal_082015.jpg
- `white_021612` — back=/products/S445-back-white_021612.jpg
- `white_082015` — front=/products/S445-front-white_082015.jpg

## L445 (l445) — palette: POLO_S445_COLORS

- Palette size: **10**, with image: **5**, filtered out: **5**
- COLOR_IMAGES entries for this SKU: **31**

### Colors without images (will be filtered)
- `steel-grey` — "Gris acier" / "Steel Grey"
- `forest-green` — "Vert forêt" / "Forest Green"
- `gold` — "Or" / "Gold"  _(FR match attempt: "gold_021612" (no front); EN match attempt: "gold_021612" (no front))_
- `charcoal` — "Charbon" / "Charcoal"
- `cardinal` — "Cardinal" / "Cardinal"

### Image entries without matching color (unused keys in COLOR_IMAGES)
- `black_2010` — back=/products/L445-back-black_2010.jpg
- `bluelake_082015` — front=/products/L445-front-bluelake_082015.jpg
- `bluelake_2010` — back=/products/L445-back-bluelake_2010.jpg
- `gold_021612` — back=/products/L445-back-gold_021612.jpg
- `gold_082015` — front=/products/L445-front-gold_082015.jpg
- `greenoasis_032014` — back=/products/L445-back-greenoasis_032014.jpg
- `greenoasis_082015` — front=/products/L445-front-greenoasis_082015.jpg
- `greyconcrete_092015` — front=/products/L445-front-greyconcrete_092015.jpg, back=/products/L445-back-greyconcrete_092015.jpg
- `irongrey_082015` — front=/products/L445-front-irongrey_082015.jpg
- `irongrey_2010` — back=/products/L445-back-irongrey_2010.jpg
- `kellygreen_021612` — back=/products/L445-back-kellygreen_021612.jpg
- `kellygreen_082015` — front=/products/L445-front-kellygreen_082015.jpg
- `orange_032014` — back=/products/L445-back-orange_032014.jpg
- `orange_082015` — front=/products/L445-front-orange_082015.jpg
- `pinkraspberry_021612` — back=/products/L445-back-pinkraspberry_021612.jpg
- `purple_021612` — back=/products/L445-back-purple_021612.jpg
- `purple_082015` — front=/products/L445-front-purple_082015.jpg
- `safetygreen_021612` — back=/products/L445-back-safetygreen_021612.jpg
- `safetygreen_webonly` — front=/products/L445-front-safetygreen_webonly.jpg
- `safetyorange_021612` — back=/products/L445-back-safetyorange_021612.jpg
- `safetyorange_webonly` — front=/products/L445-front-safetyorange_webonly.jpg
- `tropicblue_021612` — back=/products/L445-back-tropicblue_021612.jpg
- `tropicblue_082015` — front=/products/L445-front-tropicblue_082015.jpg
- `truenavy_2010` — back=/products/L445-back-truenavy_2010.jpg
- `trueroyal_082015` — front=/products/L445-front-trueroyal_082015.jpg
- `white_2010` — back=/products/L445-back-white_2010.jpg

## S445LS (s445ls) — palette: POLO_S445_COLORS

- Palette size: **7**, with image: **4**, filtered out: **3**
- COLOR_IMAGES entries for this SKU: **12**

### Colors without images (will be filtered)
- `steel-grey` — "Gris acier" / "Steel Grey"
- `red` — "Rouge" / "Red"  _(FR match attempt: "truered_032014" (no front); EN match attempt: "truered_032014" (no front))_
- `forest-green` — "Vert forêt" / "Forest Green"

### Image entries without matching color (unused keys in COLOR_IMAGES)
- `black_1` — front=/products/S445LS-front-black_1.jpg
- `black_2013` — back=/products/S445LS-back-black_2013.jpg
- `irongrey_082015` — front=/products/S445LS-front-irongrey_082015.jpg
- `irongrey_2013` — back=/products/S445LS-back-irongrey_2013.jpg
- `truenavy_2013` — back=/products/S445LS-back-truenavy_2013.jpg
- `truered_032014` — back=/products/S445LS-back-truered_032014.jpg
- `truered_082015` — front=/products/S445LS-front-truered_082015.jpg
- `trueroyal_082015` — front=/products/S445LS-front-trueroyal_082015.jpg

## S350 (s350) — palette: POLO_S445_COLORS

- Palette size: **10**, with image: **4**, filtered out: **6**
- COLOR_IMAGES entries for this SKU: **39**

### Colors without images (will be filtered)
- `navy` — "Marine" / "Navy"  _(FR match attempt: "true_navy_2024" (no front); EN match attempt: "true_navy_2024" (no front))_
- `steel-grey` — "Gris acier" / "Steel Grey"
- `true-royal` — "Bleu royal" / "True Royal"  _(FR match attempt: "true_royal_2024" (no front); EN match attempt: "true_navy_2024" (no front))_
- `forest-green` — "Vert forêt" / "Forest Green"  _(FR match attempt: "forest_2024" (no front); EN match attempt: "forest_2024" (no front))_
- `charcoal` — "Charbon" / "Charcoal"  _(FR match attempt: "coal_grey_2024" (no front); EN match attempt: "coal_grey_2024" (no front))_
- `cardinal` — "Cardinal" / "Cardinal"

### Image entries without matching color (unused keys in COLOR_IMAGES)
- `atomicblue_122019` — front=/products/S350-front-atomicblue_122019.jpg
- `black_2024` — back=/products/S350-back-black_2024.jpg
- `carolinablue_012015` — front=/products/S350-front-carolinablue_012015.jpg
- `carolineblue_2024` — back=/products/S350-back-carolineblue_2024.jpg
- `coal_grey_2024` — back=/products/S350-back-coal_grey_2024.jpg
- `coalgrey_012015` — front=/products/S350-front-coalgrey_012015.jpg
- `deep_orange_2024` — back=/products/S350-back-deep_orange_2024.jpg
- `deeporange_012015` — front=/products/S350-front-deeporange_012015.jpg
- `extreme_orange_2024` — back=/products/S350-back-extreme_orange_2024.jpg
- `extreme_pink_2024` — back=/products/S350-back-extreme_pink_2024.jpg
- `extreme_yellow_2024` — back=/products/S350-back-extreme_yellow_2024.jpg
- `extremeorange_webonly` — front=/products/S350-front-extremeorange_webonly.jpg
- `extremepink_webonly` — front=/products/S350-front-extremepink_webonly.jpg
- `extremeyellow_webonly` — front=/products/S350-front-extremeyellow_webonly.jpg
- `forest_2024` — back=/products/S350-back-forest_2024.jpg
- `gold_2024` — back=/products/S350-back-gold_2024.jpg
- `kelly_green_2024` — back=/products/S350-back-kelly_green_2024.jpg
- `kellygreen_012015` — front=/products/S350-front-kellygreen_012015.jpg
- `lime_shock_2024` — back=/products/S350-back-lime_shock_2024.jpg
- `limeshock_012015` — front=/products/S350-front-limeshock_012015.jpg
- `maroon_012015` — front=/products/S350-front-maroon_012015.jpg
- `maroon_2024` — back=/products/S350-back-maroon_2024.jpg
- `purple_012015` — front=/products/S350-front-purple_012015.jpg
- `purple_2024` — back=/products/S350-back-purple_2024.jpg
- `silver_022016` — front=/products/S350-front-silver_022016.jpg
- `silver_2024` — back=/products/S350-back-silver_2024.jpg
- `true_navy_2024` — back=/products/S350-back-true_navy_2024.jpg
- `true_red_2024` — back=/products/S350-back-true_red_2024.jpg
- `true_royal_2024` — back=/products/S350-back-true_royal_2024.jpg
- `truenavy_012015` — front=/products/S350-front-truenavy_012015.jpg
- `truered_012015` — front=/products/S350-front-truered_012015.jpg
- `trueroyal_012015` — front=/products/S350-front-trueroyal_012015.jpg
- `white_2024` — back=/products/S350-back-white_2024.jpg
- `wild_raspberry_2024` — back=/products/S350-back-wild_raspberry_2024.jpg
- `wildraspberry_012015` — front=/products/S350-front-wildraspberry_012015.jpg

## L350 (l350) — palette: POLO_S445_COLORS

- Palette size: **10**, with image: **6**, filtered out: **4**
- COLOR_IMAGES entries for this SKU: **35**

### Colors without images (will be filtered)
- `steel-grey` — "Gris acier" / "Steel Grey"
- `gold` — "Or" / "Gold"  _(FR match attempt: "gold_102014" (no front); EN match attempt: "gold_102014" (no front))_
- `charcoal` — "Charbon" / "Charcoal"
- `cardinal` — "Cardinal" / "Cardinal"

### Image entries without matching color (unused keys in COLOR_IMAGES)
- `black_2013` — back=/products/L350-back-black_2013.jpg
- `carolinablue_102015` — front=/products/L350-front-carolinablue_102015.jpg
- `carolinablue_2013` — back=/products/L350-back-carolinablue_2013.jpg
- `coalgrey_102015` — front=/products/L350-front-coalgrey_102015.jpg
- `coalgrey_2013` — back=/products/L350-back-coalgrey_2013.jpg
- `deeporange_102015` — front=/products/L350-front-deeporange_102015.jpg
- `deeporange_2013` — back=/products/L350-back-deeporange_2013.jpg
- `extremeorange_webonly` — front=/products/L350-front-extremeorange_webonly.jpg
- `extremeorangwebonly` — back=/products/L350-back-extremeorangwebonly.jpg
- `extremepink_webonly` — front=/products/L350-front-extremepink_webonly.jpg, back=/products/L350-back-extremepink_webonly.jpg
- `extremeyellow_webonly` — front=/products/L350-front-extremeyellow_webonly.jpg, back=/products/L350-back-extremeyellow_webonly.jpg
- `forestgreen_2013` — back=/products/L350-back-forestgreen_2013.jpg
- `gold_102014` — back=/products/L350-back-gold_102014.jpg
- `gold_102015` — front=/products/L350-front-gold_102015.jpg
- `kellygreen_102014` — back=/products/L350-back-kellygreen_102014.jpg
- `kellygreen_102015` — front=/products/L350-front-kellygreen_102015.jpg
- `lightpink_2013` — back=/products/L350-back-lightpink_2013.jpg
- `limeshock_102015` — front=/products/L350-front-limeshock_102015.jpg
- `limeshock_2013` — back=/products/L350-back-limeshock_2013.jpg
- `maroon_102015` — front=/products/L350-front-maroon_102015.jpg
- `maroon_2013` — back=/products/L350-back-maroon_2013.jpg
- `purple_102015` — front=/products/L350-front-purple_102015.jpg
- `purple_2013` — back=/products/L350-back-purple_2013.jpg
- `truenavy_2013` — back=/products/L350-back-truenavy_2013.jpg
- `truered_2014` — back=/products/L350-back-truered_2014.jpg
- `trueroyal_2013` — back=/products/L350-back-trueroyal_2013.jpg
- `white_2013` — back=/products/L350-back-white_2013.jpg
- `wildraspberry_102015` — front=/products/L350-front-wildraspberry_102015.jpg
- `wildraspberry_2013` — back=/products/L350-back-wildraspberry_2013.jpg

## Y350 (y350) — palette: POLO_S445_COLORS

- Palette size: **7**, with image: **6**, filtered out: **1**
- COLOR_IMAGES entries for this SKU: **37**

### Colors without images (will be filtered)
- `steel-grey` — "Gris acier" / "Steel Grey"

### Image entries without matching color (unused keys in COLOR_IMAGES)
- `atomicblue_122019` — front=/products/Y350-front-atomicblue_122019.jpg, back=/products/Y350-back-atomicblue_122019.jpg
- `black_2013` — back=/products/Y350-back-black_2013.jpg
- `carolinablue_082015` — front=/products/Y350-front-carolinablue_082015.jpg
- `carolinablue_2013` — back=/products/Y350-back-carolinablue_2013.jpg
- `coalgrey_082015` — front=/products/Y350-front-coalgrey_082015.jpg
- `coalgrey_2013` — back=/products/Y350-back-coalgrey_2013.jpg
- `deeporange_082015` — front=/products/Y350-front-deeporange_082015.jpg
- `deeporange_2013` — back=/products/Y350-back-deeporange_2013.jpg
- `extremeorange_webonly` — front=/products/Y350-front-extremeorange_webonly.jpg
- `extremeorangwebonly` — back=/products/Y350-back-extremeorangwebonly.jpg
- `extremepink_webonly` — front=/products/Y350-front-extremepink_webonly.jpg, back=/products/Y350-back-extremepink_webonly.jpg
- `extremeyellow_webonly` — front=/products/Y350-front-extremeyellow_webonly.jpg, back=/products/Y350-back-extremeyellow_webonly.jpg
- `forestgreen_2013` — back=/products/Y350-back-forestgreen_2013.jpg
- `gold_082015` — front=/products/Y350-front-gold_082015.jpg
- `gold_102014` — back=/products/Y350-back-gold_102014.jpg
- `kellygreen_082015` — front=/products/Y350-front-kellygreen_082015.jpg
- `kellygreen_102014` — back=/products/Y350-back-kellygreen_102014.jpg
- `lightpink_2013` — back=/products/Y350-back-lightpink_2013.jpg
- `limeshock_082015` — front=/products/Y350-front-limeshock_082015.jpg
- `limeshock_2013` — back=/products/Y350-back-limeshock_2013.jpg
- `maroon_082015` — front=/products/Y350-front-maroon_082015.jpg
- `maroon_2013` — back=/products/Y350-back-maroon_2013.jpg
- `purple_082015` — front=/products/Y350-front-purple_082015.jpg
- `purple_2013` — back=/products/Y350-back-purple_2013.jpg
- `silver_1` — front=/products/Y350-front-silver_1.jpg, back=/products/Y350-back-silver_1.jpg
- `truenavy_2013` — back=/products/Y350-back-truenavy_2013.jpg
- `truered_2014` — back=/products/Y350-back-truered_2014.jpg
- `trueroyal_2013` — back=/products/Y350-back-trueroyal_2013.jpg
- `white_2013` — back=/products/Y350-back-white_2013.jpg
- `wildraspberry_082015` — front=/products/Y350-front-wildraspberry_082015.jpg
- `wildraspberry_2013` — back=/products/Y350-back-wildraspberry_2013.jpg

## ATC6606 (atc6606) — palette: CAP_ATC6606_COLORS

- Palette size: **10**, with image: **4**, filtered out: **6**
- COLOR_IMAGES entries for this SKU: **20**

### Colors without images (will be filtered)
- `black` — "Noir" / "Black"  _(FR match attempt: "black_black" (no front); EN match attempt: "black_black" (no front))_
- `white` — "Blanc" / "White"  _(FR match attempt: "black_white" (no front); EN match attempt: "black_white" (no front))_
- `grey` — "Gris" / "Grey"
- `khaki` — "Kaki" / "Khaki"  _(FR match attempt: "brown_khaki" (no front); EN match attempt: "brown_khaki" (no front))_
- `forest-green` — "Vert forêt" / "Forest Green"
- `black-white` — "Noir/Blanc" / "Black/White"  _(FR match attempt: "black_white" (no front); EN match attempt: "black_black" (no front))_

### Image entries without matching color (unused keys in COLOR_IMAGES)
- `black_black` — back=/products/ATC6606-back-black_black.jpg
- `black_black_cil` — front=/products/ATC6606-front-black_black_cil.jpg, back=/products/ATC6606-back-black_black_cil.jpg
- `black_white` — back=/products/ATC6606-back-black_white.jpg
- `black_white_cil` — front=/products/ATC6606-front-black_white_cil.jpg, back=/products/ATC6606-back-black_white_cil.jpg
- `brown_khaki` — back=/products/ATC6606-back-brown_khaki.jpg
- `brown_khaki_cil` — front=/products/ATC6606-front-brown_khaki_cil.jpg, back=/products/ATC6606-back-brown_khaki_cil.jpg
- `caramel_black_cil` — front=/products/ATC6606-front-caramel_black_cil.jpg, back=/products/ATC6606-back-caramel_black_cil.jpg
- `charcoal_black_cil` — front=/products/ATC6606-front-charcoal_black_cil.jpg, back=/products/ATC6606-back-charcoal_black_cil.jpg
- `charcoal_charcoal_cil` — front=/products/ATC6606-front-charcoal_charcoal_cil.jpg, back=/products/ATC6606-back-charcoal_charcoal_cil.jpg
- `charcoal_white_cil` — front=/products/ATC6606-front-charcoal_white_cil.jpg, back=/products/ATC6606-back-charcoal_white_cil.jpg
- `heather_white_cil` — front=/products/ATC6606-front-heather_white_cil.jpg, back=/products/ATC6606-back-heather_white_cil.jpg
- `multicam_black_black_cil` — front=/products/ATC6606-front-multicam_black_black_cil.jpg, back=/products/ATC6606-back-multicam_black_black_cil.jpg
- `multicam_black_cil` — back=/products/ATC6606-back-multicam_black_cil.jpg
- `navy_silver_cil` — front=/products/ATC6606-front-navy_silver_cil.jpg, back=/products/ATC6606-back-navy_silver_cil.jpg
- `navy_white_cil` — front=/products/ATC6606-front-navy_white_cil.jpg, back=/products/ATC6606-back-navy_white_cil.jpg
- `realtree_edge_brown_cil` — front=/products/ATC6606-front-realtree_edge_brown_cil.jpg, back=/products/ATC6606-back-realtree_edge_brown_cil.jpg
- `white_white_cil` — front=/products/ATC6606-front-white_white_cil.jpg, back=/products/ATC6606-back-white_white_cil.jpg

## 6245CM (6245cm) — palette: CAP_ATC6606_COLORS

- Palette size: **6**, with image: **0**, filtered out: **6**
- COLOR_IMAGES entries for this SKU: **0**

### Colors without images (will be filtered)
- `black` — "Noir" / "Black"
- `white` — "Blanc" / "White"
- `navy` — "Marine" / "Navy"
- `grey` — "Gris" / "Grey"
- `red` — "Rouge" / "Red"
- `true-royal` — "Bleu royal" / "True Royal"

### Image entries without matching color (unused keys in COLOR_IMAGES)
- _(none — every key is reachable through some palette color)_

## ATC6277 (atc6277) — palette: CAP_ATC6606_COLORS

- Palette size: **10**, with image: **8**, filtered out: **2**
- COLOR_IMAGES entries for this SKU: **31**

### Colors without images (will be filtered)
- `true-royal` — "Bleu royal" / "True Royal"  _(FR match attempt: "royal_042014" (no front); EN match attempt: "royal_042014" (no front))_
- `forest-green` — "Vert forêt" / "Forest Green"

### Image entries without matching color (unused keys in COLOR_IMAGES)
- `black_nosticker_042014` — front=/products/ATC6277-front-black_nosticker_042014.jpg
- `darkgrey_nosticker_042014` — front=/products/ATC6277-front-darkgrey_nosticker_042014.jpg
- `darknavy_nosticker_042015` — front=/products/ATC6277-front-darknavy_nosticker_042015.jpg
- `freshgreen_042014` — front=/products/ATC6277-front-freshgreen_042014.jpg, back=/products/ATC6277-back-freshgreen_042014.jpg
- `freshgreen_nosticker_042014` — front=/products/ATC6277-front-freshgreen_nosticker_042014.jpg
- `gold_042014` — front=/products/ATC6277-front-gold_042014.jpg, back=/products/ATC6277-back-gold_042014.jpg
- `gold_nosticker_042014` — front=/products/ATC6277-front-gold_nosticker_042014.jpg
- `grey_042018` — front=/products/ATC6277-front-grey_042018.jpg, back=/products/ATC6277-back-grey_042018.jpg
- `grey_nosticker_042018` — front=/products/ATC6277-front-grey_nosticker_042018.jpg
- `khaki_nosticker_042014` — front=/products/ATC6277-front-khaki_nosticker_042014.jpg
- `maroon_042015` — front=/products/ATC6277-front-maroon_042015.jpg, back=/products/ATC6277-back-maroon_042015.jpg
- `maroon_nosticker_042015` — front=/products/ATC6277-front-maroon_nosticker_042015.jpg
- `navy_nosticker_042014` — front=/products/ATC6277-front-navy_nosticker_042014.jpg
- `purple_042014` — front=/products/ATC6277-front-purple_042014.jpg, back=/products/ATC6277-back-purple_042014.jpg
- `purple_nosticker_042014` — front=/products/ATC6277-front-purple_nosticker_042014.jpg
- `red_nosticker_042016` — front=/products/ATC6277-front-red_nosticker_042016.jpg
- `royal_042014` — back=/products/ATC6277-back-royal_042014.jpg
- `royal_2014` — front=/products/ATC6277-front-royal_2014.jpg
- `royal_nosticker_042014` — front=/products/ATC6277-front-royal_nosticker_042014.jpg
- `silver_042015` — front=/products/ATC6277-front-silver_042015.jpg, back=/products/ATC6277-back-silver_042015.jpg
- `silver_nosticker_042015` — front=/products/ATC6277-front-silver_nosticker_042015.jpg
- `spruce_042015` — front=/products/ATC6277-front-spruce_042015.jpg, back=/products/ATC6277-back-spruce_042015.jpg
- `spruce_nosticker_042015` — front=/products/ATC6277-front-spruce_nosticker_042015.jpg
- `white_nosticker_042014` — front=/products/ATC6277-front-white_nosticker_042014.jpg

## C100 (c100) — palette: BEANIE_C105_COLORS

- Palette size: **9**, with image: **7**, filtered out: **2**
- COLOR_IMAGES entries for this SKU: **26**

### Colors without images (will be filtered)
- `steel-grey` — "Gris acier" / "Steel Grey"
- `forest-green` — "Vert forêt" / "Forest Green"

### Image entries without matching color (unused keys in COLOR_IMAGES)
- `athletic_green_cil` — front=/products/C100-front-athletic_green_cil.jpg
- `athletic_oxford_cil` — front=/products/C100-front-athletic_oxford_cil.jpg
- `black_cil` — front=/products/C100-front-black_cil.jpg
- `black_heather_cil` — front=/products/C100-front-black_heather_cil.jpg
- `camo_cil` — front=/products/C100-front-camo_cil.jpg
- `caramel_cil` — front=/products/C100-front-caramel_cil.jpg
- `concrete_cil` — front=/products/C100-front-concrete_cil.jpg
- `dark_chocolate_brown_cil` — front=/products/C100-front-dark_chocolate_brown_cil.jpg
- `light_blue_cil` — front=/products/C100-front-light_blue_cil.jpg
- `military_green_cil` — front=/products/C100-front-military_green_cil.jpg
- `navy_cil` — front=/products/C100-front-navy_cil.jpg
- `neon_blue_cil` — front=/products/C100-front-neon_blue_cil.jpg
- `neon_lime_cil` — front=/products/C100-front-neon_lime_cil.jpg
- `neon_pink_cil` — front=/products/C100-front-neon_pink_cil.jpg
- `oatmeal_heather_cil` — front=/products/C100-front-oatmeal_heather_cil.jpg
- `orange_cil` — front=/products/C100-front-orange_cil.jpg
- `purple_cil` — front=/products/C100-front-purple_cil.jpg
- `sand_cil` — front=/products/C100-front-sand_cil.jpg
- `white_cil` — front=/products/C100-front-white_cil.jpg

## C105 (c105) — palette: BEANIE_C105_COLORS

- Palette size: **9**, with image: **0**, filtered out: **9**
- COLOR_IMAGES entries for this SKU: **0**

### Colors without images (will be filtered)
- `black` — "Noir" / "Black"
- `white` — "Blanc" / "White"
- `navy` — "Marine" / "Navy"
- `steel-grey` — "Gris acier" / "Steel Grey"
- `red` — "Rouge" / "Red"
- `forest-green` — "Vert forêt" / "Forest Green"
- `maroon` — "Bordeaux" / "Maroon"
- `gold` — "Or" / "Gold"
- `royal` — "Bleu royal" / "Royal"

### Image entries without matching color (unused keys in COLOR_IMAGES)
- _(none — every key is reachable through some palette color)_

## Dead-link paths (referenced in code but missing from public/products/)
- _(none)_

## Orphan files (present in public/products/ but never referenced)
### L445 — 1 orphan file(s)
- `L445-back-2010.jpg`

### S445 — 2 orphan file(s)
- `S445-back-021612.jpg`
- `S445-back-2010.jpg`

## Summary table

| SKU | Palette | With image | Filtered out | Unused COLOR_IMAGES keys |
|-----|---------|-----------:|-------------:|-------------------------:|
| ATCF2500 | 18 | 13 | 5 | 18 |
| ATCY2500 | 10 | 8 | 2 | 13 |
| ATCF2600 | 10 | 8 | 2 | 10 |
| ATCF2400 | 10 | 8 | 2 | 9 |
| ATC1000 | 16 | 13 | 3 | 55 |
| ATC1000L | 12 | 9 | 3 | 26 |
| ATC1000Y | 10 | 1 | 9 | 0 |
| WERK250 | 8 | 4 | 4 | 7 |
| ATC1015 | 10 | 7 | 3 | 17 |
| S445 | 10 | 1 | 9 | 28 |
| L445 | 10 | 5 | 5 | 26 |
| S445LS | 7 | 4 | 3 | 8 |
| S350 | 10 | 4 | 6 | 35 |
| L350 | 10 | 6 | 4 | 29 |
| Y350 | 7 | 6 | 1 | 31 |
| ATC6606 | 10 | 4 | 6 | 17 |
| 6245CM | 6 | 0 | 6 | 0 |
| ATC6277 | 10 | 8 | 2 | 24 |
| C100 | 9 | 7 | 2 | 19 |
| C105 | 9 | 0 | 9 | 0 |
