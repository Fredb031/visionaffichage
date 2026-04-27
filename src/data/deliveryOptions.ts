// Section 5.1 — delivery-speed tiers exposed in the cart's order summary.
// Surcharge is a multiplier of the cart subtotal (Standard 0%, Express 25%,
// Urgent 50%). UI-only ship for now; the operator follow-up is to wire the
// selected tier to a Shopify cart attribute / line-item surcharge so the
// upcharge actually flows through checkout. Until then this is purely a
// front-end commitment that we surface in the receipt + email.
//
// The option list and each row are frozen on export so a stray consumer
// (DeliverySpeedPicker, getDeliverySurcharge, a future cart helper) can't
// mutate `DELIVERY_OPTIONS[1].surcharge = 0` mid-session and silently
// undercharge every subsequent rush order. `Readonly` on the type and a
// `readonly` array surface the same guarantee at compile time so a
// "let me just patch this tier" attempt fails the build instead of
// corrupting prod. DeliverySpeedPicker only does read ops (.map, .find)
// so this is a pure tightening — no runtime behaviour change.
export type DeliveryOption = Readonly<{
  id: 'standard' | 'rush' | 'urgent';
  label: string;
  days: number;
  surcharge: number;
  description: string;
  badge: string | null;
}>;

export const DELIVERY_OPTIONS: readonly DeliveryOption[] = Object.freeze([
  Object.freeze({ id: 'standard', label: 'Livraison Standard', days: 5, surcharge: 0, description: 'Garanti en 5 jours ouvrables', badge: null }),
  Object.freeze({ id: 'rush', label: 'Livraison Express', days: 3, surcharge: 0.25, description: 'Reçu en 3 jours ouvrables', badge: 'POPULAIRE POUR LES CHANTIERS' }),
  Object.freeze({ id: 'urgent', label: 'Livraison Urgente', days: 2, surcharge: 0.50, description: 'Reçu en 2 jours ouvrables', badge: 'DISPONIBLE LUNDI-VENDREDI AVANT 10H' }),
] as const);
