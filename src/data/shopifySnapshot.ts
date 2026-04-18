// Real Shopify data snapshot fetched via Zapier MCP on 2026-04-18.
// To refresh: re-call the Shopify Admin API via Zapier and replace the arrays.
// Long-term: replace with a Supabase edge function that calls Shopify live
// and caches in a Supabase table.

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

export interface ShopifyProductSnapshot {
  id: number;
  title: string;
  handle: string;
  productType: string;
  vendor: string;
  status: string;
  totalInventory: number;
  variantsCount: number;
  firstImage: string;
  minPrice: number;
  maxPrice: number;
}

export interface ShopifyAbandonedCheckoutSnapshot {
  id: number;
  total: number;
  currency: string;
  email: string;
  customerName: string;
  createdAt: string;
  recoveryUrl: string;
  itemsCount: number;
}

export interface ShopifyCustomerSnapshot {
  id: number;
  firstName: string | null;
  lastName: string | null;
  email: string;
  phone: string | null;
  ordersCount: number;
  totalSpent: number;
  currency: string;
  tags: string;
  createdAt: string;
  city: string | null;
  province: string | null;
}

export const SHOPIFY_SNAPSHOT_META = {
  syncedAt: '2026-04-18T02:06:47Z',
  shop: 'visionaffichage-com.myshopify.com',
  source: 'zapier-mcp-admin-api-2024-10',
};

// ───────────── Orders (20 most recent) ─────────────

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

// ───────────── Products (all 22 active) ─────────────

