import { test, expect } from '@playwright/test';

test('landing page loads', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveTitle(/Quantis/);
  await expect(page.locator('text=All-in-One')).toBeVisible();
});

test('login page accessible', async ({ page }) => {
  await page.goto('/login');
  await expect(page.locator('text=Quantis')).toBeVisible();
  await expect(page.locator('input[type="email"]')).toBeVisible();
});

test('register page accessible', async ({ page }) => {
  await page.goto('/register');
  await expect(page.locator('input[type="email"]')).toBeVisible();
  await expect(page.locator('input[type="password"]')).toBeVisible();
});

test('pricing page shows 4 tiers', async ({ page }) => {
  await page.goto('/pricing');
  await expect(page.locator('text=Starter')).toBeVisible();
  await expect(page.locator('text=Trader')).toBeVisible();
  await expect(page.locator('text=Pro')).toBeVisible();
  await expect(page.locator('text=Institutional')).toBeVisible();
});

test('status page shows services', async ({ page }) => {
  await page.goto('/status');
  await expect(page.locator('text=System Status')).toBeVisible();
});
