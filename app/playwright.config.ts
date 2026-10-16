import { defineConfig, devices } from '@playwright/test';

/**
 * Testes de ecrã (e2e/). Correm contra o build de produção (www/), num telemóvel de 390 px, sem rede para o Supabase:
 * a app tem de funcionar offline e com a base local (sql.js no browser).
 *   npm run build && npm run test:e2e
 */
const PORT = 4300;

export default defineConfig({
  testDir: 'e2e',
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: true,
  forbidOnly: !!process.env['CI'],
  retries: process.env['CI'] ? 1 : 0,
  reporter: process.env['CI'] ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: `http://localhost:${PORT}`,
    ...devices['Pixel 7'],
    viewport: { width: 390, height: 844 },
    locale: 'pt-PT',
    timezoneId: 'Europe/Lisbon',
    serviceWorkers: 'block',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [{ name: 'telemovel', use: { browserName: 'chromium' } }],
  webServer: {
    command: `node scripts/serve-www.mjs ${PORT}`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !process.env['CI'],
  },
});
