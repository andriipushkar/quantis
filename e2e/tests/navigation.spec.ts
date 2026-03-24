/**
 * Navigation E2E tests
 *
 * Verifies all public pages load correctly and key navigation flows work.
 */
import { test, expect } from '@playwright/test';

test.describe('Public page navigation', () => {
  test('terms page loads', async ({ page }) => {
    await page.goto('/terms');
    await expect(page.locator('text=/terms/i')).toBeVisible();
  });

  test('privacy page loads', async ({ page }) => {
    await page.goto('/privacy');
    await expect(page.locator('text=/privacy/i')).toBeVisible();
  });

  test('api-docs page loads', async ({ page }) => {
    await page.goto('/api-docs');
    await expect(page.locator('text=/API/i')).toBeVisible();
  });

  test('404 page for unknown route', async ({ page }) => {
    await page.goto('/this-does-not-exist');
    await expect(page.locator('text=/not found|404/i')).toBeVisible();
  });

  test('landing page has CTA buttons', async ({ page }) => {
    await page.goto('/');
    const ctaButtons = page.locator('a[href="/register"], button:has-text("Get Started"), a:has-text("Get Started")');
    await expect(ctaButtons.first()).toBeVisible();
  });

  test('pricing page toggle monthly/yearly', async ({ page }) => {
    await page.goto('/pricing');
    // Look for a toggle or tab for billing period
    const toggle = page.locator('text=/monthly|yearly|annual/i');
    if (await toggle.first().isVisible()) {
      await toggle.first().click();
    }
    // Page should still be functional
    await expect(page.locator('text=Starter')).toBeVisible();
  });
});

test.describe('Navigation between pages', () => {
  test('login page → register link', async ({ page }) => {
    await page.goto('/login');
    const registerLink = page.locator('a[href="/register"], text=/register|sign up/i');
    if (await registerLink.first().isVisible()) {
      await registerLink.first().click();
      await expect(page).toHaveURL(/register/);
    }
  });

  test('register page → login link', async ({ page }) => {
    await page.goto('/register');
    const loginLink = page.locator('a[href="/login"], text=/login|sign in/i');
    if (await loginLink.first().isVisible()) {
      await loginLink.first().click();
      await expect(page).toHaveURL(/login/);
    }
  });
});
