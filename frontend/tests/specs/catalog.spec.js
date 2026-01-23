import { test, expect } from '@playwright/test';

test.describe('Product Catalog Elements', () => {
  
  test.beforeEach(async ({ page }) => {
    // Uses baseURL from playwright.config.js
    await page.goto('/');
  });

  test('Product card should display all required elements', async ({ page }) => {
    // Wait for products to load
    const productCard = page.locator('.product-card').first();
    await expect(productCard).toBeVisible();

    // 1. Verify Image
    // Note: The carousel might render multiple images (clones for infinite scroll). We check the first one.
    const image = productCard.locator('.main-product-image').first();
    await expect(image).toBeVisible();
    // Check if src attribute exists (we can't easily check validity without network interception, but existence is good)
    await expect(image).toHaveAttribute('src', /.*/);

    // 2. Verify Title
    const title = productCard.locator('.product-title');
    await expect(title).toBeVisible();
    const titleText = await title.innerText();
    expect(titleText.length).toBeGreaterThan(0);

    // 3. Verify Description
    const description = productCard.locator('.product-description');
    // Description might be empty, so we check if the element is attached to the DOM
    await expect(description).toBeAttached();
    
    // 4. Verify Price
    const price = productCard.locator('.product-price');
    await expect(price).toBeVisible();
    await expect(price).toHaveText(/\$/); // Should contain dollar sign
    // Optional: Check if it contains a number
    const priceText = await price.innerText();
    expect(priceText).toMatch(/\$\d+/);

    // 5. Verify "Agregar" Button
    const addButton = productCard.locator('.add-to-cart-button');
    await expect(addButton).toBeVisible();
    await expect(addButton).toBeEnabled();
    await expect(addButton).toHaveText(/Agregar/i);
  });

  test('All products should have valid prices', async ({ page }) => {
    // Wait for products
    await page.locator('.product-card').first().waitFor();
    
    const prices = page.locator('.product-price');
    const count = await prices.count();
    
    for (let i = 0; i < count; i++) {
      await expect(prices.nth(i)).toBeVisible();
      await expect(prices.nth(i)).toHaveText(/\$\d+/);
    }
  });

});


// npx playwright test playwright/catalog.spec.js
// npx playwright test --headed playwright/catalog.spec.js