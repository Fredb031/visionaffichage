import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { storefrontApiRequest, ShopifyError, ShopifyProduct } from '@/lib/shopify';
import { useUiStore } from '@/stores/uiStore';
import { toast } from '@/lib/toast';

// Phase 4.1 — mirror the Shopify cartId into a stable localStorage key
// the rest of the app (Checkout retry loop, recovery flows) can read
// without needing to crack open the zustand-persist envelope. Wrapped
// in try/catch so private-mode browsers / quota errors don't crash the
// store; the zustand persist layer is still the source of truth.
const SHOPIFY_CART_ID_KEY = 'va_shopify_cart_id';
function writeCartIdMirror(cartId: string | null): void {
  try {
    if (cartId) localStorage.setItem(SHOPIFY_CART_ID_KEY, cartId);
    else localStorage.removeItem(SHOPIFY_CART_ID_KEY);
  } catch { /* private mode / quota — non-fatal */ }
}
function readCartIdMirror(): string | null {
  try { return localStorage.getItem(SHOPIFY_CART_ID_KEY); }
  catch { return null; }
}

/** Per-line custom attribute (Shopify Storefront `AttributeInput`). Used
 * by the customizer to attach Logo URL / Placement / Zone / Aperçu to
 * each cart line so two customized designs in the same cart don't
 * overwrite each other on the production team's Shopify order view. */
export interface CartLineAttribute {
  key: string;
  value: string;
}

