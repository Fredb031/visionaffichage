/**
 * SanMar Canada PromoStandards — Purchase Order Service v1.0.0 +
 *                                 Order Status Service v1.0.0
 *
 * Endpoints:
 *   `purchaseorder/POService.php`
 *   `orderstatus/OrderStatusService.php`
 *
 * PDF references: "Purchase Order Service" and "Order Status Service".
 *
 * Validation rules enforced here (per the PDF):
 *   - Ship-to companyName must NOT contain any of: @_!#$%^&*()<>/\|~[]{}":'?
 *     (SanMar rejects with code 210). We pre-validate and throw locally.
 *   - Postal codes are validated client-side: Canadian A1A 1A1, US 12345 or 12345-6789.
 *   - All user-provided strings are XML-escaped via `xmlEscape()`.
 *   - Order Status `queryType=3` is NOT supported by SanMar Canada — we throw.
 */

import { soapCall, xmlEscape, formatIsoDate, getSanmarConfig, unwrapBody, toArray, SanmarApiError } from './client.ts';

// ── Order types ────────────────────────────────────────────────────────────

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
  /** Warehouse to pick from. 1=Vancouver, 2=Mississauga, 4=Calgary. */
  locationId?: 1 | 2 | 4;
}

export interface SanmarLineItem {
  lineNumber: string;
  description?: string;
  quantity: number;
  unitPrice: number;
  /** Encoded part identifier — typically `STYLE-COLOR-SIZE` per PDF. */
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
  /** 0 = failure, non-zero = SanMar's transaction reference. Always
   * inspect `serviceMessages` even on non-zero IDs in case warnings were
   * emitted. */
  transactionId: number;
  serviceMessages: Array<{
    code: string | number;
    description: string;
    severity: string;
  }>;
}

// ── Validation ─────────────────────────────────────────────────────────────

