import { test, expect } from '@playwright/test';

const ROUTES = [
  '/fr-ca',
  '/en-ca',
  '/fr-ca/produits',
  '/fr-ca/produits/atc1015-tshirt-pre-retreci',
  '/fr-ca/industries/construction',
  '/fr-ca/panier',
  '/fr-ca/checkout',
  '/fr-ca/confirmation?order=VA-TEST',
];

for (const route of ROUTES) {
  test(`console clean: ${route}`, async ({ page }) => {
    const errors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') errors.push(msg.text());
    });
    page.on('pageerror', (err) => errors.push(err.message));
    page.on('response', (resp) => {
      if (resp.status() >= 400 && !/_next\/image/.test(resp.url())) {
        errors.push(`HTTP ${resp.status()} ${resp.url()}`);
      }
    });
    await page.goto(route, { waitUntil: 'load' });
    // Allow React hydration + any side-effect logs to settle
    await page.waitForTimeout(800);
    expect(
      errors.filter(
        (e) => !/favicon|hot-update|next-intl|HMR|chunk-/i.test(e),
      ),
    ).toEqual([]);
  });
}
