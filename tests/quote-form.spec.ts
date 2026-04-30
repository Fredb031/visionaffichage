import { test, expect } from '@playwright/test';

test('quote form: 6-step submission generates Q-XXXX ref', async ({ page }) => {
  await page.goto('/fr-ca/soumission');

  // Step 1 — scope.
  await page.fill('input[name="employeeCount"]', '50');
  // Pick a date ~14 days out (well past any business-day minimum).
  const futureDate = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);
  await page.fill('input[name="neededBy"]', futureDate);
  await page.selectOption('select[name="industry"]', 'construction');
  await page.getByRole('button', { name: /Continuer|Continue/i }).click();

  // Step 2 — products. Each product is a <label> wrapping a hidden
  // <input type="checkbox">; click the first checkbox via the label.
  await page.locator('ul label').first().click();
  await page.getByRole('button', { name: /Continuer|Continue/i }).click();

  // Step 3 — logo (pending).
  await page
    .getByRole('radio', { name: /Pas encore|Not yet/i })
    .click();
  await page.fill(
    'textarea[name="logoDescription"]',
    'Logo en cours de finalisation, environ 3 couleurs primaires.',
  );
  await page.getByRole('button', { name: /Continuer|Continue/i }).click();

  // Step 4 — shipping (single destination).
  await page
    .getByRole('radio', { name: /Une seule|Single/i })
    .click();
  await page.fill('input[name="addressLine1"]', '123 rue Test');
  await page.fill('input[name="city"]', 'Montréal');
  await page.fill('input[name="postalCode"]', 'H2X1Y4');
  await page.getByRole('button', { name: /Continuer|Continue/i }).click();

  // Step 5 — contact.
  await page.fill('input[name="name"]', 'Test User');
  await page.fill('input[name="email"]', 'test@example.com');
  await page.fill('input[name="phone"]', '5145551234');
  await page.fill('input[name="company"]', 'Test Co');
  await page.getByRole('button', { name: /Continuer|Continue/i }).click();

  // Step 6 — review + submit.
  await page.getByRole('button', { name: /Envoyer|Submit/i }).click();

  // Success view: a Q-XXXX reference must surface in the visible body
  // (Wave 7 added a `data-print-header` block hidden on screen).
  await expect(
    page
      .locator('p, span')
      .filter({ hasText: /Q-[A-Z0-9]+/ })
      .filter({ visible: true })
      .first(),
  ).toBeVisible({ timeout: 5000 });
});
