/**
 * Responsive design E2E tests
 *
 * Verifies key pages work on different viewport sizes.
 */
import { test, expect } from '@playwright/test';

test.describe('Mobile viewport (375x667)', () => {
  test.use({ viewport: { width: 375, height: 667 } });

  test('landing page renders on mobile', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('text=All-in-One')).toBeVisible();
  });

  test('login page renders on mobile', async ({ page }) => {
    await page.goto('/login');
    await expect(page.locator('input[type="email"]')).toBeVisible();
  });

  test('pricing page renders on mobile', async ({ page }) => {
    await page.goto('/pricing');
    await expect(page.locator('text=Starter')).toBeVisible();
  });
});

test.describe('Tablet viewport (768x1024)', () => {
  test.use({ viewport: { width: 768, height: 1024 } });

  test('landing page renders on tablet', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('text=All-in-One')).toBeVisible();
  });

  test('pricing page shows all tiers on tablet', async ({ page }) => {
    await page.goto('/pricing');
    await expect(page.locator('text=Starter')).toBeVisible();
    await expect(page.locator('text=Pro')).toBeVisible();
  });
});

test.describe('Wide viewport (1920x1080)', () => {
  test.use({ viewport: { width: 1920, height: 1080 } });

  test('landing page renders on wide screen', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('text=All-in-One')).toBeVisible();
  });

  test('status page renders on wide screen', async ({ page }) => {
    await page.goto('/status');
    await expect(page.locator('text=System Status')).toBeVisible();
  });
});
