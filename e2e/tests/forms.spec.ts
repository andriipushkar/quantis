/**
 * Form validation E2E tests
 *
 * Tests client-side form validation on login and register pages.
 */
import { test, expect } from '@playwright/test';

test.describe('Login form validation', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
  });

  test('email input is present', async ({ page }) => {
    await expect(page.locator('input[type="email"]')).toBeVisible();
  });

  test('password input is present', async ({ page }) => {
    await expect(page.locator('input[type="password"]')).toBeVisible();
  });

  test('submit button is present', async ({ page }) => {
    await expect(page.locator('button[type="submit"]')).toBeVisible();
  });

  test('empty form submission shows validation', async ({ page }) => {
    await page.click('button[type="submit"]');
    // HTML5 validation or custom error should prevent submission
    const emailInput = page.locator('input[type="email"]');
    const isRequired = await emailInput.getAttribute('required');
    // Either has required attribute or shows custom error
    expect(isRequired !== null || await page.locator('text=/required|invalid|error/i').count() > 0).toBeTruthy();
  });
});

test.describe('Register form validation', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/register');
  });

  test('email input is present', async ({ page }) => {
    await expect(page.locator('input[type="email"]')).toBeVisible();
  });

  test('password input is present', async ({ page }) => {
    await expect(page.locator('input[type="password"]')).toBeVisible();
  });

  test('submit button is present', async ({ page }) => {
    await expect(page.locator('button[type="submit"]')).toBeVisible();
  });

  test('page has Quantis branding', async ({ page }) => {
    await expect(page.locator('text=/Quantis/i')).toBeVisible();
  });
});
