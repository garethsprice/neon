import { defineConfig, Plugin } from 'vite';
import { resolve } from 'path';

// Plugin to inject external package scripts in production builds
function injectNeonPackages(): Plugin {
  // Configure CDN URLs for production (update these for your deployment)
  const packageUrls = {
    'neon-fx': process.env.NEON_FX_URL || '/libs/neon-fx.min.js',
    'neon-ui': process.env.NEON_UI_URL || '/libs/neon-ui.min.js',
    'neon-cloud': process.env.NEON_CLOUD_URL || '/libs/neon-cloud.min.js',
    'neon-ai': process.env.NEON_AI_URL || '/libs/neon-ai.min.js',
    'neon-instruments': process.env.NEON_INSTRUMENTS_URL || '/libs/neon-instruments.min.js',
    'neon-engine': process.env.NEON_ENGINE_URL || '/libs/neon-engine.min.js',
  };

  return {
    name: 'inject-neon-packages',
    apply: 'build', // Only run during build
    transformIndexHtml(html) {
      const scripts = Object.values(packageUrls)
        .map(url => `<script src="${url}"></script>`)
        .join('\n    ');

      // Inject before closing </head> tag
      return html.replace('</head>', `    ${scripts}\n</head>`);
    }
  };
}

export default defineConfig({
  plugins: [injectNeonPackages()],
  resolve: {
    alias: {
      // Dev mode: resolve to source for HMR
      '@neon/ui': resolve(__dirname, '../../packages/neon-ui/src'),
      '@neon/fx': resolve(__dirname, '../../packages/neon-fx/src'),
      '@neon/cloud': resolve(__dirname, '../../packages/neon-cloud/src'),
      '@neon/ai': resolve(__dirname, '../../packages/neon-ai/src'),
      '@neon/instruments': resolve(__dirname, '../../packages/neon-instruments/src'),
      '@neon/engine': resolve(__dirname, '../../packages/neon-engine/src')
    }
  },
  server: {
    port: 3001
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
    minify: false, // Keep code readable for vibe coders
    cssMinify: false,
    rollupOptions: {
      // Externalize packages for production - they'll be loaded via script tags
      external: ['@neon/ui', '@neon/fx', '@neon/cloud', '@neon/ai', '@neon/instruments', '@neon/engine'],
      output: {
        // Map external imports to global variables
        globals: {
          '@neon/ui': 'NeonUI',
          '@neon/fx': 'NeonFx',
          '@neon/cloud': 'NeonCloud',
          '@neon/ai': 'NeonAi',
          '@neon/instruments': 'NeonInstruments',
          '@neon/engine': 'NeonEngine'
        },
        // Simple filenames in root for easy modification
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
