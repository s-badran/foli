import { defineConfig } from '@playwright/test';

/**
 * Offline e2e for the auto-run path: the server uses the deterministic mock model,
 * so clicking Generate runs the model inline and surfaces the rejected response.
 */
export default defineConfig({
  testDir: './tests/browser-auto',
  fullyParallel: false,
  workers: 1,
  timeout: 60000,
  use: {
    baseURL: 'http://127.0.0.1:43128',
    headless: true,
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
  webServer: {
    command:
      'pnpm build && FOLIO_ENV_FILE= FOLIO_AI_MODEL=mock PORT=43128 FOLIO_DATA_DIR=.cache/e2e-auto-data pnpm start',
    url: 'http://127.0.0.1:43128/api/health',
    reuseExistingServer: false,
  },
  projects: [
    { name: 'chromium', use: { browserName: 'chromium', viewport: { width: 1440, height: 1000 } } },
  ],
});
