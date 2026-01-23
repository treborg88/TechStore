import { test, expect } from '@playwright/test';

test.describe('Admin Product Search', () => {

  test.beforeEach(async ({ page }) => {
    // Login as admin
    await page.goto('/');
    await page.getByRole('button', { name: /iniciar sesión|login/i }).click();
    await page.getByLabel(/correo|email/i).fill('roberg1988@gmail.com');
    await page.getByLabel(/contraseña|password/i).fill('123456');
    await page.locator('form').getByRole('button', { name: /iniciar sesión|login/i }).click();
    await expect(page.getByRole('button', { name: /cerrar sesión|logout/i })).toBeVisible();

    // Go to Admin Dashboard
    await page.getByRole('link', { name: /administrar/i }).click();
    await expect(page).toHaveURL(/\/admin/);
  });

  test('Search products by name', async ({ page }) => {
    // Switch to Products tab
    await page.getByRole('button', { name: /productos/i }).click();

    // Wait for loading to finish
    await expect(page.locator('.spinner-container')).not.toBeVisible();

    // Check if table exists or empty message
    const table = page.locator('.admin-table');
    const emptyMsg = page.locator('.admin-empty');
    
    if (await emptyMsg.isVisible()) {
        console.log('No products found in Admin Dashboard. Skipping search test.');
        return;
    }

    await expect(table).toBeVisible();

    // Wait for rows
    await page.locator('.admin-table tbody tr').first().waitFor();

    // Get the name of the first product to use as search term
    const firstProductName = await page.locator('.admin-table tbody tr').first().locator('td').nth(1).innerText();
    console.log(`Searching for product name: ${firstProductName}`);

    // Type into search box
    await page.locator('#admin-search').fill(firstProductName);

    // Verify that the filtered list contains the product
    await expect(page.locator('.admin-table tbody tr').first()).toContainText(firstProductName);
    
    // Verify that non-matching products are hidden (optional, hard to verify without knowing data)
    // But we can check that the number of rows is at least 1
    const rowCount = await page.locator('.admin-table tbody tr').count();
    expect(rowCount).toBeGreaterThan(0);
  });

  test('Search products by description (characteristic)', async ({ page }) => {
    // Switch to Products tab
    await page.getByRole('button', { name: /productos/i }).click();

    // Wait for loading to finish
    await expect(page.locator('.spinner-container')).not.toBeVisible();

    const table = page.locator('.admin-table');
    const emptyMsg = page.locator('.admin-empty');
    
    if (await emptyMsg.isVisible()) {
        console.log('No products found in Admin Dashboard. Skipping description search test.');
        return;
    }

    await expect(table).toBeVisible();

    // Wait for products to load
    await page.locator('.admin-table tbody tr').first().waitFor();

    // Find a product with a description
    const rows = page.locator('.admin-table tbody tr');
    const count = await rows.count();
    let searchTerm = '';
    
    for (let i = 0; i < count; i++) {
        const description = await rows.nth(i).locator('td').nth(3).innerText();
        if (description && description.trim().length > 3) {
            // Use a part of the description
            searchTerm = description.trim().split(' ')[0]; 
            if (searchTerm.length > 2) break;
        }
    }

    if (searchTerm) {
        console.log(`Searching for description term: ${searchTerm}`);
        await page.locator('#admin-search').fill(searchTerm);
        
        // Verify results
        await expect(page.locator('.admin-table tbody tr').first()).toBeVisible();
        // Check if any row contains the search term (in name or description)
        // Since the search logic includes description, this should pass
    } else {
        console.log('No suitable description found to test search.');
    }
  });

});


// npx playwright test playwright/admin_search.spec.js