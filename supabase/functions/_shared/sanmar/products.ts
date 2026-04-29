/**
 * SanMar Canada PromoStandards — Product Data Service v2.0.0
 *
 * Endpoint: `productdata2.0/ProductDataServiceV2.php`
 * PDF reference: "Product Data Service" section.
 *
 * Auth: SANMAR_CUSTOMER_ID + SANMAR_PASSWORD (the registered EDI email).
 *
 * NOTE: Per the PDF, the following fields are always "NA" or nil for SanMar
 * Canada and are intentionally ignored by these wrappers:
 *   - priceExpiresDate
 *   - hex
 *   - approximatePms
 */

import { soapCall, xmlEscape, getSanmarConfig, unwrapBody, toArray } from './client.ts';

// ── Types ──────────────────────────────────────────────────────────────────

export interface SanmarProductPart {
  partId: string;
  colorName: string;
  size: string;
  countryOfOrigin: string;
}

export interface SanmarProduct {
  productId: string;
  productName: string;
  description: string;
  brand: string;
  category: string;
  parts: SanmarProductPart[];
}

export interface SanmarSellableEntry {
  styleId: string;
  color: string;
  size: string;
  discontinued: boolean;
  /** Original raw `productId` string from SanMar, kept for traceability. */
  raw: string;
}

export interface GetProductOptions {
  /** ISO 3166-1 alpha-2. SanMar Canada always 'CA'. */
  localizationCountry?: string;
  /** ISO 639-1. 'en' or 'fr'. */
  localizationLanguage?: 'en' | 'fr';
  /** Optional partId to fetch a single SKU instead of the full style. */
  partId?: string;
}

// ── getProduct ─────────────────────────────────────────────────────────────

/**
 * Fetch full product metadata + all parts (color/size SKUs) for a style.
 *
 * @param productId  SanMar style code, e.g. "ATC1000"
 * @returns          Normalized product with `parts[]`. Empty parts array
 *                   is valid (some styles have no published variants in UAT).
 */
export async function getProduct(
  productId: string,
  opts: GetProductOptions = {},
): Promise<SanmarProduct> {
  const { id, password } = getSanmarConfig();
  const country = opts.localizationCountry ?? 'CA';
  const language = opts.localizationLanguage ?? 'en';

  const body = `<GetProductRequest xmlns="http://www.promostandards.org/WSDL/ProductDataService/2.0.0/">
    <wsVersion>2.0.0</wsVersion>
    <id>${xmlEscape(id)}</id>
    <password>${xmlEscape(password)}</password>
    <localizationCountry>${xmlEscape(country)}</localizationCountry>
    <localizationLanguage>${xmlEscape(language)}</localizationLanguage>
    <productId>${xmlEscape(productId)}</productId>
    ${opts.partId ? `<partId>${xmlEscape(opts.partId)}</partId>` : ''}
  </GetProductRequest>`;

  return soapCall<SanmarProduct>({
    endpoint: 'productdata2.0/ProductDataServiceV2.php',
    body,
    parseResult: (parsed) => {
      const body = unwrapBody(parsed);
      const resp = (body.GetProductResponse ?? body) as Record<string, unknown>;
      const product = (resp.Product ?? resp.product ?? resp) as Record<string, unknown>;

      const partsContainer = (product.ProductPartArray ??
        product.productPartArray ??
        product.parts) as Record<string, unknown> | undefined;
      const partNodes = partsContainer
        ? toArray(
            (partsContainer.ProductPart ?? partsContainer.productPart) as
              | Record<string, unknown>
              | Record<string, unknown>[],
          )
        : [];

      const parts: SanmarProductPart[] = partNodes.map((p) => {
        const colorObj = (p.ColorArray as Record<string, unknown> | undefined)?.Color as
          | Record<string, unknown>
          | undefined;
        return {
          partId: String(p.partId ?? ''),
          colorName: String(
            (colorObj?.standardColorName as string) ??
              (colorObj?.colorName as string) ??
              (p.colorName as string) ??
              '',
          ),
          size: String(p.labelSize ?? p.size ?? ''),
          countryOfOrigin: String(p.countryOfOrigin ?? ''),
        };
      });

      return {
        productId: String(product.productId ?? productId),
        productName: String(product.productName ?? ''),
        description: String(product.description ?? product.productDescription ?? ''),
        brand: String(product.productBrand ?? product.brand ?? ''),
        category: String(product.category ?? ''),
        parts,
      };
    },
  });
}

// ── getProductSellable ─────────────────────────────────────────────────────

/**
 * Returns lightweight sellable-status entries. Per the PDF the response's
 * `<productId>` field is overloaded to encode style + color + size +
 * discontinued status as a single string of the form:
 *
 *   ATC1000(Black,M,)        ← active
 *   ATC1000(Black,M,C)       ← discontinued (last field non-empty)
 *
 * We parse that string so callers get structured data.
 *
 * @param productId  Use 'ACTIVE' to get all currently sellable parts,
 *                   'ALL' to get every part (incl. discontinued), or a
 *                   real style code to scope to one style.
 */
export async function getProductSellable(productId: string): Promise<SanmarSellableEntry[]> {
  const { id, password } = getSanmarConfig();

  const body = `<GetProductSellableRequest xmlns="http://www.promostandards.org/WSDL/ProductDataService/2.0.0/">
    <wsVersion>2.0.0</wsVersion>
    <id>${xmlEscape(id)}</id>
    <password>${xmlEscape(password)}</password>
    <productId>${xmlEscape(productId)}</productId>
  </GetProductSellableRequest>`;

  return soapCall<SanmarSellableEntry[]>({
    endpoint: 'productdata2.0/ProductDataServiceV2.php',
    body,
    parseResult: (parsed) => {
      const body = unwrapBody(parsed);
      const resp = (body.GetProductSellableResponse ?? body) as Record<string, unknown>;
      const arr = (resp.ProductSellableArray ?? resp.productSellableArray ?? resp) as Record<
        string,
        unknown
      >;
      const items = toArray(
        (arr.ProductSellable ?? arr.productSellable) as
          | Record<string, unknown>
          | Record<string, unknown>[],
      );

      const entries: SanmarSellableEntry[] = [];
      // Pattern: STYLE(COLOR,SIZE,DISCONTINUED_FLAG)
      // The discontinued flag is empty for active parts, "C" (or any
      // non-empty value) for discontinued parts.
      const re = /^([^(]+)\(([^,]*),([^,]*),([^)]*)\)$/;
      for (const item of items) {
        const raw = String(item.productId ?? item.id ?? '');
        if (!raw) continue;
        const m = raw.match(re);
        if (m) {
          entries.push({
            styleId: m[1].trim(),
            color: m[2].trim(),
            size: m[3].trim(),
            discontinued: m[4].trim().length > 0,
            raw,
          });
        } else {
          // Unparseable — keep the raw string so operator can investigate.
          entries.push({
            styleId: raw,
            color: '',
            size: '',
            discontinued: false,
            raw,
          });
        }
      }
      return entries;
    },
  });
}

/**
 * Convenience wrapper around `getProductSellable('ACTIVE')` that filters
 * out discontinued parts and returns a clean shape ready for downstream
 * cataloguing.
 */
export async function getAllActiveParts(): Promise<
  Array<{ styleId: string; color: string; size: string }>
> {
  const all = await getProductSellable('ACTIVE');
  return all
    .filter((p) => !p.discontinued)
    .map(({ styleId, color, size }) => ({ styleId, color, size }));
}