export interface CartItem {
  lineId: string | null;
  product: ShopifyProduct;
  variantId: string;
  variantTitle: string;
  price: { amount: string; currencyCode: string };
  quantity: number;
  selectedOptions: Array<{ name: string; value: string }>;
  /** Shopify cart line-level attributes. Optional so non-customized
   * adds (legacy / non-customizer paths) keep working without change.
   * When present, forwarded as `attributes` on the cartLinesAdd /
   * cartCreate `CartLineInput`. */
  lineAttributes?: CartLineAttribute[];
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
        lines(first: 100) { edges { node { id merchandise { ... on ProductVariant { id } } attributes { key value } } } }
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
        lines(first: 100) { edges { node { id merchandise { ... on ProductVariant { id } } attributes { key value } } } }
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

/** True when an error is worth retrying. ShopifyError carries an explicit
 * `retryable` flag set by storefrontApiRequest (429/5xx → true; 401/403 →
 * false). Also treats browser network failures (TypeError on fetch) and
 * AbortError-from-timeout as retryable. Caller-initiated aborts (passed
 * via signal) surface as DOMException AbortError with a `signal.aborted`
 * caller — those aren't ours to retry; return false so upstream code
 * can bail without retrying a user-cancelled action. */
function isRetryable(err: unknown): boolean {
  if (err instanceof ShopifyError) return err.retryable === true;
  if (err instanceof TypeError) return true; // fetch network error
  if (err && typeof err === 'object' && 'name' in err) {
    const name = (err as { name?: string }).name;
    // AbortError from our internal timeout is retryable; from an external
    // caller-supplied signal is not — but we can't distinguish here, so
    // conservatively don't retry AbortError.
    if (name === 'AbortError') return false;
  }
  return false;
}

/** Build a CartLineInput for the Storefront API. Drops `attributes`
 * entirely when none were supplied so non-customized adds round-trip
 * the exact same payload they always have (no behavioural change for
 * the catalog-add path). Empty attribute arrays are also dropped —
 * Shopify accepts them but rendering "0 attributes" wastes a network
 * round-trip on every catalog click. */
function buildLineInput(item: Pick<CartItem, 'quantity' | 'variantId' | 'lineAttributes'>): {
  quantity: number;
  merchandiseId: string;
  attributes?: CartLineAttribute[];
} {
  const line: { quantity: number; merchandiseId: string; attributes?: CartLineAttribute[] } = {
    quantity: item.quantity,
    merchandiseId: item.variantId,
  };
  if (item.lineAttributes && item.lineAttributes.length > 0) {
    line.attributes = item.lineAttributes;
  }
  return line;
}

async function createShopifyCart(item: CartItem, signal?: AbortSignal): Promise<{ cartId: string; checkoutUrl: string; lineId: string } | null> {
  const data = await storefrontApiRequest(CART_CREATE_MUTATION, {
    input: { lines: [buildLineInput(item)] },
  }, { signal });
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

async function addLineToShopifyCart(cartId: string, item: CartItem, signal?: AbortSignal): Promise<{ success: boolean; lineId?: string; cartNotFound?: boolean }> {
  const data = await storefrontApiRequest(CART_LINES_ADD_MUTATION, {
    cartId,
    lines: [buildLineInput(item)],
  }, { signal });
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

async function updateShopifyCartLine(cartId: string, lineId: string, quantity: number, signal?: AbortSignal): Promise<{ success: boolean; cartNotFound?: boolean }> {
  const data = await storefrontApiRequest(CART_LINES_UPDATE_MUTATION, { cartId, lines: [{ id: lineId, quantity }] }, { signal });
  if (!data?.data?.cartLinesUpdate) return { success: false };
  const userErrors = data.data.cartLinesUpdate.userErrors || [];
  if (isCartNotFoundError(userErrors)) return { success: false, cartNotFound: true };
  if (userErrors.length > 0) return { success: false };
  return { success: true };
}

async function removeLineFromShopifyCart(cartId: string, lineId: string, signal?: AbortSignal): Promise<{ success: boolean; cartNotFound?: boolean }> {
  const data = await storefrontApiRequest(CART_LINES_REMOVE_MUTATION, { cartId, lineIds: [lineId] }, { signal });
  if (!data?.data?.cartLinesRemove) return { success: false };
  const userErrors = data.data.cartLinesRemove.userErrors || [];
  if (isCartNotFoundError(userErrors)) return { success: false, cartNotFound: true };
  if (userErrors.length > 0) return { success: false };
  return { success: true };
}

/** Shared error logger: pulls structured fields off ShopifyError instead
 * of relying on `err.message` string inspection. Keeps the console.error
 * behaviour the store has always had while surfacing status/code for
 * debugging without breaking existing Sentry breadcrumbs. */
function logCartError(action: string, err: unknown): void {
  if (err instanceof ShopifyError) {
    console.error(`Failed to ${action}:`, {
      name: err.name,
      status: err.status,
      code: err.code,
      retryable: err.retryable,
      message: err.message,
    });
    return;
  }
  console.error(`Failed to ${action}:`, err);
}

interface CartStore {
  items: CartItem[];
  cartId: string | null;
  checkoutUrl: string | null;
  isLoading: boolean;
  isSyncing: boolean;
  addItem: (item: Omit<CartItem, 'lineId'>, signal?: AbortSignal) => Promise<void>;
  updateQuantity: (variantId: string, quantity: number, signal?: AbortSignal) => Promise<void>;
  removeItem: (variantId: string, signal?: AbortSignal) => Promise<void>;
  clearCart: () => void;
  syncCart: (signal?: AbortSignal) => Promise<void>;
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

      /** Add a line to the Shopify cart. Creates the cart lazily on first
       * add. Serialized per-variant to avoid duplicate-charge races. Accepts
       * an optional AbortSignal so callers can cancel on unmount. */
      addItem: async (item, signal) => {
        // Serialize the "no cart yet, create one" path so parallel clicks
        // don't each kick off their own createShopifyCart.
        if (!get().cartId && pendingCartCreation) {
          await pendingCartCreation;
        }
        // Serialize same-variant re-clicks so the increment branch sees
        // the prior committed quantity instead of a stale read. Customizer
        // adds (lineAttributes present) get a unique slot key per call so
        // two distinct designs for the same variant don't serialize on
        // each other (they're independent lines, not a quantity bump).
        const slotKey = item.lineAttributes && item.lineAttributes.length > 0
          ? `${item.variantId}::custom::${Math.random().toString(36).slice(2)}`
          : item.variantId;
        const prior = pendingAdds.get(slotKey);
        if (prior) await prior;
        let release!: () => void;
        const slot = new Promise<void>(resolve => { release = resolve; });
        pendingAdds.set(slotKey, slot);
        const { items, cartId, clearCart } = get();
        // Match against the existing line by variantId — but ONLY when
        // neither side carries line-level attributes. Two customized
        // designs of the same variant (different logos / placements) are
        // independent lines and must never merge or one of them silently
        // overwrites the other's attributes on the production team's
        // order view.
        const existingItem = (item.lineAttributes && item.lineAttributes.length > 0)
          ? undefined
          : items.find(i => i.variantId === item.variantId && (!i.lineAttributes || i.lineAttributes.length === 0));
        set({ isLoading: true });
        // Tracks whether the Shopify side committed the line. Used to
        // gate Phase 3.1 cart-drawer auto-open + Phase 3.3 error toast.
        let shopifyAddSucceeded = false;
        // Set when this call recursed (orphan-line / cartNotFound recovery
        // paths) — the inner call handles notifications, so the outer
        // finally skips them to avoid double-toast / double-open.
        let delegatedToRecursion = false;
        try {
          if (!cartId) {
            pendingCartCreation = (async () => {
              const result = await createShopifyCart({ ...item, lineId: null }, signal);
              if (result) {
                set({ cartId: result.cartId, checkoutUrl: result.checkoutUrl, items: [{ ...item, lineId: result.lineId }] });
                // Phase 4.1 — mirror the new cartId so the Checkout retry
                // loop has something to resolve even if zustand-persist
                // hasn't flushed yet (the persist write is async).
                writeCartIdMirror(result.cartId);
                shopifyAddSucceeded = true;
              }
            })();
            try { await pendingCartCreation; } finally { pendingCartCreation = null; }
          } else if (existingItem) {
            const newQuantity = existingItem.quantity + item.quantity;
            if (!existingItem.lineId) {
              // Orphan local line (persisted from an older build before
              // we refused to commit without a lineId). Treat it as a
              // fresh add so the user's click actually registers, then
              // drop the orphan so the cart doesn't show the variant
              // twice. Previously this path silently `return`ed, which
              // made the add button feel broken on affected sessions.
              set({ items: get().items.filter(i => i.variantId !== item.variantId) });
              if (pendingAdds.get(slotKey) === slot) pendingAdds.delete(slotKey);
              release();
              set({ isLoading: false });
              delegatedToRecursion = true;
              await get().addItem(item, signal);
              return;
            }
            const result = await updateShopifyCartLine(cartId, existingItem.lineId, newQuantity, signal);
            if (result.success) {
              set({ items: get().items.map(i => i.variantId === item.variantId ? { ...i, quantity: newQuantity } : i) });
              shopifyAddSucceeded = true;
            } else if (result.cartNotFound) {
              // Session expired. Wipe the stale cartId and retry as a
              // fresh-cart create so the user's latest click isn't just
              // silently swallowed. (See the no-cartId branch above.)
              clearCart();
              set({ isLoading: false });
              // Release our per-variant slot BEFORE the recursive call or
              // the inner addItem awaits the slot we're still holding.
              if (pendingAdds.get(slotKey) === slot) pendingAdds.delete(slotKey);
              release();
              delegatedToRecursion = true;
              await get().addItem(item, signal);
              return;
            }
          } else {
            const result = await addLineToShopifyCart(cartId, { ...item, lineId: null }, signal);
            if (result.success && result.lineId) {
              // Only commit to local state when we got a real lineId back —
              // without it the item can't be updated/removed later, leaving
              // the cart in a state where users see the item but can't touch it.
              set({ items: [...get().items, { ...item, lineId: result.lineId }] });
              shopifyAddSucceeded = true;
            } else if (result.cartNotFound) {
              // Same recovery as the update path — clear the dead cart
              // and retry so the user's add actually lands. Without
              // this, clicking Add on an expired session wiped the
              // cart and returned silently with nothing added.
              clearCart();
              set({ isLoading: false });
              if (pendingAdds.get(slotKey) === slot) pendingAdds.delete(slotKey);
              release();
              delegatedToRecursion = true;
              await get().addItem(item, signal);
              return;
            }
          }
        } catch (error) {
          // Branch on ShopifyError shape instead of string-sniffing. The
          // optimistic-rollback structure is unchanged — we still only log
          // and bail, but now with status/code context and a retryable hint
          // that future rollback paths can consult via isRetryable().
          logCartError('add item', error);
          if (isRetryable(error)) {
            // Marker for downstream rollback paths: log that the caller
            // could safely retry. We don't auto-retry here to preserve
            // existing UX (user click → one attempt).
            console.debug('[cartStore] addItem hit a retryable error; caller may retry');
          }
        } finally {
          set({ isLoading: false });
          if (pendingAdds.get(slotKey) === slot) {
            pendingAdds.delete(slotKey);
          }
          release();
          // Phase 3.1 — pop the cart drawer open on a successful Shopify
          // add so the customer sees confirmation without a page nav.
          // Skip the recursion-recovery pass; the inner call handles it.
          // Phase 3.3 — surface a toast on terminal failure so silent
          // logCartError() bails don't leave the customer wondering why
          // their click did nothing. Suppressed in the recursion-recovery
          // path for the same reason as auto-open above.
          if (!delegatedToRecursion) {
            if (shopifyAddSucceeded) {
              try { useUiStore.getState().openCartDrawer(); } catch { /* non-fatal */ }
            } else {
              try {
                toast.error(
                  'Impossible d’ajouter au panier — vérifie ta connexion et réessaie. Si le problème persiste, appelle le 367-380-4808.',
                );
              } catch { /* non-fatal */ }
            }
          }
        }
      },

      /** Update the quantity of an existing cart line. Routes to removeItem
       * when quantity drops to zero. No-op if the line has no Shopify id
       * or no active cart. */
      updateQuantity: async (variantId, quantity, signal) => {
        if (quantity <= 0) { await get().removeItem(variantId, signal); return; }
        const { items, cartId, clearCart } = get();
        const item = items.find(i => i.variantId === variantId);
        if (!item?.lineId || !cartId) return;
        set({ isLoading: true });
        try {
          const result = await updateShopifyCartLine(cartId, item.lineId, quantity, signal);
          if (result.success) {
            set({ items: get().items.map(i => i.variantId === variantId ? { ...i, quantity } : i) });
          } else if (result.cartNotFound) clearCart();
        } catch (error) {
          logCartError('update quantity', error);
        } finally {
          set({ isLoading: false });
        }
      },

      /** Remove a line from the cart. Clears the whole cart state once
       * the last line is gone so the next add takes the fresh-cart path. */
      removeItem: async (variantId, signal) => {
        const { items, cartId, clearCart } = get();
        const item = items.find(i => i.variantId === variantId);
        if (!item?.lineId || !cartId) return;
        set({ isLoading: true });
        try {
          const result = await removeLineFromShopifyCart(cartId, item.lineId, signal);
          if (result.success) {
            const newItems = get().items.filter(i => i.variantId !== variantId);
            if (newItems.length === 0) clearCart();
            else set({ items: newItems });
          } else if (result.cartNotFound) clearCart();
        } catch (error) {
          logCartError('remove item', error);
        } finally {
          set({ isLoading: false });
        }
      },

      /** Drop all local cart state. Does not touch Shopify — use this
       * after Shopify reports the cart is gone (cartNotFound) or on
       * explicit user clear. Also wipes the dedicated cartId mirror
       * so a stale id can't outlive the cart it pointed to. */
      clearCart: () => { set({ items: [], cartId: null, checkoutUrl: null }); writeCartIdMirror(null); },
      /** Checkout URL captured at cart-create time (already channel-tagged). */
      getCheckoutUrl: () => get().checkoutUrl,

      /** Re-read the Shopify cart to detect server-side drainage (e.g.
       * checkout completed in another tab). Clears local state if the
       * server cart is empty or gone. */
      syncCart: async (signal) => {
        const { cartId, isSyncing, clearCart } = get();
        if (!cartId || isSyncing) return;
        set({ isSyncing: true });
        try {
          const data = await storefrontApiRequest(CART_QUERY, { id: cartId }, { signal });
          if (!data) return;
          const cart = data?.data?.cart;
          if (!cart || cart.totalQuantity === 0) clearCart();
        } catch (error) {
          logCartError('sync cart', error);
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
        // Phase 4.1 — coexist with the dedicated cartId mirror. If the
        // zustand-persist envelope has no cartId (older session, blob
        // got cleared) but the dedicated mirror does, adopt it so the
        // checkout retry loop has something real to land on. Inversely,
        // if zustand has a cartId but the mirror is missing, write the
        // mirror — keeps the two layers from drifting apart.
        if (!state.cartId) {
          const mirror = readCartIdMirror();
          if (mirror) state.cartId = mirror;
        } else {
          writeCartIdMirror(state.cartId);
        }
      },
    }
  )
);

/** Public state shape for consumers that need to type `useCartStore.getState()`
 * results (e.g. snapshot selectors in tests, or non-React integrations). */
export type CartStoreState = ReturnType<typeof useCartStore.getState>;