export const SHOPIFY_PRODUCTS_SNAPSHOT: ShopifyProductSnapshot[] = [
  { id: 8149423325299, title: '6245CM',                        handle: '6245cm',     productType: 'Casquette',                vendor: '6245CM',          status: 'active', totalInventory: -12, variantsCount: 5,  firstImage: 'https://cdn.shopify.com/s/files/1/0578/1038/7059/files/c7d01dfb7dac4c79bd82abffc68e043c_l_21bd6f74-2540-48fe-bdd9-6d337329a5b5.jpg?v=1763598101', minPrice: 11.54, maxPrice: 15.39 },
  { id: 8150618144883, title: 'ATC1000',                       handle: 'atc1000',    productType: 'T-shirt',                  vendor: 'ATC1000',         status: 'active', totalInventory: -19, variantsCount: 24, firstImage: 'https://cdn.shopify.com/s/files/1/0578/1038/7059/files/ATC1000-Devant.jpg?v=1770866927', minPrice: 4.15,  maxPrice: 4.15 },
  { id: 8149420966003, title: 'ATC1000L',                      handle: 'atc1000l',   productType: 'T-shirt',                  vendor: 'ATC1000L',        status: 'active', totalInventory: -11, variantsCount: 9,  firstImage: 'https://cdn.shopify.com/s/files/1/0578/1038/7059/files/ATC1000L-Devant.jpg?v=1770867419', minPrice: 6.65,  maxPrice: 6.65 },
  { id: 8149420146803, title: 'ATC1000Y',                      handle: 'atc1000y-1', productType: 'T-shirt',                  vendor: 'ATC1000Y',        status: 'active', totalInventory: -10, variantsCount: 9,  firstImage: 'https://cdn.shopify.com/s/files/1/0578/1038/7059/files/ATCY1000-Devant.jpg?v=1770867607', minPrice: 4.76,  maxPrice: 4.76 },
  { id: 8149421490291, title: 'ATC1015',                       handle: 'atc1015',    productType: 't-shirt manches longues',  vendor: 'ATC1015',         status: 'active', totalInventory: -6,  variantsCount: 19, firstImage: 'https://cdn.shopify.com/s/files/1/0578/1038/7059/files/ATC1015-Devant.jpg?v=1770866896', minPrice: 11.42, maxPrice: 11.42 },
  { id: 8149422735475, title: 'ATC6277',                       handle: 'atc6277-1',  productType: 'Casquette',                vendor: 'ATC6277',         status: 'active', totalInventory: -7,  variantsCount: 1,  firstImage: 'https://cdn.shopify.com/s/files/1/0578/1038/7059/files/atc6277_modl_white_studio-1_2021_cil-_1.jpg?v=1763598029', minPrice: 20.99, maxPrice: 20.99 },
  { id: 8149422342259, title: 'ATC6606',                       handle: 'atc6606',    productType: 'Casquette',                vendor: 'ATC6606',         status: 'active', totalInventory: -37, variantsCount: 19, firstImage: 'https://cdn.shopify.com/s/files/1/0578/1038/7059/files/yupoong-6606-noir-2_cb488769-745e-41f0-91fd-f317d9787cae.jpg?v=1763598460', minPrice: 15.39, maxPrice: 27.54 },
  { id: 8149422080115, title: 'ATCF2400',                      handle: 'atcf2400-1', productType: 'sweat col rond',           vendor: 'ATC2400',         status: 'active', totalInventory: 0,   variantsCount: 8,  firstImage: 'https://cdn.shopify.com/s/files/1/0578/1038/7059/files/ATCF2400-Devant.jpg?v=1770866896', minPrice: 16.81, maxPrice: 16.81 },
  { id: 8147375161459, title: 'ATCF2500',                      handle: 'atcf2500',   productType: 'Sweat à capuche',          vendor: 'ATCF2500',        status: 'active', totalInventory: -72, variantsCount: 24, firstImage: 'https://cdn.shopify.com/s/files/1/0578/1038/7059/files/ATCF2500-Devant.jpg?v=1770866896', minPrice: 28.9,  maxPrice: 28.9 },
  { id: 8149422932083, title: 'ATCF2600',                      handle: 'atcf2600-1', productType: 'Sweat à capuche',          vendor: 'ATCF2600',        status: 'active', totalInventory: -5,  variantsCount: 14, firstImage: 'https://cdn.shopify.com/s/files/1/0578/1038/7059/files/ATCF2600-Devant.jpg?v=1770866896', minPrice: 32.49, maxPrice: 32.49 },
  { id: 8149423063155, title: 'ATCY2500',                      handle: 'atcy2500-1', productType: 'Sweat à capuche',          vendor: 'ATCY2500',        status: 'active', totalInventory: -7,  variantsCount: 19, firstImage: 'https://cdn.shopify.com/s/files/1/0578/1038/7059/files/ATCFY2500-Devant.jpg?v=1770866961', minPrice: 21.39, maxPrice: 23.91 },
  { id: 8149423816819, title: 'C100',                          handle: 'c100-1',     productType: 'Tuque',                    vendor: 'C100',            status: 'active', totalInventory: -17, variantsCount: 23, firstImage: 'https://cdn.shopify.com/s/files/1/0578/1038/7059/files/c100-2_ea555bdf-f334-432d-a61e-5ba0cb06692e.jpg?v=1763598117', minPrice: 4.5,   maxPrice: 6.01 },
  { id: 8149423521907, title: 'C105',                          handle: 'c105-1',     productType: 'Tuque',                    vendor: 'C105',            status: 'active', totalInventory: -3,  variantsCount: 5,  firstImage: 'https://cdn.shopify.com/s/files/1/0578/1038/7059/files/c105-2_c5d6b8c6-8c32-43f3-851d-f48dd2d35913.jpg?v=1763598172', minPrice: 7.13,  maxPrice: 9.51 },
  { id: 8149421686899, title: 'L350',                          handle: 'l350-1',     productType: 'T-shirt',                  vendor: 'L350',            status: 'active', totalInventory: -1,  variantsCount: 7,  firstImage: 'https://cdn.shopify.com/s/files/1/0578/1038/7059/files/L350-Devant.jpg?v=1770867170', minPrice: 13.99, maxPrice: 13.99 },
  { id: 8149421326451, title: 'L445',                          handle: 'l445-1',     productType: 'Polo et chemise',          vendor: 'L445',            status: 'active', totalInventory: -8,  variantsCount: 8,  firstImage: 'https://cdn.shopify.com/s/files/1/0578/1038/7059/files/L445-Devant.jpg?v=1770866896', minPrice: 27.99, maxPrice: 27.99 },
  { id: 8182130737267, title: 'Pack découverte édition été',   handle: 'pack-ete',   productType: '',                         vendor: 'Pack découverte', status: 'active', totalInventory: -17, variantsCount: 1,  firstImage: 'https://cdn.shopify.com/s/files/1/0578/1038/7059/files/hf_20260130_190909_bf75301e-d22b-41a1-93d2-5bb932ac4df5_1.png?v=1769816240', minPrice: 200,   maxPrice: 200 },
  { id: 8182130573427, title: 'Pack découverte édition hiver', handle: 'pack-hiver', productType: '',                         vendor: 'Pack découverte', status: 'active', totalInventory: -9,  variantsCount: 1,  firstImage: 'https://cdn.shopify.com/s/files/1/0578/1038/7059/files/hf_20260130_193417_2c964475-ca64-4a60-b80d-16b4d77f2a50.png?v=1769816226', minPrice: 200,   maxPrice: 200 },
  { id: 8149422014579, title: 'S350',                          handle: 's350-1',     productType: 'T-shirt',                  vendor: 'S350',            status: 'active', totalInventory: -8,  variantsCount: 7,  firstImage: 'https://cdn.shopify.com/s/files/1/0578/1038/7059/files/S350-Devant.jpg?v=1770866896', minPrice: 13.99, maxPrice: 13.99 },
  { id: 8149421097075, title: 'S445',                          handle: 's445-1',     productType: 'Polo et chemise',          vendor: 'S445',            status: 'active', totalInventory: -19, variantsCount: 8,  firstImage: 'https://cdn.shopify.com/s/files/1/0578/1038/7059/files/S445-Devant.jpg?v=1770866896', minPrice: 27.99, maxPrice: 27.99 },
  { id: 8149421195379, title: 'S445LS',                        handle: 's445ls-1',   productType: 'Polo et chemise',          vendor: 'S445LS',          status: 'active', totalInventory: -6,  variantsCount: 3,  firstImage: 'https://cdn.shopify.com/s/files/1/0578/1038/7059/files/S445LS-Devant.jpg?v=1770866896', minPrice: 33.59, maxPrice: 33.59 },
  { id: 8149422538867, title: 'WERK250',                       handle: 'werk250-1',  productType: 'T-shirt',                  vendor: 'ATC Werk 250',    status: 'active', totalInventory: -11, variantsCount: 8,  firstImage: 'https://cdn.shopify.com/s/files/1/0578/1038/7059/files/Werk250-Devant.jpg?v=1770867038', minPrice: 16.09, maxPrice: 16.09 },
  { id: 8149422211187, title: 'Y350',                          handle: 'y350-1',     productType: 'T-shirt',                  vendor: 'Y350',            status: 'active', totalInventory: -1,  variantsCount: 13, firstImage: 'https://cdn.shopify.com/s/files/1/0578/1038/7059/files/Y350-Devant.jpg?v=1770867079', minPrice: 13.98, maxPrice: 13.99 },
];

