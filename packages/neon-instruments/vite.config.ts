import { defineConfig } from 'vite';
import { resolve } from 'path';
import dts from 'vite-plugin-dts';

export default defineConfig({
  plugins: [
    dts({ include: ['src'] })
  ],
  resolve: {
    alias: {
      '@neon/fx': resolve(__dirname, '../neon-fx/src')
    }
  },
  build: {
    lib: {
      entry: resolve(__dirname, 'src/index.ts'),
      name: 'NeonInstruments',
      formats: ['es', 'iife'],
      fileName: (format) => {
        if (format === 'es') return 'neon-instruments.esm.min.js';
        if (format === 'iife') return 'neon-instruments.min.js';
        return `neon-instruments.${format}.js`;
      }
    },
    rollupOptions: {
      external: ['@neon/fx'],
      output: {
        extend: true,
        globals: {
          '@neon/fx': 'NeonFx'
        }
      }
    },
    minify: 'terser',
    sourcemap: false,
    reportCompressedSize: true
  }
});
