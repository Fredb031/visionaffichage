import { useEffect, useId, useMemo } from 'react';
import { Truck, Zap, Clock } from 'lucide-react';
import { DELIVERY_OPTIONS, type DeliveryOption } from '@/data/deliveryOptions';
import { readLS, writeLS } from '@/lib/storage';

// Section 5.1 — delivery-speed picker rendered below the cart subtotal.
// Three tiers: Standard (5d, included), Express (3d, +25%), Urgent (2d,
// +50%, Mon-Fri before 10am). Surcharge displays inline on the selected
// option so the buyer sees exactly what they're committing to before
// they hit Checkout. Selection persists to localStorage va:delivery-speed
// so a refresh / drawer-close doesn't lose their pick.
//
// UI-only for now: the actual Shopify variant for the rush surcharge is
// an operator follow-up. Until then we surface the commitment in the
// front-end summary + the order email, and the warehouse honours the
// shipping tier manually.
export const DELIVERY_SPEED_KEY = 'va:delivery-speed';

export type DeliverySpeedId = DeliveryOption['id'];

const ICONS: Record<DeliverySpeedId, typeof Truck> = {
  standard: Truck,
  rush: Zap,
  urgent: Clock,
};

interface Props {
  subtotal: number;
  value: DeliverySpeedId;
  onChange: (id: DeliverySpeedId) => void;
}

const fmtMoney = (n: number) =>
  (Number.isFinite(n) ? n : 0).toLocaleString('fr-CA', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

export function DeliverySpeedPicker({ subtotal, value, onChange }: Props) {
  // Persist on every change so the picker survives a refresh or a
  // navigation away from the cart. Hydration is the parent's job (see
  // loadDeliverySpeed below) so we don't double-write on mount.
  useEffect(() => {
    writeLS(DELIVERY_SPEED_KEY, value);
  }, [value]);

  const groupId = useId();

  // Mirror getDeliverySurcharge: clamp negative / non-finite subtotals once
  // so the inline display matches the cart total math exactly and a stale
  // value can never produce NaN or a negative surcharge. Lifted out of the
  // .map() below so it isn't recomputed for every option on every render.
  const safeSubtotal = useMemo(
    () => (Number.isFinite(subtotal) ? Math.max(0, subtotal) : 0),
    [subtotal],
  );

  return (
    <fieldset
      className="space-y-2 border-t border-border pt-3"
      aria-labelledby={`${groupId}-legend`}
    >
      <legend
        id={`${groupId}-legend`}
        className="font-extrabold text-sm uppercase tracking-wider text-muted-foreground mb-1"
      >
        Vitesse de livraison
      </legend>
      <div role="radiogroup" aria-labelledby={`${groupId}-legend`} className="space-y-2">
        {DELIVERY_OPTIONS.map((opt) => {
          const Icon = ICONS[opt.id];
          const surchargeAmount = safeSubtotal * opt.surcharge;
          const isActive = value === opt.id;
          const inputId = `${groupId}-${opt.id}`;
          return (
            <label
              key={opt.id}
              htmlFor={inputId}
              className={`relative flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-all focus-within:ring-2 focus-within:ring-[#0052CC]/40 focus-within:ring-offset-1 ${
                isActive
                  ? 'border-[#0052CC] bg-[#0052CC]/5 shadow-sm'
                  : 'border-border bg-card hover:border-[#0052CC]/40 hover:bg-secondary/40'
              }`}
            >
              <input
                id={inputId}
                type="radio"
                name={`delivery-speed-${groupId}`}
                value={opt.id}
                checked={isActive}
                onChange={() => onChange(opt.id)}
                className="sr-only"
              />
              {/* Visual radio indicator — sr-only input keeps the keyboard
                  + screen-reader contract while we render a custom dot. */}
              <span
                className={`mt-0.5 w-4 h-4 rounded-full border-2 flex-shrink-0 flex items-center justify-center transition-colors ${
                  isActive ? 'border-[#0052CC]' : 'border-muted-foreground/40'
                }`}
                aria-hidden="true"
              >
                {isActive && <span className="w-2 h-2 rounded-full bg-[#0052CC]" />}
              </span>
              <Icon
                className={`w-4 h-4 mt-1 flex-shrink-0 ${isActive ? 'text-[#0052CC]' : 'text-muted-foreground'}`}
                aria-hidden="true"
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline justify-between gap-2 flex-wrap">
                  <span className={`font-extrabold text-sm ${isActive ? 'text-[#0052CC]' : 'text-foreground'}`}>
                    {opt.label}
                  </span>
                  <span className="text-sm font-bold tabular-nums">
                    {opt.surcharge === 0 ? (
                      <span className="text-green-600">Inclus</span>
                    ) : (
                      <span className={isActive ? 'text-[#0052CC]' : 'text-foreground'}>
                        +{fmtMoney(surchargeAmount)} $
                      </span>
                    )}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">{opt.description}</p>
                {opt.badge && (
                  <span
                    className={`inline-block mt-1.5 text-[9px] font-extrabold uppercase tracking-wider px-1.5 py-0.5 rounded ${
                      opt.id === 'rush'
                        ? 'bg-[#E8A838]/20 text-[#8B6914]'
                        : 'bg-[#0052CC]/10 text-[#0052CC]'
                    }`}
                  >
                    {opt.badge}
                  </span>
                )}
                {isActive && opt.surcharge > 0 && (
                  <p className="text-[11px] text-muted-foreground mt-1.5">
                    +{fmtMoney(surchargeAmount)} $ pour {opt.label.toLowerCase()}
                  </p>
                )}
              </div>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}

// Hydrator helper for the parent. Returns the saved selection or
// 'standard' as the default. Keep this in sync with the storage key
// above so consumers don't have to remember the constant.
export function loadDeliverySpeed(): DeliverySpeedId {
  const raw = readLS<DeliverySpeedId>(DELIVERY_SPEED_KEY, 'standard');
  if (raw === 'standard' || raw === 'rush' || raw === 'urgent') return raw;
  return 'standard';
}

// Surcharge calculator — single source of truth so the cart total math
// matches the picker's inline display. Returns 0 when the option is
// unknown so a stale localStorage value can never produce NaN.
export function getDeliverySurcharge(speedId: DeliverySpeedId, subtotal: number): number {
  const opt = DELIVERY_OPTIONS.find(o => o.id === speedId);
  if (!opt) return 0;
  // Mirror the picker's inline `safeSubtotal` clamp so a non-finite
  // subtotal (NaN/Infinity from a mid-edit empty qty input or a
  // pricing tier divide-by-zero) doesn't propagate as Math.max(0, NaN)
  // === NaN into the cart total — the displayed picker line and the
  // computed cart surcharge would otherwise diverge silently.
  const safe = Number.isFinite(subtotal) ? Math.max(0, subtotal) : 0;
  return safe * opt.surcharge;
}
