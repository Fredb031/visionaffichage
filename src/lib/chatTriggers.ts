/**
 * Mega Blueprint Section 3.2 — proactive AI chat triggers.
 *
 * Opens the existing chat panel with a pre-filled prompt at four
 * conversion-critical moments. Each trigger fires at most once per
 * browser session (sessionStorage gated) so we never nag.
 *
 * The "fire chat" effect is delivered via a CustomEvent
 * (`va:chat-prefill`) on `window` with `{ message: string }`. The
 * AIChatPanel listens for this event, opens itself, and posts the
 * prefilled message as a fresh assistant suggestion. Using an event
 * instead of a direct ref keeps this hook decoupled from the chat
 * implementation — the chat is lazy-loaded, may not be mounted yet,
 * and we don't want to bundle this trigger logic into its chunk.
 *
 * Real-LLM swap (Section 3.1) is an operator follow-up that needs
 * an Anthropic API key — see project docs.
 */
import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { useCustomizerStore } from '@/stores/customizerStore';

/** sessionStorage key prefix — one bucket per trigger name. */
const SESSION_KEY_PREFIX = 'va:chat-trigger:';
/** localStorage flag: have we ever shown the first-visit greeting? */
const FIRST_VISIT_GREETED = 'va:chat-greeted';
/** localStorage flag: has the user visited at least once already?
 * Set on first eligible homepage view; presence bypasses the
 * first-visit greeting on subsequent loads. */
const VISITED_FLAG = 'va:visited';

/** Window event name the chat panel listens for. */
export const CHAT_PREFILL_EVENT = 'va:chat-prefill';

/** Idle delay (ms) before the product-page idle trigger fires. */
const PRODUCT_IDLE_DELAY_MS = 45_000;
/** Delay (ms) before the customizer no-upload trigger fires. */
const CUSTOMIZER_NO_UPLOAD_DELAY_MS = 60_000;
/** Delay (ms) before the cart no-checkout trigger fires. */
const CART_IDLE_DELAY_MS = 30_000;
/** Delay (ms) before the first-visit greeting fires. */
const FIRST_VISIT_DELAY_MS = 20_000;

/** Guard a session-scoped trigger so it only fires once per tab. */
function alreadyFired(name: string): boolean {
  try {
    return sessionStorage.getItem(SESSION_KEY_PREFIX + name) === '1';
  } catch {
    // private mode / storage disabled — fall back to allowing the
    // trigger; worst case the user sees it twice in the same session.
    return false;
  }
}

function markFired(name: string): void {
  try {
    sessionStorage.setItem(SESSION_KEY_PREFIX + name, '1');
  } catch {
    /* private mode — no-op */
  }
}

function readLocalFlag(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeLocalFlag(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* private mode — no-op */
  }
}

/** Dispatch the prefill event. The panel listener handles open + message. */
function firePrefill(message: string): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(CHAT_PREFILL_EVENT, { detail: { message } }));
}

/**
 * Wire four proactive chat triggers to the current location + interaction
 * signals. Mount once near the router root.
 *
 * Triggers (each fires once per session):
 *   1. Product page (/product/*) — 45 s with no click/scroll input.
 *   2. Customizer modal open — 60 s without a logo upload.
 *   3. Cart (/cart, /panier) — 30 s without checkout click.
 *   4. First visit on home — 20 s after load, gated on localStorage.
 */
