import { test, expect } from '@playwright/test';

test.describe('Proceso de Autenticación (Login y Registro)', () => {
  
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    // Abrir el modal o página de login
    await page.getByRole('button', { name: /Iniciar Sesión/i }).first().click();
  });

  test('Debe mostrar errores de validación en el registro (Contraseña débil)', async ({ page }) => {
    // Cambiar a modo registro
    await page.getByRole('button', { name: /Regístrate gratis/i }).click();

    await page.locator('#nombre').fill('Usuario de Prueba');
    await page.locator('#email').fill('test@example.com');
    await page.locator('#password').fill('123'); // Muy corta y sin mayúsculas/números
    await page.locator('#confirmPassword').fill('123');

    await page.getByRole('button', { name: 'Crear Cuenta' }).click();

    // Verificar que aparece el mensaje de error de la nueva política de contraseñas
    await expect(page.getByText(/La contraseña debe tener al menos 8 caracteres, una mayúscula y un número/i)).toBeVisible();
  });

  test('Debe validar que las contraseñas coincidan en el registro', async ({ page }) => {
    await page.getByRole('button', { name: /Regístrate gratis/i }).click();

    await page.locator('#nombre').fill('Usuario de Prueba');
    await page.locator('#email').fill('test@example.com');
    await page.locator('#password').fill('Password123');
    await page.locator('#confirmPassword').fill('Password456');

    await page.getByRole('button', { name: 'Crear Cuenta' }).click();

    await expect(page.getByText(/Las contraseñas no coinciden/i)).toBeVisible();
  });

  test('Flujo de "Olvidé mi contraseña" - Interfaz', async ({ page }) => {
    // Hacer clic en el link de olvidar contraseña
    await page.getByRole('button', { name: /¿Olvidaste tu contraseña?/i }).click();

    // Verificar que cambia el título
    await expect(page.getByText('Recuperar Contraseña')).toBeVisible();
    await expect(page.getByText('Te enviaremos un código para restablecer tu contraseña')).toBeVisible();

    // Volver al inicio de sesión
    await page.getByRole('button', { name: /Volver al inicio de sesión/i }).click();
    await expect(page.getByText('Bienvenido de Nuevo')).toBeVisible();
  });

  test('Funcionalidad de Mostrar/Ocultar contraseña', async ({ page }) => {
    const passwordInput = page.locator('#password');
    
    await passwordInput.fill('MiPasswordSecreto123');
    await expect(passwordInput).toHaveAttribute('type', 'password');

    // Clic en el botón Mostrar
    await page.getByRole('button', { name: 'Mostrar' }).click();
    await expect(passwordInput).toHaveAttribute('type', 'text');

    // Clic en el botón Ocultar
    await page.getByRole('button', { name: 'Ocultar' }).click();
    await expect(passwordInput).toHaveAttribute('type', 'password');
  });

  test('Navegación fluida entre Login y Registro', async ({ page }) => {
    // Estamos en Login
    await expect(page.getByText('Bienvenido de Nuevo')).toBeVisible();
    
    // Ir a Registro
    await page.getByRole('button', { name: /Regístrate gratis/i }).click();
    await expect(page.getByText('Crear Nueva Cuenta')).toBeVisible();
    await expect(page.getByLabel('Nombre completo')).toBeVisible();

    // Volver a Login
    await page.getByRole('button', { name: /Inicia sesión aquí/i }).click();
    await expect(page.getByText('Bienvenido de Nuevo')).toBeVisible();
    await expect(page.locator('#nombre')).not.toBeVisible();
  });

});
