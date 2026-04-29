/**
 * Shared TypeScript types for the SanMar Canada PromoStandards integration.
 *
 * These types mirror the return shapes of the server-side service modules
 * in `supabase/functions/_shared/sanmar/` so the client (this directory)
 * and server (the edge functions that import the shared modules) speak
 * the exact same shape across the boundary.
 *
 * NO LOGIC, NO SOAP, NO CREDENTIALS. Pure type definitions only.
 *
 * Why duplicate the types here instead of importing from
 * `supabase/functions/_shared/sanmar/`? Because that directory ships as
 * Deno modules with `https://...` import specifiers — including them in
 * the browser tsconfig would break Vite's resolver. Keeping a clean copy
 * in `src/lib/sanmar/types.ts` is the standard supabase-edge / vite
 * pattern.
 */

// ── Product ────────────────────────────────────────────────────────────────

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
  raw: string;
}

// ── Inventory ──────────────────────────────────────────────────────────────

export interface SanmarFutureAvailability {
  qty: number;
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
  totalQty: number;
  locations: SanmarInventoryLocation[];
}

// ── Pricing ────────────────────────────────────────────────────────────────

export interface SanmarPricingRow {
  partId: string;
  minQuantity: number;
  price: number;
  priceUom: string;
  currency: string;
  priceEffectiveDate: string;
  priceExpiryDate?: string;
  fobLocations: number[];
}

// ── Media ──────────────────────────────────────────────────────────────────

export interface SanmarMediaContent {
  productId: string;
  partId?: string;
  urls: string[];
  description: string;
  productName: string;
  productDescription: string;
  changeTimeStamp: string;
}

// ── Orders (input) ────────────────────────────────────────────────────────

export interface SanmarOrderContact {
  attentionTo: string;
  email: string;
}

export interface SanmarShipContact {
  companyName: string;
  address1: string;
  address2?: string;
  city: string;
  region: string;
  postalCode: string;
  country: 'CA' | 'US';
  comments?: string;
}

export interface SanmarThirdPartyContact {
  accountNumber: string;
  carrier: string;
  attentionTo?: string;
  email?: string;
  companyName: string;
  address1: string;
  address2?: string;
  city: string;
  region: string;
  postalCode: string;
  country: 'CA' | 'US';
}

export interface SanmarShipment {
  allowConsolidation: false;
  blindShip: false;
  packingListRequired: false;
  carrier: string;
  service?: string;
  customerPickup?: boolean;
  locationId?: 1 | 2 | 4;
}

export interface SanmarLineItem {
  lineNumber: string;
  description?: string;
  quantity: number;
  unitPrice: number;
  productId: string;
}

export interface SanmarOrderInput {
  orderType: 'Configured' | 'Sample';
  orderNumber: string;
  orderDate?: Date;
  totalAmount: number;
  rush?: boolean;
  currency: 'CAD';
  orderContact: SanmarOrderContact;
  shipContact: SanmarShipContact;
  thirdPartyContact?: SanmarThirdPartyContact;
  shipment: SanmarShipment;
  lineItems: SanmarLineItem[];
  termsAndConditions?: string;
  salesChannel?: string;
}

export interface SanmarOrderResult {
  transactionId: number;
  serviceMessages: Array<{
    code: string | number;
    description: string;
    severity: string;
  }>;
}

// ── Order status ───────────────────────────────────────────────────────────

export type SanmarStatusEnum =
  | 'received'
  | 'hold-cs'
  | 'hold-credit'
  | 'hold-backorder'
  | 'in-production'
  | 'partial'
  | 'complete'
  | 'cancelled'
  | 'unknown';

export type SanmarOrderQueryType = 1 | 2 | 4;

export interface SanmarOrderStatusDetail {
  factoryOrderNumber: string;
  statusId: number;
  statusName: SanmarStatusEnum;
  expectedShipDate: string;
  expectedDeliveryDate: string;
  additionalExplanation: string;
  responseRequired: boolean;
  validTimestamp: string;
}

export interface SanmarOrderStatus {
  purchaseOrderNumber: string;
  orderStatusDetails: SanmarOrderStatusDetail[];
}
