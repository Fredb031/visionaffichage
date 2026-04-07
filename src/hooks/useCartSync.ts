// Cart sync is a no-op when Shopify is not configured.
// Will be activated once VITE_SHOPIFY_STOREFRONT_TOKEN is set in .env
export function useCartSync() {
  // Shopify Storefront API sync disabled until credentials are configured.
  // See src/lib/shopify.ts — add VITE_SHOPIFY_STOREFRONT_TOKEN and VITE_SHOPIFY_DOMAIN to .env
}
