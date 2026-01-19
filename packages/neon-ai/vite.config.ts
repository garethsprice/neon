import { defineConfig } from 'vite';
import dts from 'vite-plugin-dts';

export default defineConfig({
  plugins: [
    dts({ include: ['src'] })
  ],
  build: {
    lib: {
      entry: 'src/index.ts',
      formats: ['es', 'iife'],
      name: 'NeonAi',
      fileName: (format) => format === 'es' ? 'neon-ai.esm.min.js' : 'neon-ai.min.js'
    },
    minify: true,
    sourcemap: false
  }
});
