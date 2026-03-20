import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './tests',
  baseURL: 'http://localhost:5173',
  use: { headless: true, screenshot: 'only-on-failure' },
  webServer: { command: 'npm run dev:client', port: 5173, reuseExistingServer: true },
});
