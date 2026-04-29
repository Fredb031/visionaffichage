// Phase 8 — Purchase happy-path E2E test (scaffold).
//
// Status: SCAFFOLD ONLY. Selectors below use `data-*` attribute hooks
// (e.g. `[data-product-card]`, `[data-color-swatch]`, `[data-size-button]`,
// `[data-customizer-canvas]`, `[data-cart-item]`) that DO NOT yet exist on
// the source components. This test will FAIL on a real run until those
// hooks are added to:
//   - PDP / catalogue cards         → data-product-card
//   - PDP variant pickers           → data-color-swatch, data-size-button
//   - Customizer canvas wrapper     → data-customizer-canvas
//   - Cart drawer / cart line item  → data-cart-item
//
// Adding those attributes to source components is intentionally OUT OF
// SCOPE for this scaffold commit (separate follow-up). See
// tests/e2e/README.md for operator instructions.
//
// To run (Playwright + chromium are already installed in devDependencies):
//   npx playwright install chromium   # first time only
//   npx playwright test tests/e2e/purchase-happy-path.spec.ts

import { test, expect } from '@playwright/test';

test.describe('Purchase happy path', () => {
  test('Browse → PDP → Customizer → Cart → Checkout', async ({ page }) => {
    // Track console errors across the whole journey (assertion at the end).
    const errors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') errors.push(msg.text());
    });

    // 1. Land on homepage
    await page.goto('/');
    await expect(page.locator('h1')).toBeVisible();

    // 2. Open product catalog
    // TODO(data-attr): ensure header nav link to /produits has stable name.
    await page.getByRole('link', { name: /produits/i }).click();
    await expect(page).toHaveURL(/\/produits/);

    // 3. Click first product card
    // TODO(data-attr): add `data-product-card` to product card root in catalogue grid.
    await page.locator('[data-product-card]').first().click();
    await expect(page).toHaveURL(/\/produit\//);

    // 4. Choose color + size
    // TODO(data-attr): add `data-color-swatch` to each color option button on PDP.
    await page.locator('[data-color-swatch]').first().click();
    // TODO(data-attr): add `data-size-button` to each size option button on PDP.
    await page.locator('[data-size-button]').first().click();

    // 5. Click "Personnaliser"
    await page.getByRole('button', { name: /personnaliser/i }).click();

    // 6. Customizer loads
    // TODO(data-attr): add `data-customizer-canvas` to the customizer canvas wrapper.
    await expect(page.locator('[data-customizer-canvas]')).toBeVisible({ timeout: 10000 });

    // 7. Add to cart
    await page.getByRole('button', { name: /ajouter au panier/i }).click();

    // 8. Cart drawer opens with item
    // TODO(data-attr): add `data-cart-item` to each cart line in drawer + cart page.
    await expect(page.locator('[data-cart-item]')).toBeVisible();

    // 9. Go to checkout
    await page
      .getByRole('link', { name: /panier|caisse|checkout/i })
      .first()
      .click();
    await expect(page).toHaveURL(/\/(panier|cart|checkout)/);

    // 10. Console errors check (favicon noise excluded).
    const meaningful = errors.filter((e) => !e.includes('favicon'));
    expect(meaningful.length, `console errors: ${meaningful.join(' | ')}`).toBe(0);
  });
});
