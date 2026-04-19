import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { storefrontApiRequest, ShopifyProduct } from '@/lib/shopify';

export interface CartItem {
  lineId: string | null;
  product: ShopifyProduct;
  variantId: string;
  variantTitle: string;
  price: { amount: string; currencyCode: string };
  quantity: number;
  selectedOptions: Array<{ name: string; value: string }>;
}

const CART_QUERY = `
  query cart($id: ID!) {
    cart(id: $id) { id totalQuantity }
  }
`;

const CART_CREATE_MUTATION = `
  mutation cartCreate($input: CartInput!) {
    cartCreate(input: $input) {
      cart {
        id
        checkoutUrl
        lines(first: 100) { edges { node { id merchandise { ... on ProductVariant { id } } } } }
      }
      userErrors { field message }
    }
  }
`;

const CART_LINES_ADD_MUTATION = `
  mutation cartLinesAdd($cartId: ID!, $lines: [CartLineInput!]!) {
    cartLinesAdd(cartId: $cartId, lines: $lines) {
      cart {
        id
        lines(first: 100) { edges { node { id merchandise { ... on ProductVariant { id } } } } }
      }
      userErrors { field message }
    }
  }
`;

const CART_LINES_UPDATE_MUTATION = `
  mutation cartLinesUpdate($cartId: ID!, $lines: [CartLineUpdateInput!]!) {
    cartLinesUpdate(cartId: $cartId, lines: $lines) {
      cart { id }
      userErrors { field message }
    }
  }
`;

const CART_LINES_REMOVE_MUTATION = `
  mutation cartLinesRemove($cartId: ID!, $lineIds: [ID!]!) {
    cartLinesRemove(cartId: $cartId, lineIds: $lineIds) {
      cart { id }
      userErrors { field message }
    }
  }
`;

function formatCheckoutUrl(checkoutUrl: string): string {
  try {
    const url = new URL(checkoutUrl);
    url.searchParams.set('channel', 'online_store');
    return url.toString();
  } catch {
    return checkoutUrl;
  }
}

function isCartNotFoundError(userErrors: Array<{ field: string[] | null; message: string }>): boolean {
  return userErrors.some(e => e.message.toLowerCase().includes('cart not found') || e.message.toLowerCase().includes('does not exist'));
}

async function createShopifyCart(item: CartItem): Promise<{ cartId: string; checkoutUrl: string; lineId: string } | null> {
  const data = await storefrontApiRequest(CART_CREATE_MUTATION, {
    input: { lines: [{ quantity: item.quantity, merchandiseId: item.variantId }] },
  });
  // Mirror the guard the other mutation helpers added: storefrontApiRequest
  // returns undefined on HTTP 402, and the optional chaining below would
  // silently return null. Still null, so not a behavioural change — but
  // being explicit keeps the code uniform and makes future refactors safer.
  if (!data?.data?.cartCreate) return null;
  if (data.data.cartCreate.userErrors?.length > 0) return null;
  const cart = data.data.cartCreate.cart;
  if (!cart?.checkoutUrl) return null;
  const lineId = cart.lines?.edges?.[0]?.node?.id;
  if (!lineId) return null;
  return { cartId: cart.id, checkoutUrl: formatCheckoutUrl(cart.checkoutUrl), lineId };
}

async function addLineToShopifyCart(cartId: string, item: CartItem): Promise<{ success: boolean; lineId?: string; cartNotFound?: boolean }> {
  const data = await storefrontApiRequest(CART_LINES_ADD_MUTATION, {
    cartId,
    lines: [{ quantity: item.quantity, merchandiseId: item.variantId }],
  });
  // storefrontApiRequest returns undefined on HTTP 402 (store plan
  // lapsed). Without this guard, userErrors=[], the empty-check
  // passes, and we committed a local cart line for a Shopify cart
  // that was never actually updated.
  if (!data?.data?.cartLinesAdd) return { success: false };
  const userErrors = data.data.cartLinesAdd.userErrors || [];
  if (isCartNotFoundError(userErrors)) return { success: false, cartNotFound: true };
  if (userErrors.length > 0) return { success: false };
  const lines = data.data.cartLinesAdd.cart?.lines?.edges || [];
  const newLine = lines.find((l: { node: { id: string; merchandise: { id: string } } }) => l.node.merchandise.id === item.variantId);
  return { success: true, lineId: newLine?.node?.id };
}

