import { test, expect } from '@playwright/test';

test('contact form: submit generates T-XXXX ref', async ({ page }) => {
  await page.goto('/fr-ca/contact');

  await page.fill('input[name="name"]', 'Test User');
  await page.fill('input[name="email"]', 'test@example.com');
  await page.selectOption('select[name="subject"]', 'product');
  await page.fill(
    'textarea[name="message"]',
    'Question sur les hoodies pour mon équipe de construction.',
  );

  await page.getByRole('button', { name: /Envoyer|Send/i }).click();

  // Success view shows a T-XXXX ticket reference. Wave 7 added a
  // `data-print-header` block hidden on screen via CSS (display:none) but
  // still in the DOM, so we filter the T- match to visible nodes only.
  await expect(
    page
      .locator('p, span')
      .filter({ hasText: /T-[A-Z0-9]+/ })
      .filter({ visible: true })
      .first(),
  ).toBeVisible({ timeout: 5000 });
});