// ───────────── Customers (30 most recent) ─────────────

export const SHOPIFY_CUSTOMERS_SNAPSHOT: ShopifyCustomerSnapshot[] = [
  { id: 9991913373811, firstName: 'Marc-Olivier',            lastName: 'Blais (MobFNBR)',  email: 'blaismarco12@gmail.com',        phone: null,             ordersCount: 0, totalSpent: 0.00,    currency: 'CAD', tags: 'Login with Shop, Shop',                             createdAt: '2026-04-17T08:13:49-04:00', city: null,                     province: null },
  { id: 9989076385907, firstName: 'Zack',                    lastName: 'Landry',           email: 'czesthetique@gmail.com',        phone: null,             ordersCount: 1, totalSpent: 199.14,  currency: 'CAD', tags: 'Login with Shop, Shop',                             createdAt: '2026-04-16T12:24:03-04:00', city: 'Lévis',                  province: 'Quebec' },
  { id: 9988154556531, firstName: 'ytemben',                 lastName: 'bruce',            email: 'bruceytemben@gmail.com',        phone: null,             ordersCount: 0, totalSpent: 0.00,    currency: 'CAD', tags: 'Login with Shop, Shop',                             createdAt: '2026-04-16T01:07:07-04:00', city: null,                     province: null },
  { id: 9987392798835, firstName: 'mario',                   lastName: 'rivard',           email: 'mario.rivard@outlook.com',      phone: '+18195236351',   ordersCount: 1, totalSpent: 235.08,  currency: 'CAD', tags: 'EcomSend, 10$ OFF',                                 createdAt: '2026-04-15T19:44:32-04:00', city: 'La Tuque',               province: 'Quebec' },
  { id: 9987378282611, firstName: 'Carolane',                lastName: null,               email: 'carolane_lacasse@hotmail.ca',   phone: '+14505121507',   ordersCount: 0, totalSpent: 0.00,    currency: 'CAD', tags: 'EcomSend, 10$ OFF',                                 createdAt: '2026-04-15T19:36:14-04:00', city: 'Saint-Jean-sur-Richelieu', province: null },
  { id: 9986647162995, firstName: 'Zack',                    lastName: 'Landy',            email: 'info@vitrexentretiens.ca',      phone: null,             ordersCount: 1, totalSpent: 1209.44, currency: 'CAD', tags: '',                                                  createdAt: '2026-04-15T13:31:02-04:00', city: 'Lévis',                  province: 'Quebec' },
  { id: 9985077739635, firstName: 'Julia',                   lastName: 'Pietacho',         email: 'julia-07@live.ca',              phone: null,             ordersCount: 1, totalSpent: 61.98,   currency: 'CAD', tags: 'Login with Shop, Shop',                             createdAt: '2026-04-14T21:01:00-04:00', city: 'Québec',                 province: 'Quebec' },
  { id: 9984980844659, firstName: 'Marc-André',              lastName: 'Boulay',           email: 'maboulay19961@outlook.com',     phone: '+18193601639',   ordersCount: 0, totalSpent: 0.00,    currency: 'CAD', tags: 'EcomSend, Livraison Gratuite',                      createdAt: '2026-04-14T20:01:49-04:00', city: 'Val-des-Monts',          province: null },
  { id: 9984678232179, firstName: 'Julia',                   lastName: 'Vachon',           email: 'vachonnnjuliaaa@gmail.com',     phone: '+14183506307',   ordersCount: 0, totalSpent: 0.00,    currency: 'CAD', tags: 'EcomSend, 10$ OFF',                                 createdAt: '2026-04-14T17:17:03-04:00', city: null,                     province: null },
  { id: 9984220790899, firstName: 'Michel Dosm',             lastName: 'Louis',            email: 'micheldosmalouis72@gmail.com',  phone: null,             ordersCount: 1, totalSpent: 173.62,  currency: 'CAD', tags: 'Login with Shop, Shop',                             createdAt: '2026-04-14T14:09:44-04:00', city: 'Montreal',               province: 'Quebec' },
  { id: 9984058785907, firstName: 'Frank',                   lastName: null,               email: 'conceptiondesenio@gmail.com',   phone: '+15146252828',   ordersCount: 0, totalSpent: 0.00,    currency: 'CAD', tags: 'EcomSend, Livraison Gratuite',                      createdAt: '2026-04-14T13:07:19-04:00', city: 'Montreal',               province: null },
  { id: 9983747326067, firstName: 'melanie',                 lastName: 'brault',           email: 'krea@videotron.ca',             phone: null,             ordersCount: 0, totalSpent: 0.00,    currency: 'CAD', tags: 'Login with Shop, Shop',                             createdAt: '2026-04-14T11:01:46-04:00', city: null,                     province: null },
  { id: 9982319886451, firstName: 'Alexandre',               lastName: 'Croteau',          email: 'alexandrecroteau18@gmail.com',  phone: '+14509174096',   ordersCount: 0, totalSpent: 0.00,    currency: 'CAD', tags: 'EcomSend, 10$ OFF',                                 createdAt: '2026-04-13T19:42:08-04:00', city: 'Prévost',                province: null },
  { id: 9981920772211, firstName: 'kevin',                   lastName: 'michaud',          email: 'michaud_500@hotmail.com',       phone: '+15067402654',   ordersCount: 0, totalSpent: 0.00,    currency: 'CAD', tags: 'EcomSend, 10$ OFF',                                 createdAt: '2026-04-13T15:41:48-04:00', city: 'Edmundston',             province: null },
  { id: 9981473718387, firstName: 'Groupe Lapointe Construction inc.', lastName: null, email: 'williamlapointe37@gmail.com',     phone: '+15819933737',   ordersCount: 0, totalSpent: 0.00,    currency: 'CAD', tags: 'EcomSend, 20$ OFF',                                 createdAt: '2026-04-13T12:08:08-04:00', city: null,                     province: null },
  { id: 9981154820211, firstName: 'Club Corvette C8 Québec', lastName: null,               email: 'gmercier1@hotmail.com',         phone: '+14504314323',   ordersCount: 0, totalSpent: 0.00,    currency: 'CAD', tags: 'EcomSend, 20$ OFF',                                 createdAt: '2026-04-13T09:23:03-04:00', city: 'Miami',                  province: null },
  { id: 9979821162611, firstName: 'Annie',                   lastName: 'Massarelli',       email: 'anemaconstruction@hotmail.com', phone: '+14508224919',   ordersCount: 0, totalSpent: 0.00,    currency: 'CAD', tags: 'EcomSend, 10$ OFF',                                 createdAt: '2026-04-12T16:42:17-04:00', city: 'St-Hippolyte',           province: null },
  { id: 9979726528627, firstName: 'Benoit',                  lastName: null,               email: 'benoit.labbe@labtek.ca',        phone: '+14385018324',   ordersCount: 0, totalSpent: 0.00,    currency: 'CAD', tags: 'EcomSend, 20$ OFF',                                 createdAt: '2026-04-12T15:55:39-04:00', city: 'Prévost',                province: null },
  { id: 9978960117875, firstName: 'Optimo Solutions Ic',     lastName: null,               email: 'optimosolutionsinc@gmail.com',  phone: '+14188094645',   ordersCount: 0, totalSpent: 0.00,    currency: 'CAD', tags: 'EcomSend, 10$ OFF',                                 createdAt: '2026-04-12T09:55:27-04:00', city: 'Chisasibi',              province: null },
  { id: 9977971736691, firstName: 'Eric',                    lastName: null,               email: 'ericlan86@outlook.com',         phone: '+14387775942',   ordersCount: 0, totalSpent: 0.00,    currency: 'CAD', tags: 'EcomSend, 10$ OFF',                                 createdAt: '2026-04-11T20:33:58-04:00', city: 'Châteauguay',            province: null },
  { id: 9977147359347, firstName: 'bourgeois theriault',     lastName: null,               email: 'mikaeltheriault@outlook.com',   phone: '+14189374551',   ordersCount: 0, totalSpent: 0.00,    currency: 'CAD', tags: 'EcomSend, 10$ OFF',                                 createdAt: '2026-04-11T12:58:36-04:00', city: 'Fatima',                 province: null },
  { id: 9975995924595, firstName: 'Maxime',                  lastName: null,               email: 'maximecourcelles@gmail.com',    phone: '+18193417632',   ordersCount: 0, totalSpent: 0.00,    currency: 'CAD', tags: 'EcomSend, 10$ OFF',                                 createdAt: '2026-04-10T22:56:30-04:00', city: 'Montreal',               province: null },
  { id: 9975792959603, firstName: 'Sébastien',               lastName: 'Ayotte',           email: 'bombassayotte@hotmail.com',     phone: '+14188066350',   ordersCount: 0, totalSpent: 0.00,    currency: 'CAD', tags: 'EcomSend, 10$ OFF',                                 createdAt: '2026-04-10T20:43:46-04:00', city: 'Québec',                 province: null },
  { id: 9975660839027, firstName: 'Olivier',                 lastName: 'Gagnon',           email: 'olivierg784@gmail.com',         phone: '+14185738656',   ordersCount: 0, totalSpent: 0.00,    currency: 'CAD', tags: 'EcomSend, Livraison Gratuite',                      createdAt: '2026-04-10T19:11:55-04:00', city: 'Charny',                 province: null },
  { id: 9975439130739, firstName: 'antoine',                 lastName: 'decharette',       email: 'antoine406@hotmail.com',        phone: '+18198521033',   ordersCount: 0, totalSpent: 0.00,    currency: 'CAD', tags: 'EcomSend, 10$ OFF',                                 createdAt: '2026-04-10T16:57:21-04:00', city: 'Montreal',               province: null },
  { id: 9975006855283, firstName: 'Jean',                    lastName: 'Gauthier',         email: 'jgauu@hotmail.com',             phone: '+18195230126',   ordersCount: 0, totalSpent: 0.00,    currency: 'CAD', tags: 'EcomSend, 10$ OFF',                                 createdAt: '2026-04-10T13:35:58-04:00', city: 'Ottawa',                 province: null },
  { id: 9973617754227, firstName: 'Elie',                    lastName: null,               email: 'elie_23@hotmail.com',           phone: '+14507700391',   ordersCount: 0, totalSpent: 0.00,    currency: 'CAD', tags: 'EcomSend, 10$ OFF',                                 createdAt: '2026-04-10T04:20:45-04:00', city: 'Montreal',               province: null },
  { id: 9970615451763, firstName: 'Mélyna',                  lastName: 'Lebeau',           email: 'meli_9019@hotmail.com',         phone: '+14505855953',   ordersCount: 0, totalSpent: 0.00,    currency: 'CAD', tags: 'EcomSend, 10$ OFF',                                 createdAt: '2026-04-09T12:59:50-04:00', city: 'Terrebonne',             province: null },
  { id: 9970577506419, firstName: 'Laura',                   lastName: null,               email: 'laura@creatureatelier.ca',      phone: null,             ordersCount: 1, totalSpent: 1759.12, currency: 'CAD', tags: '',                                                  createdAt: '2026-04-09T12:40:33-04:00', city: 'Québec',                 province: 'Quebec' },
  { id: 9969780949107, firstName: 'Christian',               lastName: null,               email: 'cvien27@gmail.com',             phone: '+14383455824',   ordersCount: 0, totalSpent: 0.00,    currency: 'CAD', tags: 'EcomSend, 10$ OFF',                                 createdAt: '2026-04-09T08:07:54-04:00', city: 'Montreal',               province: null },
];

