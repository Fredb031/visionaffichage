/**
 * Client-side SanMar API wrapper (Step 1 stub).
 *
 * Architecture:
 *
 *   Browser  ──invoke──▶  Supabase Edge Function  ──SOAP──▶  SanMar Canada
 *                          (server-side, IP-whitelisted,
 *                           uses SANMAR_* secrets)
 *
 * The browser NEVER calls SanMar directly because:
 *   1. SanMar requires static-IP whitelisting — see PDF Step 2 of
 *      "Establishing Web Services Access process". Browser IPs are
 *      arbitrary so requests would be blocked.
 *   2. CORS — SanMar's gateway does not set Access-Control-Allow-Origin.
 *   3. Credentials — customerId, password, and mediaPassword would be
 *      bundled into JS source if read with VITE_-prefixed env vars.
 *
 * In Step 1, the actual edge functions are NOT yet deployed. Each method
 * here throws a clear error pointing to the operator action queue. UI
 * code can wire these calls up now and they'll start working as soon as
 * Step 3 ships the matching `/functions/v1/sanmar-*` endpoints.
 */

import { supabase } from '@/lib/supabase';
import type {
  SanmarProduct,
  SanmarSellableEntry,
  SanmarInventoryPart,
  SanmarPricingRow,
  SanmarMediaContent,
  SanmarOrderInput,
  SanmarOrderResult,
  SanmarOrderStatus,
  SanmarOrderQueryType,
} from './types';

const NOT_DEPLOYED_MSG =
  'SanMar edge functions not deployed yet — see operator action queue (supabase/functions/_shared/sanmar/README.md). Step 3 will ship the actual /functions/v1/sanmar-* endpoints.';

/** Names of the edge functions Step 3+ will deploy. Defined as a const
 * so client and infra-as-code stay in sync. */
export const SANMAR_EDGE_FUNCTIONS = [
  'sanmar-products',
  'sanmar-inventory',
  'sanmar-pricing',
  'sanmar-media',
  'sanmar-submit-order',
  'sanmar-order-status',
] as const;

export type SanmarEdgeFunctionName = (typeof SANMAR_EDGE_FUNCTIONS)[number];

/** Whether the new edge-function endpoints have been deployed. Flip this
 * via VITE_SANMAR_NEXT_GEN=true once Step 3 ships. Default false so the
 * stubs throw a clear "not deployed" message during Step 1/2 development. */
const NEXT_GEN_ENABLED = import.meta.env.VITE_SANMAR_NEXT_GEN === 'true';

/** Internal helper that invokes a Supabase edge function via the SDK.
 * Adds a uniform error wrapper so callers see one consistent failure
 * shape no matter which endpoint blew up. */
async function invokeEdge<TRequest extends Record<string, unknown>, TResponse>(
  functionName: SanmarEdgeFunctionName,
  payload: TRequest,
): Promise<TResponse> {
  if (!NEXT_GEN_ENABLED) {
    throw new Error(NOT_DEPLOYED_MSG);
  }
  if (!supabase) {
    throw new Error(
      'Supabase client is not initialized — set VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY in .env',
    );
  }
  const { data, error } = await supabase.functions.invoke(functionName, { body: payload });
  if (error) {
    throw new Error(`SanMar edge function "${functionName}" failed: ${error.message}`);
  }
  if (!data) {
    throw new Error(`SanMar edge function "${functionName}" returned no data`);
  }
  return data as TResponse;
}

// ── Public API (Step 1: stubs that will work transparently after Step 3) ──

export async function getProduct(
  productId: string,
  opts: { partId?: string; localizationLanguage?: 'en' | 'fr' } = {},
): Promise<SanmarProduct> {
  return invokeEdge<{ productId: string; partId?: string; localizationLanguage?: 'en' | 'fr' }, SanmarProduct>(
    'sanmar-products',
    { productId, partId: opts.partId, localizationLanguage: opts.localizationLanguage },
  );
}

export async function getProductSellable(
  productId: 'ACTIVE' | 'ALL' | string,
): Promise<SanmarSellableEntry[]> {
  return invokeEdge<{ action: 'sellable'; productId: string }, SanmarSellableEntry[]>(
    'sanmar-products',
    { action: 'sellable', productId },
  );
}

export async function getInventoryLevels(productId: string): Promise<SanmarInventoryPart[]> {
  return invokeEdge<{ productId: string }, SanmarInventoryPart[]>('sanmar-inventory', { productId });
}

export async function getPricing(
  productId: string,
  partId?: string,
): Promise<SanmarPricingRow[]> {
  return invokeEdge<{ productId: string; partId?: string }, SanmarPricingRow[]>('sanmar-pricing', {
    productId,
    partId,
  });
}

export async function getProductImages(
  productId: string,
  partId?: string,
): Promise<SanmarMediaContent> {
  return invokeEdge<{ productId: string; partId?: string }, SanmarMediaContent>('sanmar-media', {
    productId,
    partId,
  });
}

export async function submitOrder(orderData: SanmarOrderInput): Promise<SanmarOrderResult> {
  return invokeEdge<{ orderData: SanmarOrderInput }, SanmarOrderResult>(
    'sanmar-submit-order',
    { orderData },
  );
}

export async function getOrderStatus(
  queryType: SanmarOrderQueryType,
  referenceNumber?: string,
): Promise<SanmarOrderStatus[]> {
  return invokeEdge<
    { queryType: SanmarOrderQueryType; referenceNumber?: string },
    SanmarOrderStatus[]
  >('sanmar-order-status', { queryType, referenceNumber });
}

/** Bundled namespace export for ergonomic imports:
 *
 *   import { sanmarClient } from '@/lib/sanmar/client';
 *   const product = await sanmarClient.getProduct('ATC1000');
 */
export const sanmarClient = {
  getProduct,
  getProductSellable,
  getInventoryLevels,
  getPricing,
  getProductImages,
  submitOrder,
  getOrderStatus,
};

export type { SanmarEdgeFunctionName as SanmarEdgeFunction };
