import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { PRODUCTS, PRINT_PRICE, BULK_DISCOUNT_THRESHOLD, BULK_DISCOUNT_RATE } from '@/data/products';
import type { CustomizationState, LogoPlacement, PlacementSides, ProductView, TextAsset } from '@/types/customization';

interface CustomizerStore extends CustomizationState {
  setProduct: (productId: string) => void;
  setColor: (colorId: string) => void;
  setLogoPlacement: (placement: LogoPlacement | null) => void;
  setLogoPlacementBack: (placement: LogoPlacement | null) => void;
  setPlacementSides: (sides: PlacementSides) => void;
  setTextAssets: (assets: TextAsset[]) => void;
  setSizeQuantity: (size: string, quantity: number) => void;
  setView: (view: ProductView) => void;
  setStep: (step: CustomizationState['step']) => void;
  getTotalQuantity: () => number;
  getEstimatedPrice: () => number;
  hasCustomizations: () => boolean;
  reset: () => void;
}

const initialState: CustomizationState = {
  productId: null,
  colorId: null,
  logoPlacement: null,
  logoPlacementBack: null,
  placementSides: 'front',
  textAssets: [],
  sizeQuantities: [],
  activeView: 'front',
  step: 1,
};

export const useCustomizerStore = create<CustomizerStore>()(
  persist(
    (set, get) => ({
      ...initialState,

      /** Switch the customizer to a different product and reset every
       * derived choice (color, logos, text, sizes, view, step). */
      setProduct: (productId) => set({
        productId, colorId: null,
        logoPlacement: null, logoPlacementBack: null,
        placementSides: 'front',
        textAssets: [],
        sizeQuantities: [],
        // Reset the view + step too — otherwise opening product B
        // after customizing the BACK of product A showed product B's
        // back view (wrong default), and if user was at step 3 on
        // product A, the step indicator started at 3 on product B
        // with no logo uploaded. Both are surface-level glitches
        // that go away once the view/step derive from the fresh state.
        activeView: 'front',
        step: 1,
      }),
      /** Pick a product color by slug id (e.g. "black", "true-royal").
       * Rejects empty / non-string inputs so a bad UI wire-up can't
       * persist `colorId: ''` and silently break the "find color" lookup
       * downstream in the canvas + cart. */
      setColor: (colorId) => {
        if (typeof colorId !== 'string' || !colorId) return;
        set({ colorId });
      },
      /** Set the front-side logo placement (null clears it). */
      setLogoPlacement: (placement) => set({ logoPlacement: placement }),
      /** Set the back-side logo placement (null clears it). */
      setLogoPlacementBack: (placement) => set({ logoPlacementBack: placement }),
      /** Choose which sides get printed ('none' | 'front' | 'back' | 'both'). */
      setPlacementSides: (placementSides) => set({ placementSides }),
      /** Replace the list of canvas text captions. */
      setTextAssets: (textAssets) => set({ textAssets }),

      /** Upsert a (size, quantity) row. Guards non-finite / negative
       * quantities so downstream pricing math can't be NaN-poisoned by
       * a stray input event (e.g. a blur that fires with NaN from an
       * empty <input type="number">). quantity === 0 removes the row. */
      setSizeQuantity: (size, quantity) =>
        set((state) => {
          if (typeof size !== 'string' || !size) return {};
          const q = Math.floor(Number(quantity));
          if (!Number.isFinite(q) || q < 0) return {};
          const existing = state.sizeQuantities.filter((s) => s.size !== size);
          if (q > 0) return { sizeQuantities: [...existing, { size, quantity: q }] };
          return { sizeQuantities: existing };
        }),

      /** Toggle the visible canvas face (front / back). */
      setView: (activeView) => set({ activeView }),
      /** Jump the wizard to a specific step (1..3). Clamps out-of-range
       * values rather than letting a stray caller (URL param, devtools,
       * untyped JS consumer) land step=0 or step=99 — same blank-modal
       * failure mode that onRehydrateStorage already defends against. */
      setStep: (step) => {
        const n = Math.floor(Number(step));
        if (!Number.isFinite(n)) return;
        const clamped = Math.max(1, Math.min(3, n)) as 1 | 2 | 3;
        set({ step: clamped });
      },

      /** Sum of quantities across all size rows. NaN-guarded so a malformed
       * row (devtools edit, cross-version state imported via setState before
       * onRehydrateStorage runs) can't poison downstream pricing math. */
      getTotalQuantity: () =>
        get().sizeQuantities.reduce(
          (sum, s) => sum + (Number.isFinite(s?.quantity) ? s.quantity : 0),
          0,
        ),

      /** Running price estimate including print fee + bulk discount. */
      getEstimatedPrice: () => {
        const { productId, sizeQuantities } = get();
        if (!productId) return 0;
        const product = PRODUCTS.find((p) => p.id === productId);
        if (!product) return 0;
        // Same NaN guard as getTotalQuantity — an unfinite quantity here
        // cascades to total*unitBase*discount and the estimate renders as
        // "$NaN" on the customizer summary instead of a real number.
        const total = sizeQuantities.reduce(
          (sum, s) => sum + (Number.isFinite(s?.quantity) ? s.quantity : 0),
          0,
        );
        const unitBase = product.basePrice + PRINT_PRICE;
        const discount = total >= BULK_DISCOUNT_THRESHOLD ? 1 - BULK_DISCOUNT_RATE : 1;
        return parseFloat((total * unitBase * discount).toFixed(2));
      },

      /** True once the user has picked a color, uploaded a logo on either
       * side, added a caption, or entered any size quantity. Consumers
       * can bind this to a "Reset" button's `disabled` state so the
       * button is dormant on a pristine flow. */
      hasCustomizations: () => {
        const s = get();
        if (s.colorId) return true;
        if (s.logoPlacement?.previewUrl || s.logoPlacement?.processedUrl) return true;
        if (s.logoPlacementBack?.previewUrl || s.logoPlacementBack?.processedUrl) return true;
        if (Array.isArray(s.textAssets) && s.textAssets.length > 0) return true;
        if (Array.isArray(s.sizeQuantities) && s.sizeQuantities.some((q) => q.quantity > 0)) return true;
        return false;
      },

      /** Wipe all customization back to `initialState`.
       * NOTE: this is a pure state mutation — user-facing "Reset"
       * buttons should gate this behind a `window.confirm(...)` in
       * the UI layer (see ProductCustomizer) so a stray click doesn't
       * erase an in-progress design. */
      reset: () => set(initialState),
    }),
    {
      name: 'va-customizer',
      storage: createJSONStorage(() => localStorage),
      version: 3,
      // Migrate old persisted state across the two step-count rewrites:
      //   v1 (5 steps: Color/Logo/Where/Sizes/Review)
      //   v2 (4 steps: Logo/Where/Sizes/Review)
      //   v3 (3 steps: Design/Sizes/Récap) — Logo+Where merged into Design
      //
      // v1 → v2 mapping: step N → max(1, N-1).
      // v2 → v3 mapping: {1,2}→1 (both are now "Design"), 3→2, 4→3.
      // Returning users land on the right screen instead of a blank modal.
      //
      // Always merge on top of initialState so new fields added later
      // (placementSides, activeView, logoPlacementBack) have a safe
      // default on disk. Without this, v1 users hydrated with undefined
      // for those fields, the canvas hit an undefined comparison, and
      // the customizer rendered blank until they re-set the product.
      migrate: (persisted: unknown, fromVersion: number) => {
        const state = persisted as Partial<CustomizationState> | null;
        if (!state) return initialState;
        const merged: CustomizationState = { ...initialState, ...state };
        let step = (state.step as unknown as number | undefined) ?? 1;
        if (fromVersion < 2) step = Math.max(1, step - 1); // v1 → v2
        if (fromVersion < 3) {
          // v2 (1..4) → v3 (1..3): Logo + Where collapse into Design.
          if (step <= 2) step = 1;
          else step = step - 1;
        }
        merged.step = Math.max(1, Math.min(3, step)) as 1 | 2 | 3;
        return merged;
      },
      // Don't persist the File blob — it isn't JSON-serializable and the
      // object URL it backs is revoked on unload anyway. We keep the
      // uploaded processedUrl (Supabase) + previewUrl so a reload still
      // shows the placed logo.
      //
      // Blob URLs are only valid for the session that created them. If
      // Supabase upload failed and we fell back to a blob previewUrl,
      // persisting it produces a DEAD reference after reload — the
      // canvas + cart render a broken image. Drop blob: previewUrls at
      // persist time and use processedUrl (if it isn't also blob:) as
      // the recovery URL so hydrated state renders something real.
      partialize: (state) => {
        const safe = (p: LogoPlacement | null) => {
          if (!p) return null;
          const clean = { ...p, originalFile: undefined } as LogoPlacement;
          const previewIsBlob = clean.previewUrl?.startsWith('blob:');
          const processedIsBlob = clean.processedUrl?.startsWith('blob:');
          if (previewIsBlob) {
            clean.previewUrl = processedIsBlob ? undefined : clean.processedUrl;
          }
          if (processedIsBlob) clean.processedUrl = clean.previewUrl;
          return clean;
        };
        return {
          productId: state.productId,
          colorId: state.colorId,
          logoPlacement: safe(state.logoPlacement),
          logoPlacementBack: safe(state.logoPlacementBack),
          placementSides: state.placementSides,
          textAssets: state.textAssets,
          sizeQuantities: state.sizeQuantities,
          activeView: state.activeView,
          step: state.step,
        };
      },
      // Coerce enum-like fields back to valid values on hydration.
      // A devtools edit or a cross-version upgrade could land step=7,
      // activeView='diagonal', or placementSides='side' on disk —
      // rendering then hit enum lookups that return undefined and
      // the customizer modal popped up blank. Clamp / fall back.
      onRehydrateStorage: () => (state) => {
        if (!state) return;
        if (typeof state.step !== 'number' || state.step < 1 || state.step > 3) {
          state.step = 1;
        }
        if (state.activeView !== 'front' && state.activeView !== 'back') {
          state.activeView = 'front';
        }
        const validSides = ['none', 'front', 'back', 'both'];
        if (!validSides.includes(state.placementSides)) {
          state.placementSides = 'front';
        }
        // Drop malformed sizeQuantity rows. A devtools edit / older build
        // could persist {size: 'M'} (no quantity) or quantity: NaN, which
        // would NaN-poison getTotalQuantity → getEstimatedPrice → the
        // entire price column on the customizer ("$NaN"). Coerce to a
        // finite, non-negative integer or drop the row.
        if (Array.isArray(state.sizeQuantities)) {
          state.sizeQuantities = state.sizeQuantities.flatMap(s => {
            if (!s || typeof s !== 'object') return [];
            if (typeof s.size !== 'string' || !s.size) return [];
            const q = Math.floor(Number(s.quantity));
            if (!Number.isFinite(q) || q <= 0) return [];
            return [{ size: s.size, quantity: q }];
          });
        } else {
          state.sizeQuantities = [];
        }
        if (!Array.isArray(state.textAssets)) state.textAssets = [];
      },
    },
  ),
);

/** Public type for consumers that want to reference the full store shape
 * (state + actions) without re-declaring it. Derived from the hook itself
 * so it stays in sync with the zustand definition above. */
export type CustomizerState = ReturnType<typeof useCustomizerStore.getState>;
