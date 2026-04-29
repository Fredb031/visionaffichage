/**
 * SanMar Canada PromoStandards — Media Content Service v1.1.0
 *
 * Endpoint: `mediacontent1.1/MediaContentService.php`
 * PDF reference: "Media Content Service" section.
 *
 * IMPORTANT: This service authenticates with `SANMAR_MEDIA_PASSWORD`,
 * which is a SEPARATE credential from the main login email used by
 * Product/Inventory/Pricing/Order services. Operators must request
 * the media password from SanMar's EDI team — see README operator
 * action queue.
 *
 * Quirk: Multiple image URLs come back newline-separated INSIDE a single
 * `<url>` tag (rather than as repeated `<url>` elements). We split on
 * `\n` and trim. The `<description>` field is also overloaded — it
 * contains "Product Name = X\nProduct Description = Y" (or the French
 * "Nom du produit = ...\nDescription du produit = ..." equivalent),
 * which we parse out into structured fields.
 */

import { soapCall, xmlEscape, getSanmarConfig, unwrapBody, toArray } from './client.ts';

// ── Types ──────────────────────────────────────────────────────────────────

export interface SanmarMediaContent {
  productId: string;
  partId?: string;
  /** All image URLs, in the order SanMar returned them. First is usually
   * the primary catalog image. */
  urls: string[];
  /** Raw `<description>` text — kept for debugging. */
  description: string;
  /** Extracted from the description's "Product Name =" line (en or fr). */
  productName: string;
  /** Extracted from the description's "Product Description =" line. */
  productDescription: string;
  /** ISO timestamp of last media change — useful for cache busting. */
  changeTimeStamp: string;
}

// ── Description parser ────────────────────────────────────────────────────

/** Parse the overloaded `<description>` field. Handles both English and
 * French label variants emitted by the bilingual SanMar Canada service. */
function parseMediaDescription(desc: string): {
  productName: string;
  productDescription: string;
} {
  const out = { productName: '', productDescription: '' };
  if (!desc) return out;
  // Patterns SanMar uses (case-insensitive):
  //   Product Name = ...
  //   Nom du produit = ...
  //   Product Description = ...
  //   Description du produit = ...
  const nameMatch = desc.match(/(?:Product Name|Nom du produit)\s*=\s*([^\n\r]*)/i);
  const descMatch = desc.match(/(?:Product Description|Description du produit)\s*=\s*([\s\S]*?)(?=\n\s*(?:Product\s|Nom du|Description du)|$)/i);
  if (nameMatch) out.productName = nameMatch[1].trim();
  if (descMatch) out.productDescription = descMatch[1].trim();
  return out;
}

// ── getProductImages ───────────────────────────────────────────────────────

/**
 * Fetch image URLs and metadata for a style or part.
 *
 * @param productId  SanMar style code
 * @param partId     Optional — narrows to a single SKU
 */
export async function getProductImages(
  productId: string,
  partId?: string,
): Promise<SanmarMediaContent> {
  const { id, mediaPassword } = getSanmarConfig();

  // Note: PromoStandards Media 1.1 puts most fields in the SharedObjects
  // namespace. fast-xml-parser strips prefixes for us, but the request
  // envelope still needs them spelled out for the gateway to validate.
  const body = `<GetMediaContentRequest xmlns="http://www.promostandards.org/WSDL/MediaService/1.0.0/" xmlns:shar="http://www.promostandards.org/WSDL/MediaService/1.0.0/SharedObjects/">
    <shar:wsVersion>1.1.0</shar:wsVersion>
    <shar:id>${xmlEscape(id)}</shar:id>
    <shar:password>${xmlEscape(mediaPassword)}</shar:password>
    <shar:cultureName>en-US</shar:cultureName>
    <shar:mediaType>Image</shar:mediaType>
    <shar:productId>${xmlEscape(productId)}</shar:productId>
    ${partId ? `<shar:partId>${xmlEscape(partId)}</shar:partId>` : ''}
    <shar:classType>1006</shar:classType>
  </GetMediaContentRequest>`;

  return soapCall<SanmarMediaContent>({
    endpoint: 'mediacontent1.1/MediaContentService.php',
    body,
    parseResult: (parsed) => {
      const body = unwrapBody(parsed);
      const resp = (body.GetMediaContentResponse ?? body) as Record<string, unknown>;

      const arrContainer = (resp.MediaContentArray ?? resp.mediaContentArray ?? resp) as Record<
        string,
        unknown
      >;
      const items = toArray(
        (arrContainer.MediaContent ?? arrContainer.mediaContent) as
          | Record<string, unknown>
          | Record<string, unknown>[],
      );

      // SanMar collapses all image URLs into a single <url> tag separated
      // by newlines on most styles. Combine all <url> values from all
      // MediaContent nodes and split.
      const allUrls: string[] = [];
      let description = '';
      let changeTimeStamp = '';
      let returnedPartId: string | undefined = partId;

      for (const m of items) {
        const rawUrl = String(m.url ?? '');
        if (rawUrl) {
          for (const u of rawUrl.split(/\r?\n/)) {
            const trimmed = u.trim();
            if (trimmed) allUrls.push(trimmed);
          }
        }
        if (!description && m.description) description = String(m.description);
        if (!changeTimeStamp && m.changeTimeStamp) changeTimeStamp = String(m.changeTimeStamp);
        if (!returnedPartId && m.partId) returnedPartId = String(m.partId);
      }

      const { productName, productDescription } = parseMediaDescription(description);

      return {
        productId,
        partId: returnedPartId,
        urls: allUrls,
        description,
        productName,
        productDescription,
        changeTimeStamp,
      };
    },
  });
}
