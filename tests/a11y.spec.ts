import { test, expect } from '@playwright/test';
import { AxeBuilder } from '@axe-core/playwright';

const ROUTES = [
  '/fr-ca',
  '/en-ca',
  '/fr-ca/produits',
  '/fr-ca/produits/atc1015-tshirt-pre-retreci',
  '/fr-ca/industries',
  '/fr-ca/industries/construction',
  '/fr-ca/panier',
  '/fr-ca/checkout',
  '/fr-ca/confirmation?order=VA-TEST',
  '/fr-ca/soumission',
  '/fr-ca/contact',
];

for (const route of ROUTES) {
  test(`a11y: ${route}`, async ({ page }) => {
    await page.goto(route);
    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();
    expect(results.violations, JSON.stringify(results.violations, null, 2)).toEqual([]);
  });
}
