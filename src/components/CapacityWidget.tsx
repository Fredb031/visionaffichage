import { useEffect, useState } from 'react';
import { AlertCircle } from 'lucide-react';
import {
  getCurrentCapacity,
  getNextDeliveryDate,
  getRemainingSlots,
  type WeeklyCapacity,
} from '@/lib/capacity';
import { useLang } from '@/lib/langContext';

// Volume II §10.1 — scarcity / urgency signal.
//
// Renders an amber "Plus que N créneaux disponibles cette semaine"
// pill when, AND ONLY WHEN, the current week's remaining
// production slots dip below 15. Above that, the component
// renders nothing — Section 10's core rule is that scarcity must
// be authentic. Always-on "only X left!" copy reads as fake and
// erodes trust. The threshold (<15 of 50 ≈ 70%-booked) is the
// point where "this week is filling up" stops being a marketing
// nudge and becomes literally true.
//
// Read path: getCurrentCapacity() pulls today's WeeklyCapacity
// from localStorage (Supabase weekly_capacity row in the future).
// We re-read on mount inside an effect so the same module
// imported into the homepage hero AND the PDP right column
// doesn't share a stale snapshot if a sibling tab just mutated
// the value via /admin/capacity. Cross-tab reactivity is
// out of scope — operators don't expect the home page in tab A
// to repaint when they save in tab B; a refresh covers it.
//
// `variant` controls layout:
//   • "hero"  — centered pill, used inside the homepage hero
//                kicker stack (sits with DeliveryBadge).
//   • "inline" — left-aligned compact pill, used on the PDP
//                right column above the price/CTA so the
//                shopper sees urgency at the decision moment.

interface CapacityWidgetProps {
  variant?: 'hero' | 'inline';
  className?: string;
}

const SCARCITY_THRESHOLD = 15;

export function CapacityWidget({ variant = 'hero', className = '' }: CapacityWidgetProps) {
  const { lang } = useLang();
  // Read inside an effect so SSR-style first render and CSR
  // hydration agree (localStorage is undefined server-side; we
  // never run server-side here, but keeping the read effectful
  // also means a freshly-saved /admin/capacity value picks up
  // when this component re-mounts on route change).
  const [capacity, setCapacity] = useState<WeeklyCapacity | null>(null);
  useEffect(() => {
    setCapacity(getCurrentCapacity());
  }, []);

  if (!capacity) return null;

  const remaining = getRemainingSlots(capacity);
  // Authentic-scarcity gate. Above the threshold the widget is
  // invisible — shoppers don't see the badge until it's true.
  // At zero we also hide: "Only 0 slots left" reads as broken UI
  // and contradicts the "order now to guarantee delivery" CTA.
  if (remaining <= 0 || remaining >= SCARCITY_THRESHOLD) return null;

  const nextDelivery = getNextDeliveryDate();
  const dateStr = nextDelivery.toLocaleDateString(
    lang === 'en' ? 'en-CA' : 'fr-CA',
    { weekday: 'long', day: 'numeric', month: 'long' }
  );

  const headline = lang === 'en'
    ? `Only ${remaining} slots left this week`
    : `Plus que ${remaining} créneaux disponibles cette semaine`;

  const subline = lang === 'en'
    ? `Order now to guarantee delivery before ${dateStr}`
    : `Commande maintenant pour garantir ta livraison avant le ${dateStr}`;

  const layout = variant === 'hero'
    ? 'flex-col items-center text-center max-w-[440px] mx-auto'
    : 'flex-col items-start text-left';

  return (
    <div
      className={`inline-flex ${layout} gap-1 px-4 py-2.5 rounded-xl bg-amber-50 border border-amber-200 ${className}`}
      role="status"
      aria-live="polite"
    >
      <div className="flex items-center gap-2">
        <AlertCircle
          size={14}
          strokeWidth={2.5}
          className="text-amber-700 flex-shrink-0"
          aria-hidden="true"
        />
        <span className="text-[13px] font-bold text-amber-900 leading-tight">
          {headline}
        </span>
      </div>
      <span className="text-[11px] text-amber-800 leading-snug">
        {subline}
      </span>
    </div>
  );
}
