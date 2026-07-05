import { defineConfig } from 'vite';
import { resolve } from 'path';
import dts from 'vite-plugin-dts';

export default defineConfig({
  plugins: [
    dts({ include: ['src'] })
  ],
  resolve: {
    alias: {
      '@neon/fx': resolve(__dirname, '../neon-fx/src'),
      '@neon/instruments': resolve(__dirname, '../neon-instruments/src')
    }
  },
  build: {
    lib: {
      entry: resolve(__dirname, 'src/index.ts'),
      name: 'NeonEngine',
      formats: ['es', 'iife'],
      fileName: (format) => {
        if (format === 'es') return 'neon-engine.esm.min.js';
        if (format === 'iife') return 'neon-engine.min.js';
        return `neon-engine.${format}.js`;
      }
    },
    rollupOptions: {
      external: ['@neon/fx', '@neon/instruments'],
      output: {
        extend: true,
        globals: {
          '@neon/fx': 'NeonFx',
          '@neon/instruments': 'NeonInstruments'
        }
      }
    },
    minify: 'terser',
    sourcemap: false,
    reportCompressedSize: true
  }
});
