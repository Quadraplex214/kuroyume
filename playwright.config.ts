import { defineConfig, devices } from '@playwright/test';
export default defineConfig({
  testDir: './tests/e2e', fullyParallel: false, forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0, workers: 1,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: { baseURL: 'http://127.0.0.1:3100', trace: 'retain-on-failure', screenshot: 'only-on-failure' },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }, { name: 'mobile', use: { ...devices['iPhone 13'], defaultBrowserType: 'chromium' } }],
  webServer: {
    command: 'node node_modules/next/dist/bin/next start --port 3100',
    url: 'http://127.0.0.1:3100/about',
    reuseExistingServer: false,
    timeout: 120000,
  },
});
