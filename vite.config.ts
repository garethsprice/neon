import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  root: '.',
  publicDir: 'public',
  base: process.env.BASE_URL || '/',

  resolve: {
    alias: {
      '@neon/ui': resolve(__dirname, 'packages/neon-ui/src'),
      '@neon/fx': resolve(__dirname, 'packages/neon-fx/src'),
      '@neon/cloud': resolve(__dirname, 'packages/neon-cloud/src'),
      '@neon/ai': resolve(__dirname, 'packages/neon-ai/src')
    }
  },

  server: {
    port: 4000,
    open: true,
    fs: {
      // Allow serving files from the entire monorepo
      allow: ['.']
    }
  },

  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        drums: resolve(__dirname, 'apps/neon-drums/index.html'),
        synth: resolve(__dirname, 'apps/neon-synth/index.html'),
        noise: resolve(__dirname, 'apps/neon-noise/index.html'),
        'playground-ui': resolve(__dirname, 'playgrounds/ui/index.html'),
        'playground-fx': resolve(__dirname, 'playgrounds/fx/index.html'),
        'playground-cloud': resolve(__dirname, 'playgrounds/cloud/index.html'),
        'playground-ai': resolve(__dirname, 'playgrounds/ai/index.html')
      }
    }
  }
});
