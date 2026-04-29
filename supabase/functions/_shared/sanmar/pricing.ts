/**
 * SanMar Canada PromoStandards — Pricing & Configuration Service v1.0.0
 *
 * Endpoint: `productpricingconfiguration/PricingAndConfigurationService.php`
 * PDF reference: "Pricing and Configuration Service" section.
 *
 * Returns tier pricing rows (price + minQuantity breakpoints) for each
 * part of a style. SanMar Canada always quotes in CAD with priceType=
 * CUSTOMER (the negotiated customer rate, not list).
 */

import { soapCall, xmlEscape, getSanmarConfig, unwrapBody, toArray } from './client.ts';

// ── Types ──────────────────────────────────────────────────────────────────

export interface SanmarPricingRow {
  partId: string;
  /** Minimum order quantity at which this price applies (tier breakpoint). */
  minQuantity: number;
  /** Price per UoM in `currency`. */
  price: number;
  /** Unit of measure (typically "EA"). */
  priceUom: string;
  /** ISO 4217 — always "CAD" for SanMar Canada. */
  currency: string;
  priceEffectiveDate: string;
  priceExpiryDate?: string;
  /** Warehouse location IDs at which this price applies. */
  fobLocations: number[];
}

// ── getPricing ─────────────────────────────────────────────────────────────

/**
 * Fetch tier pricing for a style (or a single part if `partId` is given).
 *
 * @param productId  SanMar style code
 * @param partId     Optional. If omitted, returns pricing for all parts.
 */
export async function getPricing(
  productId: string,
  partId?: string,
): Promise<SanmarPricingRow[]> {
  const { id, password } = getSanmarConfig();

  const body = `<GetConfigurationAndPricingRequest xmlns="http://www.promostandards.org/WSDL/PricingAndConfiguration/1.0.0/">
    <wsVersion>1.0.0</wsVersion>
    <id>${xmlEscape(id)}</id>
    <password>${xmlEscape(password)}</password>
    <productId>${xmlEscape(productId)}</productId>
    ${partId ? `<partId>${xmlEscape(partId)}</partId>` : ''}
    <currency>CAD</currency>
    <priceType>Customer</priceType>
    <localizationCountry>CA</localizationCountry>
    <localizationLanguage>EN</localizationLanguage>
    <configurationType>Blank</configurationType>
  </GetConfigurationAndPricingRequest>`;

  return soapCall<SanmarPricingRow[]>({
    endpoint: 'productpricingconfiguration/PricingAndConfigurationService.php',
    body,
    parseResult: (parsed) => {
      const body = unwrapBody(parsed);
      const resp = (body.GetConfigurationAndPricingResponse ?? body) as Record<string, unknown>;
      const config = (resp.Configuration ?? resp.configuration ?? resp) as Record<
        string,
        unknown
      >;

      const partArray = (config.PartArray ?? config.partArray) as
        | Record<string, unknown>
        | undefined;
      const partNodes = partArray
        ? toArray((partArray.Part ?? partArray.part) as Record<string, unknown> | Record<string, unknown>[])
        : [];

      const rows: SanmarPricingRow[] = [];
      for (const p of partNodes) {
        const pid = String(p.partId ?? '');
        const priceArrayContainer = (p.PartPriceArray ?? p.partPriceArray) as
          | Record<string, unknown>
          | undefined;
        const priceNodes = priceArrayContainer
          ? toArray(
              (priceArrayContainer.PartPrice ?? priceArrayContainer.partPrice) as
                | Record<string, unknown>
                | Record<string, unknown>[],
            )
          : [];

        for (const pp of priceNodes) {
          const fobContainer = (pp.FobPointArray ?? pp.fobPointArray) as
            | Record<string, unknown>
            | undefined;
          const fobNodes = fobContainer
            ? toArray(
                (fobContainer.FobPoint ?? fobContainer.fobPoint) as
                  | Record<string, unknown>
                  | Record<string, unknown>[],
              )
            : [];
          const fobLocations = fobNodes
            .map((f) => parseInt(String(f.fobId ?? '0'), 10))
            .filter((n) => !Number.isNaN(n) && n > 0);

          rows.push({
            partId: pid,
            minQuantity: parseInt(String(pp.minQuantity ?? '1'), 10) || 1,
            price: parseFloat(String(pp.price ?? '0')) || 0,
            priceUom: String(pp.priceUom ?? 'EA'),
            currency: String(pp.currency ?? 'CAD'),
            priceEffectiveDate: String(pp.priceEffectiveDate ?? ''),
            priceExpiryDate: pp.priceExpiryDate ? String(pp.priceExpiryDate) : undefined,
            fobLocations,
          });
        }
      }
      return rows;
    },
  });
}
