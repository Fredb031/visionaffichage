# 004 — Payment: simulated checkout for Phase 1

Status: accepted (2026-04-29)

## Context
Phase 1's goal is to ship a complete shopper experience that the operator can demo end-to-end. A real payment service provider (PSP) integration would add weeks of compliance work, vendor selection, and live-key handling that isn't justified for the first traffic cohort.

## Decision
The 5-step guest checkout (`app/[locale]/checkout/CheckoutClient.tsx`) accepts card data in a Zod-validated form, then **simulates** the charge:
- Card data is never sent to a server. The form submits client-side.
- An order ID `VA-<base36 timestamp>` is generated client-side.
- The order is persisted to `sessionStorage` under key `va-last-order` for the confirmation page to read.
- The shopper is redirected to `/[locale]/confirmation?order=VA-XXX`.

The `paymentForm.simulationNotice` translation is shown prominently in the payment step and the review step, so no shopper believes they actually paid.

## Rationale
- Lets the operator demo the full purchase flow at trade shows, in pitches, and to early customers.
- Lets us write a complete Playwright happy-path E2E without third-party stubs.
- No PCI scope. No live card data ever transits any backend.

## Consequences
- Cannot fulfill real orders until Phase 2 completes the PSP integration.
- The order confirmation page is unreachable from search engines (`robots: noindex, nofollow`).

## Real PSP integration (Phase 2)
Recommended target: Stripe Elements + Payment Intents.
1. Replace the `cardNumber` / `cardExpiry` / `cardCvc` fields with Stripe Elements iframes (PCI-DSS scope drops to SAQ A).
2. Add an `app/api/checkout/intent/route.ts` server action that creates a PaymentIntent on order finalization, returning the client secret.
3. Replace `onSubmit` in `CheckoutClient.tsx` with `stripe.confirmPayment()` and gate the confirmation redirect on `paymentIntent.status === 'succeeded'`.
4. Persist the order server-side (DB or webhook to operator's ERP) — `sessionStorage` is only for the immediate confirmation render.
5. Configure webhook handlers for `payment_intent.succeeded`, `charge.refunded`, `charge.dispute.created`. Wire to email + operator dashboard.
6. Produce real receipts PDF + email.
