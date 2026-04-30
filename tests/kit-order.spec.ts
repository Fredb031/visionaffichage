import { test, expect } from '@playwright/test';

test('kit order: select Starter kit + submit form generates K-XXXX', async ({
  page,
}) => {
  await page.goto('/fr-ca/kit');

  // Select the Starter card. Each kit renders an <article> with the kit name
  // as <h3> and a generic "Choisir ce kit" button. Scope to the Starter card
  // by its accessible heading, then click that card's select button.
  const starterCard = page.locator('article').filter({
    has: page.getByRole('heading', { name: /Kit Starter|Starter Kit/i }),
  });
  await starterCard
    .getByRole('button', { name: /Choisir ce kit|Select this kit/i })
    .click();

  // Form fields appear inline below the chosen kit.
  await page.fill('input[name="name"]', 'Test User');
  await page.fill('input[name="email"]', 'test@example.com');
  await page.fill('input[name="phone"]', '5145551234');
  await page.fill('input[name="company"]', 'Test Co');
  await page.fill('input[name="addressLine1"]', '123 rue Test');
  await page.fill('input[name="city"]', 'Montréal');
  await page.fill('input[name="postalCode"]', 'H2X1Y4');

  await page
    .getByRole('button', { name: /Commander mon kit|Order my kit/i })
    .click();

  // Success view shows a K-XXXX reference. Wave 7 added a hidden
  // `data-print-header` block, so we filter to the visible body match.
  await expect(
    page
      .locator('p, span')
      .filter({ hasText: /K-[A-Z0-9]+/ })
      .filter({ visible: true })
      .first(),
  ).toBeVisible({ timeout: 5000 });
});