// ───────────── Abandoned checkouts (20 most recent) ─────────────

export const SHOPIFY_ABANDONED_CHECKOUTS_SNAPSHOT: ShopifyAbandonedCheckoutSnapshot[] = [
  { id: 33770452844659, total: 53.01,  currency: 'CAD', email: 'jordangoyette1999@hotmail.com', customerName: 'Jordan Goyette',           createdAt: '2026-03-02T09:57:33-05:00', recoveryUrl: 'https://visionaffichage.com/57810387059/checkouts/ac/33770452844659/recover', itemsCount: 1 },
  { id: 33750630858867, total: 52.88,  currency: 'CAD', email: 'samuelcharland23@hotmail.com',  customerName: 'Samuel Charland',           createdAt: '2026-02-27T10:41:33-05:00', recoveryUrl: 'https://visionaffichage.com/57810387059/checkouts/ac/33750630858867/recover', itemsCount: 1 },
  { id: 33734027411571, total: 680.59, currency: 'CAD', email: 'jeremy@visionaffichage.com',    customerName: 'Jeremy Marois',             createdAt: '2026-02-24T15:16:02-05:00', recoveryUrl: 'https://visionaffichage.com/57810387059/checkouts/ac/33734027411571/recover', itemsCount: 1 },
  { id: 33716137459827, total: 76.79,  currency: 'CAD', email: 'fredericgoulet13@gmail.com',    customerName: 'Frederic Goulet',           createdAt: '2026-02-21T12:06:03-05:00', recoveryUrl: 'https://visionaffichage.com/57810387059/checkouts/ac/33716137459827/recover', itemsCount: 2 },
  { id: 33715400933491, total: 86.31,  currency: 'CAD', email: 'fredericgoulet13@gmail.com',    customerName: 'Frederic Goulet',           createdAt: '2026-02-21T09:29:32-05:00', recoveryUrl: 'https://visionaffichage.com/57810387059/checkouts/ac/33715400933491/recover', itemsCount: 2 },
  { id: 33704609284211, total: 224.43, currency: 'CAD', email: 'atmmultiservices@hotmail.com',  customerName: '9442-8711 Quebec inc Meloche', createdAt: '2026-02-19T09:40:02-05:00', recoveryUrl: 'https://visionaffichage.com/57810387059/checkouts/ac/33704609284211/recover', itemsCount: 1 },
  { id: 33697227735155, total: 101.63, currency: 'CAD', email: 'mantoine1000@gmail.com',        customerName: 'Marc-Antoine Guay',         createdAt: '2026-02-17T21:01:02-05:00', recoveryUrl: 'https://visionaffichage.com/57810387059/checkouts/ac/33697227735155/recover', itemsCount: 1 },
  { id: 33683877331059, total: 290.71, currency: 'CAD', email: 'lemjo624@gmail.com',            customerName: 'Jonathan Lemaire',          createdAt: '2026-02-15T12:08:02-05:00', recoveryUrl: 'https://visionaffichage.com/57810387059/checkouts/ac/33683877331059/recover', itemsCount: 3 },
  { id: 33678275379315, total: 252.95, currency: 'CAD', email: 'gasper_lambert@hotmail.com',    customerName: 'Jonathan Lambert',          createdAt: '2026-02-14T10:32:02-05:00', recoveryUrl: 'https://visionaffichage.com/57810387059/checkouts/ac/33678275379315/recover', itemsCount: 1 },
  { id: 33666018771059, total: 60.34,  currency: 'CAD', email: 'lemjo624@gmail.com',            customerName: 'Jonathan Lemaire',          createdAt: '2026-02-11T23:13:03-05:00', recoveryUrl: 'https://visionaffichage.com/57810387059/checkouts/ac/33666018771059/recover', itemsCount: 1 },
  { id: 33660973711475, total: 379.54, currency: 'CAD', email: 'jerome.labbe@live.ca',          customerName: 'Jerome Labbe',              createdAt: '2026-02-10T23:09:33-05:00', recoveryUrl: 'https://visionaffichage.com/57810387059/checkouts/ac/33660973711475/recover', itemsCount: 1 },
  { id: 33659949121651, total: 91.03,  currency: 'CAD', email: 'vigelizabeth13@gmail.com',      customerName: 'Condos vacances MSA',       createdAt: '2026-02-10T18:34:32-05:00', recoveryUrl: 'https://visionaffichage.com/57810387059/checkouts/ac/33659949121651/recover', itemsCount: 5 },
  { id: 33657425002611, total: 33.02,  currency: 'CAD', email: 'baroni.jp@videotron.ca',        customerName: '',                          createdAt: '2026-02-10T08:04:01-05:00', recoveryUrl: 'https://visionaffichage.com/57810387059/checkouts/ac/33657425002611/recover', itemsCount: 1 },
  { id: 33654913826931, total: 299.60, currency: 'CAD', email: 'samuelt.0403@gmail.com',        customerName: 'Samuel Turgeon',            createdAt: '2026-03-05T17:04:01-05:00', recoveryUrl: 'https://visionaffichage.com/57810387059/checkouts/ac/33654913826931/recover', itemsCount: 1 },
  { id: 33607144570995, total: 38.90,  currency: 'CAD', email: 'samuelt.0403@gmail.com',        customerName: 'Samuel Turgeon',            createdAt: '2026-01-30T21:54:01-05:00', recoveryUrl: 'https://visionaffichage.com/57810387059/checkouts/ac/33607144570995/recover', itemsCount: 1 },
  { id: 33606320455795, total: 36.13,  currency: 'CAD', email: 'seifalila1@gmail.com',          customerName: 'Seif Alila',                createdAt: '2026-01-30T18:05:31-05:00', recoveryUrl: 'https://visionaffichage.com/57810387059/checkouts/ac/33606320455795/recover', itemsCount: 1 },
  { id: 33598642094195, total: 107.33, currency: 'CAD', email: 'fredmalou12@gmail.com',         customerName: 'Frederick Bouchard',        createdAt: '2026-01-29T08:31:34-05:00', recoveryUrl: 'https://visionaffichage.com/57810387059/checkouts/ac/33598642094195/recover', itemsCount: 4 },
  { id: 33592648335475, total: 78.63,  currency: 'CAD', email: 'magz.qc@gmail.com',             customerName: '',                          createdAt: '2026-01-27T22:31:33-05:00', recoveryUrl: 'https://visionaffichage.com/57810387059/checkouts/ac/33592648335475/recover', itemsCount: 1 },
  { id: 33587354927219, total: 0.00,   currency: 'CAD', email: 'seifalila1@gmail.com',          customerName: 'Seif Alila',                createdAt: '2026-01-26T16:39:02-05:00', recoveryUrl: 'https://visionaffichage.com/57810387059/checkouts/ac/33587354927219/recover', itemsCount: 2 },
  { id: 33578084040819, total: 377.45, currency: 'CAD', email: 'info@visionaffichage.com',      customerName: 'Vision Affichage',          createdAt: '2026-01-31T01:42:32-05:00', recoveryUrl: 'https://visionaffichage.com/57810387059/checkouts/ac/33578084040819/recover', itemsCount: 4 },
];

