import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';
import globals from 'globals';

export default tseslint.config(
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.node,
      },
    },
  },
  {
    rules: {
      // Relax some rules for pragmatic development
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-unused-vars': ['error', {
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_',
      }],
      'no-console': ['warn', { allow: ['warn', 'error'] }],
      'prefer-const': 'error',
    },
  },
  {
    ignores: [
      '**/dist/**',
      '**/node_modules/**',
      '**/*.min.js',
      'tools/**',
      'playgrounds/**',
      'coverage/**',
      // Old JS files at package roots (migrated to src/*.ts)
      'packages/neon-fx/*.js',
      'packages/neon-ui/*.js',
      'packages/neon-cloud/*.js',
      'packages/neon-fx/__mocks__/**',
    ],
  }
);
