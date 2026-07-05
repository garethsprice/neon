import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./vitest.setup.ts'],
    include: ['packages/**/__tests__/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      include: ['packages/*/src/**/*.ts'],
      exclude: ['**/*.test.ts', '**/index.ts', '**/__mocks__/**']
    }
  },
  resolve: {
    alias: {
      '@neon-ui': resolve(__dirname, 'packages/neon-ui/src'),
      '@neon-fx': resolve(__dirname, 'packages/neon-fx/src'),
      '@neon-cloud': resolve(__dirname, 'packages/neon-cloud/src'),
      '@neon/ui': resolve(__dirname, 'packages/neon-ui/src'),
      '@neon/fx': resolve(__dirname, 'packages/neon-fx/src'),
      '@neon/cloud': resolve(__dirname, 'packages/neon-cloud/src'),
      '@neon/ai': resolve(__dirname, 'packages/neon-ai/src'),
      '@neon/instruments': resolve(__dirname, 'packages/neon-instruments/src'),
      '@neon/engine': resolve(__dirname, 'packages/neon-engine/src')
    }
  }
});
