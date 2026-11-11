import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

const r = (p: string) => fileURLToPath(new URL(p, import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      '@core': r('./src/core'),
      '@render': r('./src/render'),
      '@systems': r('./src/systems'),
      '@ui': r('./src/ui'),
    },
  },
  define: { __TEST__: 'true' },
  test: {
    environment: 'node',
    include: ['tests/**/*.spec.ts'],
    exclude: ['tests/e2e/**'],
    coverage: {
      provider: 'v8',
      include: ['src/core/**'],
      reporter: ['text', 'json-summary'],
      thresholds: { lines: 80, branches: 70 },
    },
  },
});
