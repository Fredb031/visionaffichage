import { test, expect } from '@playwright/test';

test('Purchase happy path: home -> PDP -> cart -> checkout -> confirmation', async ({
  page,
}) => {
  // 1. Home
  await page.goto('/fr-ca');
  await expect(page.locator('h1').first()).toBeVisible();

  // 2. Open a featured product. Featured grid is inside an article element.
  // Click the first article anchor.
  const firstProductLink = page.locator('article a').first();
  await firstProductLink.click();
  await expect(page).toHaveURL(/\/fr-ca\/produits\/[a-z0-9-]+/);

  // 3. Pick color (first available color in the radiogroup) + size + ATC.
  await page
    .locator('[role="radiogroup"][aria-label*="Couleur" i]')
    .first()
    .getByRole('radio')
    .first()
    .click();

  // SizePicker exposes radios with the size text as accessible name.
  await page
    .locator('[role="radiogroup"][aria-label*="taille" i], [role="radiogroup"][aria-label*="size" i]')
    .getByRole('radio', { name: /^(M|L)$/ })
    .first()
    .click();

  // PDP CTA: "Personnaliser et ajouter au panier · $XX,XX"
  await page
    .getByRole('button', { name: /Personnaliser et ajouter au panier/i })
    .first()
    .click();

  // 4. Cart
  await expect(page).toHaveURL(/\/fr-ca\/panier/);
  await expect(page.getByText(/Sous-total/i).first()).toBeVisible();

  // 5. Checkout
  await page
    .getByRole('link', { name: /Passer au paiement/i })
    .click();
  await expect(page).toHaveURL(/\/fr-ca\/checkout/);

  // Step 1: contact
  await page.fill('input[name=email]', 'test@example.com');
  await page.fill('input[name=phone]', '5145551234');
  await page.fill('input[name=firstName]', 'Test');
  await page.fill('input[name=lastName]', 'User');
  await page.fill('input[name=company]', 'Test Co');
  await page.getByRole('button', { name: /^Continuer$/i }).click();

  // Step 2: shipping
  await page.fill('input[name=addressLine1]', '123 rue Test');
  await page.fill('input[name=city]', 'Montréal');
  await page.fill('input[name=postalCode]', 'H2X1Y4');
  await page.getByRole('button', { name: /^Continuer$/i }).click();

  // Step 3: billing — keep same as shipping (default)
  await page.getByRole('button', { name: /^Continuer$/i }).click();

  // Step 4: payment
  await page.fill('input[name=cardName]', 'Test User');
  await page.fill('input[name=cardNumber]', '4111111111111111');
  await page.fill('input[name=cardExpiry]', '1230');
  await page.fill('input[name=cardCvc]', '123');
  await page.getByRole('button', { name: /^Continuer$/i }).click();

  // Step 5: review + place order
  await page.getByRole('button', { name: /Passer la commande/i }).click();

  // 6. Confirmation
  await expect(page).toHaveURL(/\/fr-ca\/confirmation\?order=VA-/);
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
});
