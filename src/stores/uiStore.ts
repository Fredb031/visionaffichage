/**
 * uiStore — small zustand store for cross-cutting UI flags.
 *
 * Today this is just `cartDrawerOpen`. Phase 3.1 of the Vision Affichage
 * roadmap wants any add-to-cart action (whether from the customizer, a
 * quick-add ProductCard, or a future surface like CartRecommendations)
 * to slide the cart drawer open automatically — without forcing every
 * caller to thread an `onCartOpen` prop down through the tree.
 *
 * The CartDrawer is mounted per-page today (Index, Cart, Products,
 * ProductDetail each render their own `<CartDrawer isOpen={cartOpen}>`).
 * Rather than rip those out (some are owned by other agents), the
 * drawer also listens to this store and considers itself open whenever
 * EITHER its `isOpen` prop OR `ui.cartDrawerOpen` is true. That keeps
 * existing Navbar → setCartOpen click flows working unchanged while
 * giving cartStore.addItem a way to pop it open from anywhere.
 *
 * No persistence — drawer state shouldn't leak across sessions.
 */
import { create } from 'zustand';

/**
 * Public shape of the UI store. Exported so consumers (selectors,
 * test harnesses, future hooks) can type their accessors precisely
 * instead of leaning on `ReturnType<typeof useUiStore.getState>`.
 */
export interface UiStore {
  /** True when the global cart drawer should be open. Set by cartStore
   * on a successful addItem and cleared by the drawer's onClose. */
  cartDrawerOpen: boolean;
  openCartDrawer: () => void;
  closeCartDrawer: () => void;
}

export const useUiStore = create<UiStore>((set, get) => ({
  cartDrawerOpen: false,
  // Idempotent guards — `cartStore.addItem` fires `openCartDrawer` on
  // every successful add, and rapid double-adds (or a customizer that
  // re-adds on prop change) used to write `{ cartDrawerOpen: true }`
  // again and again. Each `set` notifies every subscriber: CartDrawer
  // re-evaluates its selector, and any future surface listening to
  // `cartDrawerOpen` re-runs for nothing. Skipping the write when
  // already in the target state keeps the no-op path truly free, and
  // also prevents a closeCartDrawer() called from a drawer that was
  // only opened via prop (not the store) from flipping the store flag
  // from `false` → `false` and waking unrelated subscribers.
  openCartDrawer: () => {
    if (!get().cartDrawerOpen) set({ cartDrawerOpen: true });
  },
  closeCartDrawer: () => {
    if (get().cartDrawerOpen) set({ cartDrawerOpen: false });
  },
}));