/** Characters SanMar rejects in `companyName` (per PDF page on PO submit). */
const FORBIDDEN_COMPANY_CHARS = /[@_!#$%^&*()<>/\\|~\[\]{}":'?]/;

const CA_POSTAL = /^[A-Za-z]\d[A-Za-z][ ]?\d[A-Za-z]\d$/;
const US_POSTAL = /^\d{5}([- ]\d{4})?$/;

function validateOrderInput(order: SanmarOrderInput): void {
  if (FORBIDDEN_COMPANY_CHARS.test(order.shipContact.companyName)) {
    throw new SanmarApiError(
      210,
      `Ship-to companyName contains forbidden character. Disallowed: @_!#$%^&*()<>/\\|~[]{}":'?`,
      'Error',
    );
  }
  const postal = order.shipContact.postalCode.trim();
  const re = order.shipContact.country === 'CA' ? CA_POSTAL : US_POSTAL;
  if (!re.test(postal)) {
    throw new SanmarApiError(
      210,
      `Invalid postal code "${postal}" for country ${order.shipContact.country}`,
      'Error',
    );
  }
  if (!order.lineItems.length) {
    throw new SanmarApiError(140, 'Order must contain at least one line item', 'Error');
  }
  if (order.thirdPartyContact && FORBIDDEN_COMPANY_CHARS.test(order.thirdPartyContact.companyName)) {
    throw new SanmarApiError(
      210,
      `Third-party companyName contains forbidden character`,
      'Error',
    );
  }
}

// ── XML builders ───────────────────────────────────────────────────────────

function buildOrderContact(c: SanmarOrderContact): string {
  return `<OrderContact>
    <attentionTo>${xmlEscape(c.attentionTo)}</attentionTo>
    <email>${xmlEscape(c.email)}</email>
  </OrderContact>`;
}

function buildShipContact(c: SanmarShipContact): string {
  return `<ShipContact>
    <companyName>${xmlEscape(c.companyName)}</companyName>
    <address1>${xmlEscape(c.address1)}</address1>
    ${c.address2 ? `<address2>${xmlEscape(c.address2)}</address2>` : ''}
    <city>${xmlEscape(c.city)}</city>
    <region>${xmlEscape(c.region)}</region>
    <postalCode>${xmlEscape(c.postalCode)}</postalCode>
    <country>${xmlEscape(c.country)}</country>
    ${c.comments ? `<comments>${xmlEscape(c.comments)}</comments>` : ''}
  </ShipContact>`;
}

function buildThirdParty(t: SanmarThirdPartyContact): string {
  return `<ThirdPartyContact>
    <accountNumber>${xmlEscape(t.accountNumber)}</accountNumber>
    <carrier>${xmlEscape(t.carrier)}</carrier>
    ${t.attentionTo ? `<attentionTo>${xmlEscape(t.attentionTo)}</attentionTo>` : ''}
    ${t.email ? `<email>${xmlEscape(t.email)}</email>` : ''}
    <companyName>${xmlEscape(t.companyName)}</companyName>
    <address1>${xmlEscape(t.address1)}</address1>
    ${t.address2 ? `<address2>${xmlEscape(t.address2)}</address2>` : ''}
    <city>${xmlEscape(t.city)}</city>
    <region>${xmlEscape(t.region)}</region>
    <postalCode>${xmlEscape(t.postalCode)}</postalCode>
    <country>${xmlEscape(t.country)}</country>
  </ThirdPartyContact>`;
}

function buildShipment(s: SanmarShipment): string {
  return `<Shipment>
    <allowConsolidation>false</allowConsolidation>
    <blindShip>false</blindShip>
    <packingListRequired>false</packingListRequired>
    <carrier>${xmlEscape(s.carrier)}</carrier>
    ${s.service ? `<service>${xmlEscape(s.service)}</service>` : ''}
    ${s.customerPickup !== undefined ? `<customerPickup>${s.customerPickup}</customerPickup>` : ''}
    ${s.locationId ? `<locationId>${s.locationId}</locationId>` : ''}
  </Shipment>`;
}

function buildLineItem(li: SanmarLineItem): string {
  return `<LineItem>
    <lineNumber>${xmlEscape(li.lineNumber)}</lineNumber>
    ${li.description ? `<description>${xmlEscape(li.description)}</description>` : ''}
    <quantity>${Number(li.quantity)}</quantity>
    <unitPrice>${Number(li.unitPrice)}</unitPrice>
    <productId>${xmlEscape(li.productId)}</productId>
  </LineItem>`;
}

// ── submitOrder ────────────────────────────────────────────────────────────

/**
 * Submit a Configured or Sample purchase order to SanMar Canada.
 *
 * Returns `{ transactionId, serviceMessages }`. A transactionId of 0
 * indicates the order was rejected — inspect `serviceMessages` for the
 * reason. Even on a non-zero id, callers should log any messages with
 * severity != 'Information' for follow-up.
 */
export async function submitOrder(orderData: SanmarOrderInput): Promise<SanmarOrderResult> {
  validateOrderInput(orderData);
  const { id, password } = getSanmarConfig();
  const orderDateIso = formatIsoDate(orderData.orderDate ?? new Date());

  const lineItemsXml = orderData.lineItems.map(buildLineItem).join('');

  const body = `<SubmitPOOrderRequest xmlns="http://www.promostandards.org/WSDL/PromoStandardPOOrder/1.0.0/">
    <wsVersion>1.0.0</wsVersion>
    <id>${xmlEscape(id)}</id>
    <password>${xmlEscape(password)}</password>
    <Order>
      <orderType>${xmlEscape(orderData.orderType)}</orderType>
      <orderNumber>${xmlEscape(orderData.orderNumber)}</orderNumber>
      <orderDate>${orderDateIso}</orderDate>
      <totalAmount>${Number(orderData.totalAmount)}</totalAmount>
      <rush>${orderData.rush ? 'true' : 'false'}</rush>
      <currency>${xmlEscape(orderData.currency)}</currency>
      ${buildOrderContact(orderData.orderContact)}
      ${buildShipContact(orderData.shipContact)}
      ${orderData.thirdPartyContact ? buildThirdParty(orderData.thirdPartyContact) : ''}
      ${buildShipment(orderData.shipment)}
      <LineItemArray>${lineItemsXml}</LineItemArray>
      ${orderData.termsAndConditions ? `<termsAndConditions>${xmlEscape(orderData.termsAndConditions)}</termsAndConditions>` : ''}
      ${orderData.salesChannel ? `<salesChannel>${xmlEscape(orderData.salesChannel)}</salesChannel>` : ''}
    </Order>
  </SubmitPOOrderRequest>`;

  return soapCall<SanmarOrderResult>({
    endpoint: 'purchaseorder/POService.php',
    body,
    parseResult: (parsed) => {
      const bodyParsed = unwrapBody(parsed);
      const resp = (bodyParsed.SubmitPOOrderResponse ?? bodyParsed) as Record<string, unknown>;

      const transactionId = parseInt(String(resp.transactionId ?? '0'), 10) || 0;

      const msgsContainer = (resp.ServiceMessageArray ?? resp.serviceMessageArray) as
        | Record<string, unknown>
        | undefined;
      const msgNodes = msgsContainer
        ? toArray(
            (msgsContainer.ServiceMessage ?? msgsContainer.serviceMessage) as
              | Record<string, unknown>
              | Record<string, unknown>[],
          )
        : [];

      const serviceMessages = msgNodes.map((m) => ({
        code: (m.code as string | number) ?? 'unknown',
        description: String(m.description ?? ''),
        severity: String(m.severity ?? 'Information'),
      }));

      return { transactionId, serviceMessages };
    },
  });
}

// ── Order status ──────────────────────────────────────────────────────────

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

const STATUS_MAP: Record<number, SanmarStatusEnum> = {
  10: 'received',
  11: 'hold-cs',
  41: 'hold-credit',
  44: 'hold-backorder',
  60: 'in-production',
  75: 'partial',
  80: 'complete',
  99: 'cancelled',
};

export function mapStatusId(id: number): SanmarStatusEnum {
  return STATUS_MAP[id] ?? 'unknown';
}

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

/** queryType per PDF:
 *   1 = lookup by Purchase Order number
 *   2 = lookup by Sales Order / Invoice number
 *   3 = NOT supported by SanMar Canada
 *   4 = list all open orders (referenceNumber must be empty)
 */
export type SanmarOrderQueryType = 1 | 2 | 4;

/**
 * Fetch order status. queryType=3 is NOT supported.
 */
export async function getOrderStatus(
  queryType: SanmarOrderQueryType,
  referenceNumber?: string,
): Promise<SanmarOrderStatus[]> {
  if ((queryType as number) === 3) {
    throw new SanmarApiError(140, 'queryType=3 is not supported by SanMar Canada', 'Error');
  }
  if ((queryType === 1 || queryType === 2) && !referenceNumber) {
    throw new SanmarApiError(140, `referenceNumber is required for queryType=${queryType}`, 'Error');
  }
  if (queryType === 4 && referenceNumber) {
    throw new SanmarApiError(
      140,
      'referenceNumber must be empty for queryType=4 (all open orders)',
      'Error',
    );
  }

  const { id, password } = getSanmarConfig();

  const body = `<GetOrderStatusRequest xmlns="http://www.promostandards.org/WSDL/OrderStatusService/1.0.0/">
    <wsVersion>1.0.0</wsVersion>
    <id>${xmlEscape(id)}</id>
    <password>${xmlEscape(password)}</password>
    <queryType>${queryType}</queryType>
    ${referenceNumber ? `<referenceNumber>${xmlEscape(referenceNumber)}</referenceNumber>` : '<referenceNumber></referenceNumber>'}
  </GetOrderStatusRequest>`;

  return soapCall<SanmarOrderStatus[]>({
    endpoint: 'orderstatus/OrderStatusService.php',
    body,
    parseResult: (parsed) => {
      const bodyParsed = unwrapBody(parsed);
      const resp = (bodyParsed.GetOrderStatusResponse ?? bodyParsed) as Record<string, unknown>;

      const arrContainer = (resp.OrderStatusArray ?? resp.orderStatusArray) as
        | Record<string, unknown>
        | undefined;
      const orderNodes = arrContainer
        ? toArray(
            (arrContainer.OrderStatus ?? arrContainer.orderStatus) as
              | Record<string, unknown>
              | Record<string, unknown>[],
          )
        : [];

      return orderNodes.map((o) => {
        const detailContainer = (o.OrderStatusDetailArray ?? o.orderStatusDetailArray) as
          | Record<string, unknown>
          | undefined;
        const detailNodes = detailContainer
          ? toArray(
              (detailContainer.OrderStatusDetail ?? detailContainer.orderStatusDetail) as
                | Record<string, unknown>
                | Record<string, unknown>[],
            )
          : [];

        const orderStatusDetails: SanmarOrderStatusDetail[] = detailNodes.map((d) => {
          const statusId = parseInt(String(d.statusId ?? '0'), 10) || 0;
          return {
            factoryOrderNumber: String(d.factoryOrderNumber ?? ''),
            statusId,
            statusName: mapStatusId(statusId),
            expectedShipDate: String(d.expectedShipDate ?? ''),
            expectedDeliveryDate: String(d.expectedDeliveryDate ?? ''),
            additionalExplanation: String(d.additionalExplanation ?? ''),
            responseRequired:
              String(d.responseRequired ?? 'false').toLowerCase() === 'true',
            validTimestamp: String(d.validTimestamp ?? ''),
          };
        });

        return {
          purchaseOrderNumber: String(o.purchaseOrderNumber ?? ''),
          orderStatusDetails,
        };
      });
    },
  });
}
