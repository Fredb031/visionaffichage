/**
 * SanMar Canada PromoStandards — Inventory Service v2.0.0
 *
 * Endpoint: `inventory2.0/InventoryServiceV2.php`
 * PDF reference: "Inventory Service" section.
 *
 * Locations (per PDF):
 *   1 = Vancouver
 *   2 = Mississauga
 *   4 = Calgary
 *
 * The service returns availability per part (color+size SKU), broken down
 * by warehouse location, including any future-dated availability for
 * back-ordered items.
 */

import { soapCall, xmlEscape, getSanmarConfig, unwrapBody, toArray } from './client.ts';

// ── Types ──────────────────────────────────────────────────────────────────

export interface SanmarFutureAvailability {
  qty: number;
  /** ISO date the qty becomes available. */
  availableOn: string;
}

export interface SanmarInventoryLocation {
  locationId: number;
  locationName: string;
  postalCode: string;
  country: string;
  qty: number;
  futureAvailability: SanmarFutureAvailability[];
}

export interface SanmarInventoryPart {
  partId: string;
  color: string;
  size: string;
  /** Sum of qty across all locations. */
  totalQty: number;
  locations: SanmarInventoryLocation[];
}

const LOCATION_NAMES: Record<number, string> = {
  1: 'Vancouver',
  2: 'Mississauga',
  4: 'Calgary',
};

// ── getInventoryLevels ─────────────────────────────────────────────────────

/**
 * Fetch live inventory for every part of a style.
 *
 * @param productId  SanMar style code
 * @returns          One entry per part. `totalQty` is summed across
 *                   locations; `locations[]` preserves the per-warehouse
 *                   breakdown including future availability dates.
 */
export async function getInventoryLevels(productId: string): Promise<SanmarInventoryPart[]> {
  const { id, password } = getSanmarConfig();

  const body = `<GetInventoryLevelsRequest xmlns="http://www.promostandards.org/WSDL/Inventory/2.0.0/">
    <wsVersion>2.0.0</wsVersion>
    <id>${xmlEscape(id)}</id>
    <password>${xmlEscape(password)}</password>
    <productId>${xmlEscape(productId)}</productId>
  </GetInventoryLevelsRequest>`;

  return soapCall<SanmarInventoryPart[]>({
    endpoint: 'inventory2.0/InventoryServiceV2.php',
    body,
    parseResult: (parsed) => {
      const body = unwrapBody(parsed);
      const resp = (body.GetInventoryLevelsResponse ?? body) as Record<string, unknown>;
      const inventory = (resp.Inventory ?? resp.inventory ?? resp) as Record<string, unknown>;

      const partArray = (inventory.PartInventoryArray ??
        inventory.partInventoryArray) as Record<string, unknown> | undefined;
      const partNodes = partArray
        ? toArray(
            (partArray.PartInventory ?? partArray.partInventory) as
              | Record<string, unknown>
              | Record<string, unknown>[],
          )
        : [];

      return partNodes.map((p) => {
        const partId = String(p.partId ?? '');
        const color = String(p.partColor ?? p.colorName ?? '');
        const size = String(p.labelSize ?? p.size ?? '');

        // Per-location breakdown
        const locArray = (p.InventoryLocationArray ??
          p.inventoryLocationArray) as Record<string, unknown> | undefined;
        const locNodes = locArray
          ? toArray(
              (locArray.InventoryLocation ?? locArray.inventoryLocation) as
                | Record<string, unknown>
                | Record<string, unknown>[],
            )
          : [];

        const locations: SanmarInventoryLocation[] = locNodes.map((l) => {
          const locId = parseInt(String(l.inventoryLocationId ?? '0'), 10) || 0;
          const qtyContainer = (l.inventoryLocationQuantity ??
            l.InventoryLocationQuantity) as Record<string, unknown> | undefined;
          const qty = parseInt(String(qtyContainer?.Quantity ?? qtyContainer?.value ?? '0'), 10) || 0;

          const addr = (l.address ?? l.Address) as Record<string, unknown> | undefined;
          const postalCode = String(addr?.postalCode ?? '');
          const country = String(addr?.country ?? 'CA');

          const futureContainer = (l.futureAvailabilityArray ??
            l.FutureAvailabilityArray) as Record<string, unknown> | undefined;
          const futureNodes = futureContainer
            ? toArray(
                (futureContainer.FutureAvailability ?? futureContainer.futureAvailability) as
                  | Record<string, unknown>
                  | Record<string, unknown>[],
              )
            : [];
          const futureAvailability: SanmarFutureAvailability[] = futureNodes.map((f) => {
            const fQtyContainer = (f.Quantity ?? f.quantity) as Record<string, unknown> | undefined;
            const fQty = parseInt(
              String(fQtyContainer?.value ?? fQtyContainer?.Quantity ?? f.quantity ?? '0'),
              10,
            ) || 0;
            return {
              qty: fQty,
              availableOn: String(f.availableOn ?? f.AvailableOn ?? ''),
            };
          });

          return {
            locationId: locId,
            locationName:
              String(l.inventoryLocationName ?? '') || LOCATION_NAMES[locId] || `Location ${locId}`,
            postalCode,
            country,
            qty,
            futureAvailability,
          };
        });

        // Sum location quantities into totalQty (overrides any aggregate
        // that the service might emit at the part level — the per-location
        // sum is the source of truth for what we can ship).
        const totalQty = locations.reduce((sum, loc) => sum + loc.qty, 0);

        return { partId, color, size, totalQty, locations };
      });
    },
  });
}
