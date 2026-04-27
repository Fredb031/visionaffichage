import { useEffect, useRef, useState } from "react";
import { useLocation } from "react-router-dom";

/**
 * Vision Affichage Volume II §3.2 — Social Proof Notification.
 *
 * A small "Pierre de Laval vient de commander..." pill anchored bottom-left
 * that fires every 45-90s from a curated 8-entry pool. Hard-capped at
 * 3 fires per session (sessionStorage) so it never tips into spam, and
 * suppressed entirely on /checkout and /admin/* — anxiety zones where
 * extra movement chips away at conversion.
 *
 * Respects prefers-reduced-motion: the pill still appears (the social
 * proof signal is the value, not the slide animation), but rendered
 * static, no transform.
 */

type Order = {
  name: string;
  city: string;
  qty: number;
  item: string;
};

const RECENT_ORDERS: ReadonlyArray<Order> = [
  { name: "Pierre", city: "Laval", qty: 12, item: "t-shirts" },
  { name: "Marc", city: "Blainville", qty: 6, item: "hoodies" },
  { name: "Sophie", city: "Montréal", qty: 24, item: "polos" },
  { name: "Jean-Philippe", city: "Québec", qty: 8, item: "vestes" },
  { name: "Kevin", city: "Longueuil", qty: 18, item: "casquettes" },
  { name: "Annie", city: "Brossard", qty: 5, item: "t-shirts" },
  { name: "Patrick", city: "Trois-Rivières", qty: 36, item: "t-shirts" },
  { name: "Luc", city: "Sherbrooke", qty: 10, item: "hoodies" },
];

const MAX_PER_SESSION = 3;
const MIN_DELAY_MS = 45_000;
const MAX_DELAY_MS = 90_000;
const DISMISS_AFTER_MS = 5_000;
const SESSION_KEY = "vis_social_proof_fires";

const randomDelay = () =>
  Math.floor(Math.random() * (MAX_DELAY_MS - MIN_DELAY_MS + 1)) + MIN_DELAY_MS;

const readFireCount = (): number => {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    const n = raw ? parseInt(raw, 10) : 0;
    return Number.isFinite(n) && n >= 0 ? n : 0;
  } catch {
    return 0;
  }
};

const writeFireCount = (n: number): void => {
  try {
    sessionStorage.setItem(SESSION_KEY, String(n));
  } catch {
    // sessionStorage unavailable (private mode, SSR) — fail open, the
    // in-memory state below still caps the session for this tab.
  }
};

const isSuppressedPath = (pathname: string): boolean =>
  pathname === "/checkout" ||
  pathname.startsWith("/checkout/") ||
  pathname.startsWith("/admin");

const prefersReducedMotion = (): boolean => {
  if (typeof window === "undefined" || !window.matchMedia) return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
};

