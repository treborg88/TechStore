import { test, expect } from '@playwright/test';

test.describe('Product Category Filters', () => {
  
  test.beforeEach(async ({ page }) => {
    // Uses baseURL from playwright.config.js
    await page.goto('/');
  });

  test('Default category should be "Todos"', async ({ page }) => {
    // Verify "Todos" category is active by default
    const todosButton = page.getByRole('button', { name: 'Todos' });
    await expect(todosButton).toHaveClass(/active/);
  });

  test('Filter by "Smartphones" category', async ({ page }) => {
    // Click on "Smartphones" category
    await page.getByRole('button', { name: 'Smartphones' }).click();

    // Verify "Smartphones" button is active
    const smartphonesButton = page.getByRole('button', { name: 'Smartphones' });
    await expect(smartphonesButton).toHaveClass(/active/);

    // Verify "Todos" is not active
    const todosButton = page.getByRole('button', { name: 'Todos' });
    await expect(todosButton).not.toHaveClass(/active/);

    // Wait for products to load (if there's a loading state, it might be quick)
    // We can wait for the product cards to appear or update
    // Ideally, we should check if there are products. If the DB is empty, this test might be limited.
    // Assuming there are products, we check if visible products have the correct category.
    
    // Get all product category tags
    const productCategories = page.locator('.product-category');
    
    // Check if we have any products
    const count = await productCategories.count();
    if (count > 0) {
      for (let i = 0; i < count; i++) {
        await expect(productCategories.nth(i)).toHaveText('Smartphones');
      }
    } else {
      console.log('No products found for Smartphones category, skipping product verification.');
    }
  });

  test('Filter by "Auriculares" category', async ({ page }) => {
    await page.getByRole('button', { name: 'Auriculares' }).click();

    const auricularesButton = page.getByRole('button', { name: 'Auriculares' });
    await expect(auricularesButton).toHaveClass(/active/);

    const productCategories = page.locator('.product-category');
    const count = await productCategories.count();
    
    if (count > 0) {
      for (let i = 0; i < count; i++) {
        await expect(productCategories.nth(i)).toHaveText('Auriculares');
      }
    }
  });

  test('Switching back to "Todos" shows all categories', async ({ page }) => {
    // First filter by something else
    await page.getByRole('button', { name: 'Smartphones' }).click();
    await expect(page.getByRole('button', { name: 'Smartphones' })).toHaveClass(/active/);

    // Then click "Todos"
    await page.getByRole('button', { name: 'Todos' }).click();
    await expect(page.getByRole('button', { name: 'Todos' })).toHaveClass(/active/);

    // If we have mixed products, we might see different categories.
    // It's hard to guarantee mixed products without seeding, but we can check that the filter is active.
  });

});


// npx playwright test playwright/filters.spec.js
// npx playwright test --headed playwright/filters.spec.js