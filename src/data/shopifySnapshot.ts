// Real Shopify data snapshot fetched via Zapier MCP on 2026-04-18.
// To refresh, run: `npm run sync-shopify` (script to be added) — or regenerate
// via Zapier API call and paste here. Long-term: replace with a Supabase
// edge function that calls Shopify Admin API live.

export interface ShopifyOrderSnapshot {
  id: number;
  name: string;
  total: number;
  currency: string;
  createdAt: string;
  email: string;
  customerName: string;
  financialStatus: 'pending' | 'paid' | 'refunded' | 'partially_paid' | 'partially_refunded' | 'voided' | 'authorized' | null;
  fulfillmentStatus: 'fulfilled' | 'partial' | 'restocked' | null;
  itemsCount: number;
}

export const SHOPIFY_ORDERS_SNAPSHOT: ShopifyOrderSnapshot[] = [
  { id: 7340967657587, name: '#1570', total: 742.96,  currency: 'CAD', createdAt: '2026-04-17T11:55:01-04:00', email: 'gordonhughes@hotmail.fr',            customerName: 'Gordon Hughes',       financialStatus: 'pending', fulfillmentStatus: null,        itemsCount: 9 },
  { id: 7337444409459, name: '#1569', total: 1209.44, currency: 'CAD', createdAt: '2026-04-16T15:47:55-04:00', email: 'info@vitrexentretiens.ca',            customerName: 'Zack Landy',          financialStatus: 'paid',    fulfillmentStatus: null,        itemsCount: 3 },
  { id: 7336965210227, name: '#1568', total: 199.14,  currency: 'CAD', createdAt: '2026-04-16T13:42:46-04:00', email: 'czesthetique@gmail.com',              customerName: 'Zack Landry',         financialStatus: 'paid',    fulfillmentStatus: null,        itemsCount: 4 },
  { id: 7336649425011, name: '#1567', total: 654.62,  currency: 'CAD', createdAt: '2026-04-16T12:15:41-04:00', email: 'admin@cuisines9999.com',              customerName: 'Fred 9999',           financialStatus: 'pending', fulfillmentStatus: null,        itemsCount: 3 },
  { id: 7333897142387, name: '#1566', total: 235.08,  currency: 'CAD', createdAt: '2026-04-15T20:16:52-04:00', email: 'mario.rivard@outlook.com',            customerName: 'mario rivard',        financialStatus: 'paid',    fulfillmentStatus: null,        itemsCount: 3 },
  { id: 7330005188723, name: '#1565', total: 61.98,   currency: 'CAD', createdAt: '2026-04-14T21:06:09-04:00', email: 'julia-07@live.ca',                    customerName: 'Julia Pietacho',      financialStatus: 'paid',    fulfillmentStatus: null,        itemsCount: 1 },
  { id: 7328741851251, name: '#1564', total: 173.62,  currency: 'CAD', createdAt: '2026-04-14T14:12:51-04:00', email: 'micheldosmalouis72@gmail.com',        customerName: 'Michel Dosm Louis',   financialStatus: 'paid',    fulfillmentStatus: null,        itemsCount: 8 },
  { id: 7324341010547, name: '#1563', total: 156.34,  currency: 'CAD', createdAt: '2026-04-13T12:41:05-04:00', email: 'lfred83@hotmail.com',                 customerName: "Frédérick L'heureux", financialStatus: 'paid',    fulfillmentStatus: null,        itemsCount: 9 },
  { id: 7319620255859, name: '#1562', total: 380.85,  currency: 'CAD', createdAt: '2026-04-12T09:15:57-04:00', email: 'cbf-inc@hotmail.com',                 customerName: 'Emmanuel Blais',      financialStatus: 'paid',    fulfillmentStatus: 'fulfilled', itemsCount: 4 },
  { id: 7307922276467, name: '#1561', total: 0.00,    currency: 'CAD', createdAt: '2026-04-09T12:57:17-04:00', email: 'simongaud87@gmail.com',               customerName: 'Simon Gaudreau',      financialStatus: 'paid',    fulfillmentStatus: 'fulfilled', itemsCount: 2 },
  { id: 7307867848819, name: '#1560', total: 1759.12, currency: 'CAD', createdAt: '2026-04-09T12:40:50-04:00', email: 'laura@creatureatelier.ca',            customerName: 'Laura',               financialStatus: 'paid',    fulfillmentStatus: 'fulfilled', itemsCount: 2 },
  { id: 7305456386163, name: '#1559', total: 206.96,  currency: 'CAD', createdAt: '2026-04-08T22:07:05-04:00', email: 'cbf-inc@hotmail.com',                 customerName: 'Emmanuel Blais',      financialStatus: 'paid',    fulfillmentStatus: null,        itemsCount: 1 },
  { id: 7297122009203, name: '#1558', total: 349.15,  currency: 'CAD', createdAt: '2026-04-06T15:36:55-04:00', email: 'erika.laliberte@sedentaire.co',       customerName: 'Erika Laliberte',     financialStatus: 'paid',    fulfillmentStatus: 'fulfilled', itemsCount: 4 },
  { id: 7296727285875, name: '#1557', total: 241.45,  currency: 'CAD', createdAt: '2026-04-06T13:16:47-04:00', email: 'christian.laroche7@gmail.com',        customerName: 'Christian Laroche',   financialStatus: 'paid',    fulfillmentStatus: 'fulfilled', itemsCount: 1 },
  { id: 7296504922227, name: '#1556', total: 229.96,  currency: 'CAD', createdAt: '2026-04-06T12:14:14-04:00', email: 'marcote2010@live.ca',                 customerName: 'Martin Cote',         financialStatus: 'paid',    fulfillmentStatus: 'fulfilled', itemsCount: 1 },
  { id: 7295898878067, name: '#1555', total: 356.60,  currency: 'CAD', createdAt: '2026-04-06T09:27:54-04:00', email: 'direction@labarredujour.com',         customerName: 'La Barre du Jour',    financialStatus: 'paid',    fulfillmentStatus: 'fulfilled', itemsCount: 1 },
  { id: 7295829639283, name: '#1554', total: 237.84,  currency: 'CAD', createdAt: '2026-04-06T09:03:15-04:00', email: 'inspection@cemdcanada.com',           customerName: 'Stéphanie Therrien',  financialStatus: 'paid',    fulfillmentStatus: 'fulfilled', itemsCount: 3 },
  { id: 7294762745971, name: '#1553', total: 252.95,  currency: 'CAD', createdAt: '2026-04-05T19:59:00-04:00', email: 'info@renovationselites.com',          customerName: 'Michael Montigny',    financialStatus: 'paid',    fulfillmentStatus: 'fulfilled', itemsCount: 1 },
  { id: 7294322376819, name: '#1552', total: 429.39,  currency: 'CAD', createdAt: '2026-04-05T15:46:53-04:00', email: 'christian-justin-mathieu@live.com',   customerName: 'Christian Turgeon',   financialStatus: 'paid',    fulfillmentStatus: 'partial',   itemsCount: 8 },
  { id: 7294205755507, name: '#1551', total: 239.46,  currency: 'CAD', createdAt: '2026-04-05T14:45:17-04:00', email: 'christian-justin-mathieu@live.com',   customerName: 'Christian Turgeon',   financialStatus: 'paid',    fulfillmentStatus: 'fulfilled', itemsCount: 1 },
];

export const SHOPIFY_SNAPSHOT_META = {
  syncedAt: '2026-04-18T02:00:57Z',
  shop: 'visionaffichage-com.myshopify.com',
  source: 'zapier-mcp-admin-api-2024-10',
};

// ── Aggregated stats for dashboard widgets ─────────────────────────────────

const now = new Date('2026-04-18');
const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

const recent = SHOPIFY_ORDERS_SNAPSHOT.filter(o => new Date(o.createdAt) >= sevenDaysAgo);

export const SHOPIFY_STATS = {
  ordersLast7Days: recent.length,
  revenueLast7Days: Math.round(recent.reduce((s, o) => s + o.total, 0) * 100) / 100,
  pendingPayments: SHOPIFY_ORDERS_SNAPSHOT.filter(o => o.financialStatus === 'pending').length,
  awaitingFulfillment: SHOPIFY_ORDERS_SNAPSHOT.filter(
    o => o.financialStatus === 'paid' && !o.fulfillmentStatus,
  ).length,
  totalActiveProducts: 22, // from local catalogue, ready to be synced too
};
