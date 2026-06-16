import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vitest/config';

// The engine is pure TypeScript, so a node environment is enough. The `@` alias
// mirrors vite.config.ts / tsconfig.json so test imports resolve identically.
export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
