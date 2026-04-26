// Mega Blueprint Section 01 — tiered SKU pricing.
//
// Volume-discount tiers per SKU. The brief gives explicit tiers for two
// representative t-shirt SKUs (ATC1000 budget tee, ATCF2500 hoodie). The
// remaining 16 SKUs in src/data/products.ts derive proportionally from
// those baselines based on category:
//
//   tshirt / longsleeve  → ATC1000 baseline
//   hoodie / crewneck    → ATCF2500-class (≈ +70% over tee)
//   polo / sport         → polo-class    (≈ +30% over tee)
//   jacket               → jacket-class  (≈ 3× tee — none in catalog yet
//                          but the multiplier sits ready for the next
//                          product expansion)
//   cap / toque          → cap-class     (≈ 50% of tee)
//
// Pricing curve: each tier's price-per-unit is the SKU's base unit cost
// scaled by a fixed discount ladder shared across categories — buying 12
// pays full whack, 50+ knocks ~12% off, 100+ ~22%, 250+ ~30%, 500+ ~37%,
// 1000+ ~43%. That keeps the volume story consistent across the catalog
// (cap or hoodie, the discount ramp reads the same) while letting each
// SKU's absolute price reflect its true production cost.
//
// getPricePerUnit() walks the tiers from highest minQty down so the
// largest qualifying tier wins, with a safe fallback to ATC1000 for any
// unknown SKU (defensive — a pricing miss would otherwise crash a PDP).

type Tier = { minQty: number; pricePerUnit: number };

// Shared discount ladder applied to a category's "tier 1" price.
// Index aligns with the minQty ladder below.
const DISCOUNT_LADDER = [1.0, 0.88, 0.78, 0.70, 0.63, 0.57] as const;
const QTY_LADDER = [12, 50, 100, 250, 500, 1000] as const;

function buildTiers(tier1Price: number): Tier[] {
  return QTY_LADDER.map((minQty, i) => ({
    minQty,
    pricePerUnit: Math.round(tier1Price * DISCOUNT_LADDER[i] * 100) / 100,
  }));
}

// Brief baseline anchors. ATC1000 (budget tee) and ATCF2500 (hoodie) are
// quoted directly so the tier shape is stable even if the helper above
// is later swapped for a per-SKU schedule.
const ATC1000_TIERS: Tier[] = [
  { minQty: 12,   pricePerUnit: 8.50 },
  { minQty: 50,   pricePerUnit: 7.50 },
  { minQty: 100,  pricePerUnit: 6.50 },
  { minQty: 250,  pricePerUnit: 5.75 },
  { minQty: 500,  pricePerUnit: 5.25 },
  { minQty: 1000, pricePerUnit: 4.75 },
];

const ATCF2500_TIERS: Tier[] = [
  { minQty: 12,   pricePerUnit: 32.00 },
  { minQty: 50,   pricePerUnit: 28.00 },
  { minQty: 100,  pricePerUnit: 25.00 },
  { minQty: 250,  pricePerUnit: 22.50 },
  { minQty: 500,  pricePerUnit: 20.50 },
  { minQty: 1000, pricePerUnit: 18.50 },
];

// Category-level baselines (tier-1 / 12-unit price). Other tiers scale
// off these via DISCOUNT_LADDER inside buildTiers().
const TEE_TIER1 = 8.50;          // ATC1000 baseline
const HOODIE_TIER1 = 32.00;      // ATCF2500 baseline (+~70% over tee — heavyweight fleece)
const CREWNECK_TIER1 = 22.00;    // crewneck fleece, lighter than full hoodie
const LONGSLEEVE_TIER1 = 14.00;  // tee + sleeve cost
const POLO_TIER1 = 18.00;        // tee +~30% (collar, buttons, knit)
const POLO_LS_TIER1 = 22.00;     // long-sleeve polo — collar + sleeve
const SPORT_TIER1 = 12.00;       // performance tee, slightly above basic tee
const CAP_TIER1 = 14.00;         // structured cap (~75% of tee — closer to streetwear caps)
const CAP_PREMIUM_TIER1 = 18.00; // performance/snapback (ATC6277-class)
const TOQUE_TIER1 = 8.00;        // knit beanie (≈ 50% of tee — minimal material)
const TOQUE_PREMIUM_TIER1 = 11.00;

export const PRICING: Record<string, Tier[]> = {
  // --- T-shirts ---
  ATC1000:   ATC1000_TIERS,
  ATC1000L:  buildTiers(TEE_TIER1 + 0.50),   // women's cut, slight premium
  ATC1000Y:  buildTiers(TEE_TIER1 - 0.75),   // youth — less fabric
  WERK250:   buildTiers(TEE_TIER1 + 4.50),   // heavyweight workwear tee
  ATC1015:   buildTiers(LONGSLEEVE_TIER1),

  // --- Hoodies / crewnecks ---
  ATCF2500:  ATCF2500_TIERS,
  ATCY2500:  buildTiers(HOODIE_TIER1 - 8.00), // youth hoodie
  ATCF2600:  buildTiers(HOODIE_TIER1 + 4.00), // premium hoodie
  ATCF2400:  buildTiers(CREWNECK_TIER1),

  // --- Polos ---
  S445:      buildTiers(POLO_TIER1),
  L445:      buildTiers(POLO_TIER1),
  S445LS:    buildTiers(POLO_LS_TIER1),

  // --- Sport / performance ---
  S350:      buildTiers(SPORT_TIER1),
  L350:      buildTiers(SPORT_TIER1),
  Y350:      buildTiers(SPORT_TIER1 - 1.50),  // youth performance

  // --- Caps ---
  ATC6606:   buildTiers(CAP_TIER1),
  '6245CM':  buildTiers(CAP_TIER1),
  ATC6277:   buildTiers(CAP_PREMIUM_TIER1),

  // --- Toques ---
  C100:      buildTiers(TOQUE_TIER1),
  C105:      buildTiers(TOQUE_PREMIUM_TIER1),
};

/**
 * Resolve the per-unit price for a SKU at a given quantity.
 * Walks tiers high-to-low so the largest qualifying minQty wins. Falls
 * back to ATC1000's tiers for unknown SKUs (defensive — a miss here
 * would otherwise crash a PDP). Below tier 1 the lowest tier's price
 * applies (we don't sell <12 below MOQ in volume mode anyway).
 */
export function getPricePerUnit(sku: string, qty: number): number {
  const tiers = PRICING[sku] ?? PRICING['ATC1000'];
  const tier = [...tiers].reverse().find(t => qty >= t.minQty);
  return tier?.pricePerUnit ?? tiers[0].pricePerUnit;
}
