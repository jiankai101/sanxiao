import { defineConfig, devices } from '@playwright/test';

/**
 * Tests that assert real-time rendering/frame budgets. They are kept out of the
 * parallel project so that worker contention cannot consume the browser's
 * compositor budget. The product assertions (including the 200ms resize budget)
 * remain unchanged.
 */
const TIMING_SENSITIVE_TESTS = [
  '**/resize.spec.ts',
  '**/motion.spec.ts',
  '**/audio-network.spec.ts',
];

const chromeUse = { ...devices['Desktop Chrome'], channel: 'chrome' };

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 60_000,
  fullyParallel: false,
  retries: 0,
  reporter: [['list']],
  use: {
    baseURL: 'http://127.0.0.1:4173',
    trace: 'retain-on-failure',
  },
  webServer: {
    command: 'npm run build:test && npx vite preview --host 127.0.0.1 --port 4173 --strictPort',
    url: 'http://127.0.0.1:4173',
    reuseExistingServer: false,
    timeout: 180_000,
  },
  projects: [
    {
      name: 'chromium',
      testIgnore: TIMING_SENSITIVE_TESTS,
      use: chromeUse,
    },
    {
      name: 'timing',
      testMatch: TIMING_SENSITIVE_TESTS,
      fullyParallel: false,
      workers: 1,
      dependencies: ['chromium'],
      use: chromeUse,
    },
  ],
});
