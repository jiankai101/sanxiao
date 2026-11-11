import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';

const r = (p: string) => fileURLToPath(new URL(p, import.meta.url));

export default defineConfig(({ mode }) => ({
  base: './',
  publicDir: false,
  resolve: {
    alias: {
      '@core': r('./src/core'),
      '@render': r('./src/render'),
      '@systems': r('./src/systems'),
      '@ui': r('./src/ui'),
    },
  },
  build: {
    target: 'es2020',
    sourcemap: false,
    assetsInlineLimit: 4096,
    cssCodeSplit: true,
  },
  define: {
    __TEST__: JSON.stringify(mode === 'test'),
  },
}));