// ───────────── Aggregated stats ─────────────

const NOW = new Date('2026-04-18');
const sevenDaysAgo = new Date(NOW.getTime() - 7 * 24 * 60 * 60 * 1000);

const recent = SHOPIFY_ORDERS_SNAPSHOT.filter(o => new Date(o.createdAt) >= sevenDaysAgo);

export const SHOPIFY_STATS = {
  ordersLast7Days: recent.length,
  revenueLast7Days: Math.round(recent.reduce((s, o) => s + o.total, 0) * 100) / 100,
  pendingPayments: SHOPIFY_ORDERS_SNAPSHOT.filter(o => o.financialStatus === 'pending').length,
  awaitingFulfillment: SHOPIFY_ORDERS_SNAPSHOT.filter(
    o => o.financialStatus === 'paid' && !o.fulfillmentStatus,
  ).length,
  totalActiveProducts: SHOPIFY_PRODUCTS_SNAPSHOT.length,
  totalCustomers: SHOPIFY_CUSTOMERS_SNAPSHOT.length,
  payingCustomers: SHOPIFY_CUSTOMERS_SNAPSHOT.filter(c => c.ordersCount > 0).length,
  totalLifetimeRevenue: Math.round(
    SHOPIFY_CUSTOMERS_SNAPSHOT.reduce((s, c) => s + c.totalSpent, 0) * 100,
  ) / 100,
  abandonedCheckoutsCount: SHOPIFY_ABANDONED_CHECKOUTS_SNAPSHOT.length,
  abandonedCheckoutsValue: Math.round(
    SHOPIFY_ABANDONED_CHECKOUTS_SNAPSHOT.reduce((s, c) => s + c.total, 0) * 100,
  ) / 100,
};
