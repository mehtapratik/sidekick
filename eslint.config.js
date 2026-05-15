import boundaries from 'eslint-plugin-boundaries';
import importPlugin from 'eslint-plugin-import';
import { defineConfig } from 'eslint/config';
import tseslint from 'typescript-eslint';

import js from '@eslint/js';
import sidekickPlugin from '@sidekick/eslint-plugin-sidekick';

export default defineConfig(
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    plugins: {
      boundaries,
    },
    settings: {
      'boundaries/elements': [
        { type: 'app-elements', pattern: 'apps/*' },
        { type: 'package-elements', pattern: 'packages/*' },
      ],
    },
    rules: {
      'boundaries/no-unknown': 'error',
      'boundaries/element-types': [
        'error',
        {
          default: 'disallow',
          rules: [
            {
              from: 'app-elements',
              allow: ['app-elements', 'package-elements'],
            },
            {
              from: 'package-elements',
              allow: ['package-elements'],
            },
          ],
        },
      ],
    },
  },
  {
    files: ['**/*.cjs'],
    languageOptions: {
      globals: {
        module: 'readonly',
        require: 'readonly',
        exports: 'writable',
        __dirname: 'readonly',
        __filename: 'readonly',
      },
    },
  },
  {
    ignores: ['**/node_modules/**', '**/dist/**', '**/.next/**', '**/.turbo/**'],
  },
  // ── Sidekick plugin rules ────────────────────────────────────────────────
  {
    // Mantine style props banned in all TSX files — use CSS modules instead
    files: ['**/*.tsx'],
    plugins: { sidekick: sidekickPlugin },
    rules: {
      'sidekick/no-mantine-style-props': 'error',
    },
  },
  {
    // No default exports across all TS/TSX source files
    files: ['**/*.ts', '**/*.tsx'],
    plugins: { sidekick: sidekickPlugin },
    rules: {
      'sidekick/no-default-export': 'error',
    },
  },
  {
    // Next.js convention files and TS config files require default exports — exempt them
    files: [
      '**/page.tsx',
      '**/layout.tsx',
      '**/loading.tsx',
      '**/error.tsx',
      '**/not-found.tsx',
      '**/template.tsx',
      '**/*.config.ts',
    ],
    rules: {
      'sidekick/no-default-export': 'off',
    },
  },
  {
    // Barrel re-exports banned inside apps/ — import from source files directly
    files: ['apps/**/*.ts', 'apps/**/*.tsx'],
    plugins: { sidekick: sidekickPlugin },
    rules: {
      'sidekick/no-barrel-exports': 'error',
    },
  },
  // ── TypeScript strictness ─────────────────────────────────────────────────
  {
    // Require explicit return types on all exported functions.
    // Applies to TS/TSX across the whole monorepo — exported functions are
    // public contracts and must not have their return type silently change.
    files: ['**/*.ts', '**/*.tsx'],
    rules: {
      '@typescript-eslint/explicit-module-boundary-types': 'error',
    },
  },
  // ── Styling ───────────────────────────────────────────────────────────────
  {
    // No inline style prop — use CSS modules.
    // No Mantine sx prop — it is a CSS-in-JS escape hatch (already covered by
    // no-mantine-style-props, but this makes the intent explicit).
    files: ['**/*.tsx'],
    plugins: { sidekick: sidekickPlugin },
    rules: {
      'sidekick/no-inline-styles': 'error',
    },
  },
  {
    // Ban CSS-in-JS library imports across the whole codebase.
    // None of these are installed today; this rule prevents them being added.
    files: ['**/*.ts', '**/*.tsx'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: 'styled-components',
              message: 'CSS-in-JS is not allowed. Use CSS modules instead.',
            },
            {
              name: '@emotion/react',
              message: 'CSS-in-JS is not allowed. Use CSS modules instead.',
            },
            {
              name: '@emotion/styled',
              message: 'CSS-in-JS is not allowed. Use CSS modules instead.',
            },
            {
              name: '@emotion/css',
              message: 'CSS-in-JS is not allowed. Use CSS modules instead.',
            },
            {
              name: '@emotion/core',
              message: 'CSS-in-JS is not allowed. Use CSS modules instead.',
            },
            {
              name: '@linaria/core',
              message: 'CSS-in-JS is not allowed. Use CSS modules instead.',
            },
          ],
        },
      ],
    },
  },
  // ── Dependency hygiene ────────────────────────────────────────────────────
  {
    // Every import must be declared in the nearest package.json.
    // Prevents phantom dependencies — packages silently relying on a dep
    // installed by a sibling package rather than their own package.json.
    files: ['**/*.ts', '**/*.tsx'],
    plugins: { import: importPlugin },
    rules: {
      'import/no-extraneous-dependencies': [
        'error',
        {
          // These file patterns are allowed to import devDependencies
          devDependencies: [
            '**/*.test.ts',
            '**/*.test.tsx',
            '**/*.spec.ts',
            '**/*.spec.tsx',
            '**/eslint.config.*',
            '**/stylelint.config.*',
            '**/drizzle.config.*',
            '**/postcss.config.*',
            '**/next.config.*',
            '**/turbo.json',
            // The ESLint plugin itself is a dev-only package
            'packages/eslint-plugin-sidekick/**',
          ],
          optionalDependencies: false,
        },
      ],
    },
  },
);
