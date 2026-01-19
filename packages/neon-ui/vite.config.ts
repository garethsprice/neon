import { defineConfig } from 'vite';
import { resolve } from 'path';
import dts from 'vite-plugin-dts';

export default defineConfig({
  plugins: [
    dts({
      include: ['src'],
      outDir: 'dist'
    })
  ],
  build: {
    lib: {
      entry: resolve(__dirname, 'src/index.ts'),
      name: 'NeonUI',
      formats: ['es', 'iife'],
      fileName: (format) => {
        if (format === 'es') return 'neon-ui.esm.min.js';
        if (format === 'iife') return 'neon-ui.min.js';
        return `neon-ui.${format}.js`;
      }
    },
    rollupOptions: {
      external: [],
      output: {
        extend: true,
        globals: {}
      }
    },
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: true,
        drop_debugger: true,
        pure_funcs: ['console.log', 'console.info', 'console.debug'],
        passes: 3,
        unsafe: true,
        unsafe_comps: true,
        unsafe_math: true,
        unsafe_proto: true,
        dead_code: true,
        collapse_vars: true,
        reduce_vars: true,
        keep_infinity: true,
        ecma: 2020
      },
      mangle: {
        properties: false,
        toplevel: true
      },
      format: {
        comments: false,
        ecma: 2020
      }
    },
    sourcemap: false,
    reportCompressedSize: true
  }
});
