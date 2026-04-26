/**
 * Vision Affichage Volume II — Section 18.1
 *
 * Surface customizer payload to Shopify Admin → Orders via cart
 * attributes. Before this helper, the VA team had no visibility into
 * what was customized on each order — no logo URL, no placement, no
 * print zones — because all that lived in the local cart store and
 * never crossed the wire to Shopify. The cartAttributesUpdate
 * Storefront API mutation attaches arbitrary key/value pairs to the
 * cart; those propagate to the order line in Shopify Admin so the
 * production team finally sees what the customer ordered without a
 * side-channel email.
 *
 * Errors are logged, not thrown — the customizer add-to-cart flow
 * already has its own optimistic UX, and a 402/429/network blip on
 * the attributes call shouldn't roll back a successful cart add.
 * Worst case the order ships missing the attribute trail and the
 * operator falls back to the side-channel they already have.
 */

import { storefrontApiRequest } from '@/lib/shopify';

export const CART_ATTRIBUTES_MUTATION = `
  mutation cartAttributesUpdate($cartId: ID!, $attributes: [AttributeInput!]!) {
    cartAttributesUpdate(cartId: $cartId, attributes: $attributes) {
      cart { id }
      userErrors { field message }
    }
  }
`;

export interface CustomizerAttributesPayload {
  logoUrl?: string;
  placement?: unknown;
  printZones?: string[];
  canvasPreviewUrl?: string;
  productSku?: string;
  sizeMatrix?: Record<string, number>;
}

/** Maps a payload field to a Shopify cart attribute. Strings pass
 * through; everything else is JSON-encoded so structured data
 * (placement objects, size matrices) round-trips cleanly through the
 * AttributeInput.value string field. */
function toAttributeValue(value: unknown): string {
  if (typeof value === 'string') return value;
  return JSON.stringify(value);
}

/**
 * Push customizer payload onto the Shopify cart as cart attributes.
 *
 * Drops undefined/null fields so we don't write empty strings into
 * Shopify Admin (which would clutter the order page with blank
 * rows). Logs and swallows errors — see module docstring for why.
 */
export async function setCustomizerAttributes(
  cartId: string,
  payload: CustomizerAttributesPayload,
): Promise<void> {
  if (!cartId) {
    console.warn('[shopifyCartAttributes] No cartId — skipping attributes update');
    return;
  }

  // Map snake_case keys (the convention Shopify Admin renders nicely)
  // from the camelCase payload, dropping undefined/null. Empty strings
  // and empty arrays/objects are preserved — operator may want to see
  // "printZones: []" to confirm a flat-print order, for instance.
  const fieldMap: Array<[keyof CustomizerAttributesPayload, string]> = [
    ['logoUrl', 'logo_url'],
    ['placement', 'placement'],
    ['printZones', 'print_zones'],
    ['canvasPreviewUrl', 'canvas_preview_url'],
    ['productSku', 'product_sku'],
    ['sizeMatrix', 'size_matrix'],
  ];

  const attributes: Array<{ key: string; value: string }> = [];
  for (const [payloadKey, attrKey] of fieldMap) {
    const raw = payload[payloadKey];
    if (raw === undefined || raw === null) continue;
    attributes.push({ key: attrKey, value: toAttributeValue(raw) });
  }

  if (attributes.length === 0) return;

  try {
    const data = await storefrontApiRequest(CART_ATTRIBUTES_MUTATION, {
      cartId,
      attributes,
    });
    if (!data?.data?.cartAttributesUpdate) {
      // 402 (store plan lapsed) returns undefined from
      // storefrontApiRequest; nothing actionable in the render path.
      console.warn('[shopifyCartAttributes] cartAttributesUpdate returned no data');
      return;
    }
    const userErrors = data.data.cartAttributesUpdate.userErrors || [];
    if (userErrors.length > 0) {
      console.warn('[shopifyCartAttributes] userErrors:', userErrors);
    }
  } catch (err) {
    console.error('[shopifyCartAttributes] Failed to set attributes:', err);
  }
}