export function useChatTriggers(): void {
  const location = useLocation();
  // Snapshot logoPlacement state — non-null preview/processed URLs on
  // either side mean the user has already uploaded, so the customizer
  // trigger should be skipped.
  const logoFront = useCustomizerStore(s => s.logoPlacement);
  const logoBack = useCustomizerStore(s => s.logoPlacementBack);
  const hasLogo =
    !!(logoFront?.previewUrl || logoFront?.processedUrl) ||
    !!(logoBack?.previewUrl || logoBack?.processedUrl);

  // Track interaction so the product-page idle trigger can reset on
  // user input. Stored in a ref so the effect's setTimeout closure
  // can read the latest value without re-binding listeners.
  const lastInteractionRef = useRef<number>(Date.now());

  useEffect(() => {
    const onActivity = () => {
      lastInteractionRef.current = Date.now();
    };
    window.addEventListener('click', onActivity, { passive: true });
    window.addEventListener('scroll', onActivity, { passive: true });
    window.addEventListener('keydown', onActivity, { passive: true });
    window.addEventListener('touchstart', onActivity, { passive: true });
    return () => {
      window.removeEventListener('click', onActivity);
      window.removeEventListener('scroll', onActivity);
      window.removeEventListener('keydown', onActivity);
      window.removeEventListener('touchstart', onActivity);
    };
  }, []);

  // ---- Trigger 1: Product page 45 s idle ---------------------------------
  useEffect(() => {
    // Match either /product/* (canonical) or /produit/* (FR alias if added later).
    const isProduct = /^\/(product|produit)\//.test(location.pathname);
    if (!isProduct) return;
    if (alreadyFired('product-idle')) return;

    // Reset interaction timestamp on entry so a long-idle user from the
    // previous page doesn't insta-fire on PDP load.
    lastInteractionRef.current = Date.now();

    const timer = window.setTimeout(() => {
      const idleFor = Date.now() - lastInteractionRef.current;
      if (idleFor >= PRODUCT_IDLE_DELAY_MS) {
        firePrefill('Tu as des questions sur ce produit ? Je suis là.');
        markFired('product-idle');
      }
    }, PRODUCT_IDLE_DELAY_MS);

    return () => window.clearTimeout(timer);
  }, [location.pathname]);

  // ---- Trigger 2: Customizer 60 s without upload -------------------------
  useEffect(() => {
    if (alreadyFired('customizer-no-upload')) return;
    // The customizer is a modal on PDP (no /customizer route). Detect by
    // observing the DOM for the modal's role=dialog with a known marker,
    // OR by reading store activity. Simplest reliable signal: the
    // customizer store's productId is set + step in 1..3, AND the user
    // is on a product route. That covers both the modal-open case and
    // a hypothetical future /customizer route.
    const isCustomizerRoute = /^\/(customizer|personnaliser)/.test(location.pathname);
    const isProductRoute = /^\/(product|produit)\//.test(location.pathname);
    if (!isCustomizerRoute && !isProductRoute) return;

    // If a logo was already uploaded before we mounted, skip entirely.
    if (hasLogo) return;

    const timer = window.setTimeout(() => {
      // Re-read the store at fire time — the user may have uploaded
      // during the 60 s window, in which case we don't suggest help.
      const fresh = useCustomizerStore.getState();
      const stillNoLogo =
        !(fresh.logoPlacement?.previewUrl || fresh.logoPlacement?.processedUrl) &&
        !(fresh.logoPlacementBack?.previewUrl || fresh.logoPlacementBack?.processedUrl);
      if (stillNoLogo) {
        firePrefill('Besoin d\u2019aide pour téléverser ton logo ? Je peux t\u2019aider.');
        markFired('customizer-no-upload');
      }
    }, CUSTOMIZER_NO_UPLOAD_DELAY_MS);

    return () => window.clearTimeout(timer);
    // hasLogo intentionally a dep — if the user uploads, we tear down
    // the timer so the trigger doesn't fire later in the same visit.
  }, [location.pathname, hasLogo]);

  // ---- Trigger 3: Cart 30 s without checkout click -----------------------
  useEffect(() => {
    const isCart = location.pathname === '/cart' || location.pathname === '/panier';
    if (!isCart) return;
    if (alreadyFired('cart-idle')) return;

    let clicked = false;
    const onClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target) return;
      // Look up the DOM for an element that links to or labels checkout.
      const matches = target.closest(
        'a[href*="checkout"], a[href*="commande"], button[data-checkout], [data-checkout]',
      );
      if (matches) clicked = true;
    };
    window.addEventListener('click', onClick, { capture: true });

    const timer = window.setTimeout(() => {
      if (!clicked) {
        firePrefill('Des questions avant de commander ? Livraison garantie en 5 jours.');
        markFired('cart-idle');
      }
    }, CART_IDLE_DELAY_MS);

    return () => {
      window.clearTimeout(timer);
      window.removeEventListener('click', onClick, { capture: true } as EventListenerOptions);
    };
  }, [location.pathname]);

  // ---- Trigger 4: First-visit 20 s on home -------------------------------
  useEffect(() => {
    if (location.pathname !== '/') return;
    if (alreadyFired('first-visit')) return;

    const greeted = readLocalFlag(FIRST_VISIT_GREETED);
    const visited = readLocalFlag(VISITED_FLAG);
    if (greeted === '1') return; // already greeted in a prior session
    if (visited === '1') {
      // Returning visitor without the greeted flag — they've been here
      // before, no first-visit greeting. But mark greeted so we don't
      // race-set it on a later entry.
      writeLocalFlag(FIRST_VISIT_GREETED, '1');
      return;
    }
    // First-ever visit: arm the 20 s timer, then mark visited regardless
    // of whether we end up firing (closing the tab in <20 s shouldn't
    // re-arm the greeting on next visit).
    writeLocalFlag(VISITED_FLAG, '1');

    const timer = window.setTimeout(() => {
      firePrefill('Bonjour ! Tu veux habiller ton équipe ? Je peux t\u2019aider en 2 minutes.');
      markFired('first-visit');
      writeLocalFlag(FIRST_VISIT_GREETED, '1');
    }, FIRST_VISIT_DELAY_MS);

    return () => window.clearTimeout(timer);
  }, [location.pathname]);
}
