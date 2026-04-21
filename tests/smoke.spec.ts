// Playwright smoke tests for Vision Affichage.
//
// Requires `npm i -D @playwright/test && npx playwright install chromium`.
// @playwright/test IS in devDependencies, but the Chromium binary is not
// bundled — run `npx playwright install chromium` locally or let the
// dedicated CI workflow (.github/workflows/smoke.yml) do it. We keep the
// browser install out of the default `npm ci` path to keep CI fast.
//
// Local usage:
//   npx vite build && npx vite preview --port 4173 &
//   npm run test:smoke
//
// These tests exist to catch runtime-only regressions that `tsc --noEmit`
// and `vite build` will happily pass — e.g. the "Cannot access 'lazy'
// before initialization" crash on /product/:handle that shipped green.

import { test, expect } from '@playwright/test';

const BASE = process.env.BASE_URL || 'http://localhost:4173';

test.describe('Vision Affichage smoke', () => {
  test('homepage renders without ErrorBoundary', async ({ page }) => {
    await page.goto(BASE);
    await expect(page.locator('text=/Quelque chose s[\'\u2019]est mal pass[éeè]/i')).toHaveCount(0);
    await expect(page.locator('h1')).toBeVisible();
  });

  test('/products loads and has at least one product card', async ({ page }) => {
    await page.goto(BASE + '/products');
    await expect(page.locator('text=/Quelque chose/i')).toHaveCount(0);
    await expect(page.locator('a[href^="/product/"]')).toHaveCount({ gte: 1 } as any);
  });

  test('first product detail page does not crash', async ({ page }) => {
    await page.goto(BASE + '/products');
    const firstLink = page.locator('a[href^="/product/"]').first();
    const href = await firstLink.getAttribute('href');
    if (href) await page.goto(BASE + href);
    await expect(page.locator('text=/Quelque chose/i')).toHaveCount(0);
  });

  test('/cart loads', async ({ page }) => {
    await page.goto(BASE + '/cart');
    await expect(page.locator('text=/Quelque chose/i')).toHaveCount(0);
  });

  test('/admin/login loads', async ({ page }) => {
    await page.goto(BASE + '/admin/login');
    await expect(page.locator('text=/Quelque chose/i')).toHaveCount(0);
  });
});
