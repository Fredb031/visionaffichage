/**
 * compareStore — Volume II §15 product comparison tool.
 *
 * Tracks up to 3 SKUs that the user has flagged for side-by-side
 * comparison. Persists to localStorage under `va:compare` so the
 * selection survives reloads and PDP round-trips. Capped at 3 items
 * (matches the brief's COMPARE_FIELDS table width).
 *
 * Every storage touch is wrapped in try/catch — Safari private mode,
 * a quota-exceeded write, or a corrupted JSON blob shouldn't crash
 * the whole bundle just because the compare bar wanted to remember
 * something. Fall back to in-memory state on read failures.
 */
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

export const COMPARE_MAX = 3;
export const COMPARE_STORAGE_KEY = 'va:compare';

export interface CompareStore {
  items: string[]; // SKUs, max 3
  add: (sku: string) => void;
  remove: (sku: string) => void;
  toggle: (sku: string) => void;
  clear: () => void;
  has: (sku: string) => boolean;
  isFull: () => boolean;
}

export const useCompareStore = create<CompareStore>()(
  persist(
    (set, get) => ({
      items: [],
      add: (sku) => {
        // Trim + reject empty: the rehydrate filter only strips empty
        // strings, so a `' SKU '` slipping in via a non-CompareToggleButton
        // caller would otherwise sit alongside a clean `'SKU'` as a
        // duplicate (items.includes() compares by exact string), and
        // has() would silently miss it. Normalise once at the boundary.
        if (typeof sku !== 'string') return;
        const clean = sku.trim();
        if (clean.length === 0) return;
        const { items } = get();
        if (items.includes(clean)) return;
        if (items.length >= COMPARE_MAX) return;
        set({ items: [...items, clean] });
      },
      remove: (sku) => {
        set({ items: get().items.filter(s => s !== sku) });
      },
      toggle: (sku) => {
        if (typeof sku !== 'string') return;
        const clean = sku.trim();
        if (clean.length === 0) return;
        const { items } = get();
        if (items.includes(clean)) {
          set({ items: items.filter(s => s !== clean) });
        } else if (items.length < COMPARE_MAX) {
          set({ items: [...items, clean] });
        }
      },
      clear: () => set({ items: [] }),
      has: (sku) => get().items.includes(sku),
      isFull: () => get().items.length >= COMPARE_MAX,
    }),
    {
      name: COMPARE_STORAGE_KEY,
      storage: createJSONStorage(() => ({
        getItem: (name) => {
          try { return localStorage.getItem(name); } catch { return null; }
        },
        setItem: (name, value) => {
          try { localStorage.setItem(name, value); } catch { /* ignore */ }
        },
        removeItem: (name) => {
          try { localStorage.removeItem(name); } catch { /* ignore */ }
        },
      })),
      partialize: (state) => ({ items: state.items }),
      // Defensive on rehydrate — drop any non-string entries and trim
      // back down to COMPARE_MAX so a corrupted blob can't poison the
      // bar with 50 phantom rows.
      onRehydrateStorage: () => (state) => {
        if (!state) return;
        if (Array.isArray(state.items)) {
          const clean = Array.from(
            new Set(
              state.items.filter(
                (s): s is string => typeof s === 'string' && s.length > 0
              )
            )
          ).slice(0, COMPARE_MAX);
          state.items = clean;
        } else {
          state.items = [];
        }
      },
    }
  )
);
