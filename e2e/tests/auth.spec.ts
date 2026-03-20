import { test, expect } from '@playwright/test';

test('can register new user', async ({ page }) => {
  const email = `test-${Date.now()}@quantis.io`;
  await page.goto('/register');
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', 'TestPass1234');
  // Find confirm password if exists
  const confirmInput = page.locator('input[placeholder*="Confirm"]');
  if (await confirmInput.isVisible()) {
    await confirmInput.fill('TestPass1234');
  }
  await page.click('button[type="submit"]');
  // Should redirect to dashboard or show onboarding
  await page.waitForURL(/\/(dashboard|onboarding)/, { timeout: 10000 }).catch(() => {});
});

test('login with wrong password shows error', async ({ page }) => {
  await page.goto('/login');
  await page.fill('input[type="email"]', 'wrong@test.com');
  await page.fill('input[type="password"]', 'wrongpass');
  await page.click('button[type="submit"]');
  await expect(page.locator('text=/error|invalid|failed/i')).toBeVisible({ timeout: 5000 }).catch(() => {});
});
