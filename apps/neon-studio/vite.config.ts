import { defineConfig, Plugin } from 'vite';
import { resolve } from 'path';

// Plugin to inject external package scripts in production builds
function injectNeonPackages(): Plugin {
  const packageUrls = {
    'neon-fx': process.env.NEON_FX_URL || '/libs/neon-fx.min.js',
    'neon-ui': process.env.NEON_UI_URL || '/libs/neon-ui.min.js',
    'neon-cloud': process.env.NEON_CLOUD_URL || '/libs/neon-cloud.min.js',
    'neon-ai': process.env.NEON_AI_URL || '/libs/neon-ai.min.js',
    'neon-instruments': process.env.NEON_INSTRUMENTS_URL || '/libs/neon-instruments.min.js',
    'neon-engine': process.env.NEON_ENGINE_URL || '/libs/neon-engine.min.js'
  };

  return {
    name: 'inject-neon-packages',
    apply: 'build',
    transformIndexHtml(html) {
      const scripts = Object.values(packageUrls)
        .map(url => `<script src="${url}"></script>`)
        .join('\n    ');
      return html.replace('</head>', `    ${scripts}\n</head>`);
    }
  };
}

export default defineConfig({
  plugins: [injectNeonPackages()],
  resolve: {
    alias: {
      '@neon/ui': resolve(__dirname, '../../packages/neon-ui/src'),
      '@neon/fx': resolve(__dirname, '../../packages/neon-fx/src'),
      '@neon/cloud': resolve(__dirname, '../../packages/neon-cloud/src'),
      '@neon/ai': resolve(__dirname, '../../packages/neon-ai/src'),
      '@neon/instruments': resolve(__dirname, '../../packages/neon-instruments/src'),
      '@neon/engine': resolve(__dirname, '../../packages/neon-engine/src')
    }
  },
  server: {
    port: 3004
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
    minify: false,
    cssMinify: false,
    rollupOptions: {
      external: ['@neon/ui', '@neon/fx', '@neon/cloud', '@neon/ai', '@neon/instruments', '@neon/engine'],
      output: {
        globals: {
          '@neon/ui': 'NeonUI',
          '@neon/fx': 'NeonFx',
          '@neon/cloud': 'NeonCloud',
          '@neon/ai': 'NeonAi',
          '@neon/instruments': 'NeonInstruments',
          '@neon/engine': 'NeonEngine'
        },
        entryFileNames: 'scripts.js',
        assetFileNames: (assetInfo) => {
          if (assetInfo.name?.endsWith('.css')) {
            return 'style.css';
          }
          return '[name][extname]';
        }
      }
    }
  }
});