async function updateShopifyCartLine(cartId: string, lineId: string, quantity: number): Promise<{ success: boolean; cartNotFound?: boolean }> {
  const data = await storefrontApiRequest(CART_LINES_UPDATE_MUTATION, { cartId, lines: [{ id: lineId, quantity }] });
  if (!data?.data?.cartLinesUpdate) return { success: false };
  const userErrors = data.data.cartLinesUpdate.userErrors || [];
  if (isCartNotFoundError(userErrors)) return { success: false, cartNotFound: true };
  if (userErrors.length > 0) return { success: false };
  return { success: true };
}

async function removeLineFromShopifyCart(cartId: string, lineId: string): Promise<{ success: boolean; cartNotFound?: boolean }> {
  const data = await storefrontApiRequest(CART_LINES_REMOVE_MUTATION, { cartId, lineIds: [lineId] });
  if (!data?.data?.cartLinesRemove) return { success: false };
  const userErrors = data.data.cartLinesRemove.userErrors || [];
  if (isCartNotFoundError(userErrors)) return { success: false, cartNotFound: true };
  if (userErrors.length > 0) return { success: false };
  return { success: true };
}

interface CartStore {
  items: CartItem[];
  cartId: string | null;
  checkoutUrl: string | null;
  isLoading: boolean;
  isSyncing: boolean;
  addItem: (item: Omit<CartItem, 'lineId'>) => Promise<void>;
  updateQuantity: (variantId: string, quantity: number) => Promise<void>;
  removeItem: (variantId: string) => Promise<void>;
  clearCart: () => void;
  syncCart: () => Promise<void>;
  getCheckoutUrl: () => string | null;
}

// Module-level promise so concurrent addItem() calls made before the
// first Shopify cart exists all wait on the same createShopifyCart()
// fetch. Without this, clicking "Add to cart" twice fast when the
// store has cartId=null spins up two independent Shopify carts (the
// second overrides the first's items, and the user gets charged on
// the wrong one).
let pendingCartCreation: Promise<void> | null = null;

// Per-variant in-flight addItem promises. Rapid re-clicks on the same
// Add-to-cart button used to race on the increment branch: both calls
// read existingItem.quantity=N, both computed N+1, both wrote N+1 to
// Shopify. Customer clicked twice, got charged for one. Chaining each
// new addItem behind the previous one for the same variant makes the
// second read see the first's committed quantity.
const pendingAdds = new Map<string, Promise<void>>();

