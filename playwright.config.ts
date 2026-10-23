import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/browser',
  fullyParallel: false,
  workers: 1,
  timeout: 60000,
  use: {
    baseURL: 'http://127.0.0.1:43127',
    headless: true,
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
  webServer: {
    command: 'PORT=43127 FOLIO_DATA_DIR=.cache/e2e-data pnpm start',
    url: 'http://127.0.0.1:43127/api/health',
    reuseExistingServer: false,
  },
  projects: [
    { name: 'chromium', use: { browserName: 'chromium', viewport: { width: 1440, height: 1000 } } },
  ],
});
