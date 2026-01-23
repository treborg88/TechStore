import { test, expect } from '@playwright/test';

test('Login and Logout flow', async ({ page }) => {
  // 1. Go to home page (uses baseURL from playwright.config.js)
  await page.goto('/');

  // 2. Click on Login button in the header
  await page.getByRole('button', { name: 'Iniciar Sesión' }).click();

  // 3. Verify we are on the login page
  await expect(page).toHaveURL(/\/login/);

  // 4. Fill in credentials
  await page.getByLabel('Correo electrónico').fill('roberg1988@gmail.com');
  await page.getByLabel('Contraseña').fill('123456');

  // 5. Submit form (targeting the button inside the form to avoid ambiguity with header button)
  await page.locator('form').getByRole('button', { name: 'Iniciar Sesión' }).click();

  // 6. Verify login success
  // Expect "Hola, {name}" to be visible. We don't know the name for sure, but we can check for "Cerrar Sesión"
  await expect(page.getByRole('button', { name: 'Cerrar Sesión' })).toBeVisible();
  
  // Also check that "Iniciar Sesión" is NOT visible in the header anymore
  // Note: The "Iniciar Sesión" button in the header should be replaced by "Cerrar Sesión"
  await expect(page.getByRole('button', { name: 'Iniciar Sesión' })).not.toBeVisible();

  // 7. Click Logout
  await page.getByRole('button', { name: 'Cerrar Sesión' }).click();

  // 8. Verify logout success
  // "Iniciar Sesión" button should be visible again
  await expect(page.getByRole('button', { name: 'Iniciar Sesión' })).toBeVisible();
  // "Cerrar Sesión" should not be visible
  await expect(page.getByRole('button', { name: 'Cerrar Sesión' })).not.toBeVisible();
});