export const useCartStore = create<CartStore>()(
  persist(
    (set, get) => ({
      items: [],
      cartId: null,
      checkoutUrl: null,
      isLoading: false,
      isSyncing: false,

      addItem: async (item) => {
        // Serialize the "no cart yet, create one" path so parallel clicks
        // don't each kick off their own createShopifyCart.
        if (!get().cartId && pendingCartCreation) {
          await pendingCartCreation;
        }
        // Serialize same-variant re-clicks so the increment branch sees
        // the prior committed quantity instead of a stale read.
        const prior = pendingAdds.get(item.variantId);
        if (prior) await prior;
        let release!: () => void;
        const slot = new Promise<void>(resolve => { release = resolve; });
        pendingAdds.set(item.variantId, slot);
        const { items, cartId, clearCart } = get();
        const existingItem = items.find(i => i.variantId === item.variantId);
        set({ isLoading: true });
        try {
          if (!cartId) {
            pendingCartCreation = (async () => {
              const result = await createShopifyCart({ ...item, lineId: null });
              if (result) {
                set({ cartId: result.cartId, checkoutUrl: result.checkoutUrl, items: [{ ...item, lineId: result.lineId }] });
              }
            })();
            try { await pendingCartCreation; } finally { pendingCartCreation = null; }
          } else if (existingItem) {
            const newQuantity = existingItem.quantity + item.quantity;
            if (!existingItem.lineId) return;
            const result = await updateShopifyCartLine(cartId, existingItem.lineId, newQuantity);
            if (result.success) {
              set({ items: get().items.map(i => i.variantId === item.variantId ? { ...i, quantity: newQuantity } : i) });
            } else if (result.cartNotFound) {
              // Session expired. Wipe the stale cartId and retry as a
              // fresh-cart create so the user's latest click isn't just
              // silently swallowed. (See the no-cartId branch above.)
              clearCart();
              set({ isLoading: false });
              // Release our per-variant slot BEFORE the recursive call or
              // the inner addItem awaits the slot we're still holding.
              if (pendingAdds.get(item.variantId) === slot) pendingAdds.delete(item.variantId);
              release();
              await get().addItem(item);
              return;
            }
          } else {
            const result = await addLineToShopifyCart(cartId, { ...item, lineId: null });
            if (result.success && result.lineId) {
              // Only commit to local state when we got a real lineId back —
              // without it the item can't be updated/removed later, leaving
              // the cart in a state where users see the item but can't touch it.
              set({ items: [...get().items, { ...item, lineId: result.lineId }] });
            } else if (result.cartNotFound) {
              // Same recovery as the update path — clear the dead cart
              // and retry so the user's add actually lands. Without
              // this, clicking Add on an expired session wiped the
              // cart and returned silently with nothing added.
              clearCart();
              set({ isLoading: false });
              if (pendingAdds.get(item.variantId) === slot) pendingAdds.delete(item.variantId);
              release();
              await get().addItem(item);
              return;
            } else if (result.success && !result.lineId) {
              console.warn('[cartStore] Shopify addLine succeeded but returned no lineId — refusing to add orphan item.');
            }
          }
        } catch (error) {
          console.error('Failed to add item:', error);
        } finally {
          set({ isLoading: false });
          if (pendingAdds.get(item.variantId) === slot) {
            pendingAdds.delete(item.variantId);
          }
          release();
        }
      },

      updateQuantity: async (variantId, quantity) => {
        if (quantity <= 0) { await get().removeItem(variantId); return; }
        const { items, cartId, clearCart } = get();
        const item = items.find(i => i.variantId === variantId);
        if (!item?.lineId || !cartId) return;
        set({ isLoading: true });
        try {
          const result = await updateShopifyCartLine(cartId, item.lineId, quantity);
          if (result.success) {
            set({ items: get().items.map(i => i.variantId === variantId ? { ...i, quantity } : i) });
          } else if (result.cartNotFound) clearCart();
        } catch (error) {
          console.error('Failed to update quantity:', error);
        } finally {
          set({ isLoading: false });
        }
      },

      removeItem: async (variantId) => {
        const { items, cartId, clearCart } = get();
        const item = items.find(i => i.variantId === variantId);
        if (!item?.lineId || !cartId) return;
        set({ isLoading: true });
        try {
          const result = await removeLineFromShopifyCart(cartId, item.lineId);
          if (result.success) {
            const newItems = get().items.filter(i => i.variantId !== variantId);
            if (newItems.length === 0) clearCart();
            else set({ items: newItems });
          } else if (result.cartNotFound) clearCart();
        } catch (error) {
          console.error('Failed to remove item:', error);
        } finally {
          set({ isLoading: false });
        }
      },

      clearCart: () => set({ items: [], cartId: null, checkoutUrl: null }),
      getCheckoutUrl: () => get().checkoutUrl,

      syncCart: async () => {
        const { cartId, isSyncing, clearCart } = get();
        if (!cartId || isSyncing) return;
        set({ isSyncing: true });
        try {
          const data = await storefrontApiRequest(CART_QUERY, { id: cartId });
          if (!data) return;
          const cart = data?.data?.cart;
          if (!cart || cart.totalQuantity === 0) clearCart();
        } catch (error) {
          console.error('Failed to sync cart:', error);
        } finally {
          set({ isSyncing: false });
        }
      },
    }),
    {
      name: 'shopify-cart',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ items: state.items, cartId: state.cartId, checkoutUrl: state.checkoutUrl }),
      // Drop items missing a lineId on hydration. Pre-iter-173 builds
      // could persist orphan items (a Shopify addLine that succeeded
      // without returning an id), and once hydrated those items were
      // undeletable: both removeItem and updateQuantity early-return
      // when !item.lineId, so the user was stuck looking at a cart
      // line they couldn't touch.
      onRehydrateStorage: () => (state) => {
        if (!state) return;
        if (Array.isArray(state.items)) {
          const clean = state.items.filter(i => !!i?.lineId);
          if (clean.length !== state.items.length) {
            state.items = clean;
            // If the whole cart was orphan lines, also clear cartId so
            // the next addItem takes the fresh-cart path cleanly.
            if (clean.length === 0) {
              state.cartId = null;
              state.checkoutUrl = null;
            }
          }
        }
      },
    }
  )
);
