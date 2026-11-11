import { defineConfig, devices } from '@playwright/test';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('..', import.meta.url));
export default defineConfig({
  testDir: '.',
  testMatch: /g7-.*\.spec\.ts/,
  outputDir: './test-results',
  timeout: 120_000,
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [['list']],
  use: { baseURL: 'http://127.0.0.1:4174', trace: 'retain-on-failure' },
  webServer: {
    command: 'npm run build:test && npx vite preview --host 127.0.0.1 --port 4174 --strictPort',
    cwd: root,
    url: 'http://127.0.0.1:4174',
    reuseExistingServer: false,
    timeout: 180_000,
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'], channel: 'chrome' } }],
});
