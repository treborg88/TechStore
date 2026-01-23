import { test, expect } from '@playwright/test';

test.describe('Product Catalog Features', () => {

  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    // Wait for products to load
    await page.locator('.product-card').first().waitFor();
  });

  test('Product details (Price, Description, Image) should be displayed correctly', async ({ page }) => {
    const firstProduct = page.locator('.product-card').first();

    // 1. Price
    const price = firstProduct.locator('.product-price');
    await expect(price).toBeVisible();
    await expect(price).toHaveText(/\$\d+/);

    // 2. Description
    const description = firstProduct.locator('.product-description');
    await expect(description).toBeAttached();
    
    // 3. Image
    // Note: Using .first() because carousel might render duplicates
    const image = firstProduct.locator('.main-product-image').first();
    await expect(image).toBeVisible();
    await expect(image).toHaveAttribute('src', /.*/);
  });

  test('Zoom functionality (Image Modal)', async ({ page }) => {
    const firstProduct = page.locator('.product-card').first();
    // The carousel prepends the last image for infinite scroll, so the first DOM element (index 0) is off-screen.
    // The visible image is the second one (index 1).
    const image = firstProduct.locator('.main-product-image').nth(1);

    // Click the image to open modal
    await image.click();

    // Verify modal is open
    const modal = page.locator('.image-modal');
    await expect(modal).toBeVisible();

    // Verify modal image
    const modalImage = modal.locator('.modal-image').first();
    await expect(modalImage).toBeVisible();
    await expect(modalImage).toHaveAttribute('src', /.*/);

    // Close modal
    const closeButton = modal.locator('.modal-close-button');
    await closeButton.click();

    // Verify modal is closed
    await expect(modal).not.toBeVisible();
  });

  test('Stock availability check (via Add button)', async ({ page }) => {
    // Since stock number is not explicitly shown in the catalog,
    // we verify that the "Agregar" button is present and enabled.
    const firstProduct = page.locator('.product-card').first();
    const addButton = firstProduct.locator('.add-to-cart-button');
    
    await expect(addButton).toBeVisible();
    await expect(addButton).toBeEnabled();
  });

});

// npx playwright test playwright/product_features.spec.js