export const SocialProofNotification = () => {
  const location = useLocation();
  const [order, setOrder] = useState<Order | null>(null);
  const [visible, setVisible] = useState(false);
  const fireCountRef = useRef<number>(readFireCount());
  const scheduleTimerRef = useRef<number | null>(null);
  const dismissTimerRef = useRef<number | null>(null);
  const reduceMotionRef = useRef<boolean>(prefersReducedMotion());

  const suppressed = isSuppressedPath(location.pathname);

  useEffect(() => {
    // Re-check reduced motion on each mount in case the user toggled it.
    reduceMotionRef.current = prefersReducedMotion();

    const clearTimers = () => {
      if (scheduleTimerRef.current !== null) {
        window.clearTimeout(scheduleTimerRef.current);
        scheduleTimerRef.current = null;
      }
      if (dismissTimerRef.current !== null) {
        window.clearTimeout(dismissTimerRef.current);
        dismissTimerRef.current = null;
      }
    };

    if (suppressed) {
      // Anxiety zone — hide anything currently on screen and don't
      // queue future fires while the operator is mid-checkout/admin.
      clearTimers();
      setVisible(false);
      return;
    }

    const fire = () => {
      if (fireCountRef.current >= MAX_PER_SESSION) return;
      const next =
        RECENT_ORDERS[Math.floor(Math.random() * RECENT_ORDERS.length)];
      setOrder(next);
      setVisible(true);
      fireCountRef.current += 1;
      writeFireCount(fireCountRef.current);

      dismissTimerRef.current = window.setTimeout(() => {
        setVisible(false);
        // Schedule the next fire after auto-dismiss.
        if (fireCountRef.current < MAX_PER_SESSION) {
          scheduleTimerRef.current = window.setTimeout(fire, randomDelay());
        }
      }, DISMISS_AFTER_MS);
    };

    if (fireCountRef.current < MAX_PER_SESSION) {
      scheduleTimerRef.current = window.setTimeout(fire, randomDelay());
    }

    return clearTimers;
  }, [suppressed]);

  if (suppressed || !visible || !order) return null;

  const handleDismiss = () => {
    if (dismissTimerRef.current !== null) {
      window.clearTimeout(dismissTimerRef.current);
      dismissTimerRef.current = null;
    }
    setVisible(false);
    // Even on manual dismiss, queue the next one so the rotation
    // continues until the cap is reached.
    if (fireCountRef.current < MAX_PER_SESSION) {
      // Self-referential rotation: each fire chains the next so the
      // cadence keeps running after a manual dismiss, matching the
      // behavior of the primary fire() loop in the mount effect.
      const fireAndChain = () => {
        // Re-check the cap at fire-time: another tab in the same
        // session may have written to sessionStorage between schedule
        // and fire, pushing us past the per-session limit.
        const live = Math.max(fireCountRef.current, readFireCount());
        if (live >= MAX_PER_SESSION) {
          fireCountRef.current = live;
          return;
        }
        const next =
          RECENT_ORDERS[Math.floor(Math.random() * RECENT_ORDERS.length)];
        setOrder(next);
        setVisible(true);
        fireCountRef.current = live + 1;
        writeFireCount(fireCountRef.current);
        dismissTimerRef.current = window.setTimeout(() => {
          setVisible(false);
          if (fireCountRef.current < MAX_PER_SESSION) {
            scheduleTimerRef.current = window.setTimeout(
              fireAndChain,
              randomDelay(),
            );
          }
        }, DISMISS_AFTER_MS);
      };
      scheduleTimerRef.current = window.setTimeout(fireAndChain, randomDelay());
    }
  };

  const reduce = reduceMotionRef.current;

  return (
    <div
      role="status"
      aria-live="polite"
      className={[
        "fixed bottom-4 left-4 z-30 max-w-[280px]",
        "bg-white rounded-full shadow-lg border border-zinc-200",
        "pl-4 pr-2 py-2 flex items-center gap-2",
        reduce ? "" : "animate-[social-proof-slide-in_0.35s_ease-out]",
      ].join(" ")}
      style={
        reduce
          ? undefined
          : ({
              // Inline keyframes via Tailwind arbitrary animation name
              // require the keyframes to exist somewhere; we use a
              // CSS-in-style fallback so the component is self-contained
              // even if the global stylesheet doesn't define them.
              ["--social-proof-translate" as string]: "0",
            } as React.CSSProperties)
      }
    >
      <span
        aria-hidden="true"
        className="inline-block w-2 h-2 rounded-full bg-emerald-500 flex-shrink-0"
      />
      <p className="text-xs text-zinc-700 leading-snug flex-1">
        <span className="font-semibold text-zinc-900">{order.name}</span>
        {" de "}
        <span className="font-semibold text-zinc-900">{order.city}</span>
        {" vient de commander "}
        <span className="font-semibold text-zinc-900">
          {order.qty} {order.item}
        </span>
      </p>
      <button
        type="button"
        onClick={handleDismiss}
        aria-label="Fermer"
        className="flex-shrink-0 w-6 h-6 rounded-full hover:bg-zinc-100 text-zinc-400 hover:text-zinc-700 transition-colors flex items-center justify-center text-sm leading-none"
      >
        ×
      </button>
      {!reduce && (
        <style>{`
          @keyframes social-proof-slide-in {
            from { transform: translateX(-120%); opacity: 0; }
            to { transform: translateX(0); opacity: 1; }
          }
        `}</style>
      )}
    </div>
  );
};

export default SocialProofNotification;
