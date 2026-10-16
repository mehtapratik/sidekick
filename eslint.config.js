import boundaries from 'eslint-plugin-boundaries';
import importPlugin from 'eslint-plugin-import';
import { defineConfig } from 'eslint/config';
import tseslint from 'typescript-eslint';

import js from '@eslint/js';
import sidekickPlugin from '@sidekick/eslint-plugin-sidekick';

const cssInJsImports = [
  'styled-components',
  '@emotion/react',
  '@emotion/styled',
  '@emotion/css',
  '@emotion/core',
  '@linaria/core',
];

const cssInJsBans = cssInJsImports.map((lib) => ({
  name: lib,
  message: 'CSS-in-JS disallowed: use CSS modules instead',
}));

// `paths` match an import's exact text; `patterns` take globs. Both match the
// text as written, not the resolved file — so `**/unsafe` (not `**/db/unsafe`)
// is needed to also catch `./unsafe` and `../unsafe` from inside db/.
const adminClientMessage =
  'The Supabase admin client bypasses RLS. If this is truly needed, add a reviewed per-file exception in eslint.config.js.';

const adminClientPathBan = {
  name: '@sidekick/core/supabase/admin',
  message: adminClientMessage,
};

const adminClientPatternBan = {
  group: ['**/supabase/admin'],
  message: adminClientMessage,
};

const unsafeDbPatternBan = {
  group: ['**/unsafe'],
  message:
    'The raw database client runs queries without a user context. Use withRLS from "@sidekick/core/db" instead.',
};

export default defineConfig(
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    plugins: {
      boundaries,
    },
    settings: {
      // A file belongs to the first element whose pattern matches, so specific
      // patterns come before the catch-all `packages/*`.
      'boundaries/elements': [
        { type: 'app', pattern: 'apps/*' },
        { type: 'feature', pattern: 'packages/features/*' },
        { type: 'registry', pattern: 'packages/features-registry' },
        { type: 'tooling', pattern: 'packages/eslint-plugin-sidekick' },
        // core, ui, copy
        { type: 'foundation', pattern: 'packages/*' },
      ],
      'import/resolver': {
        typescript: {
          alwaysTryTypes: true,
          noWarnOnMultipleProjects: true,
          project: [
            'tsconfig.base.json',
            'apps/*/tsconfig.json',
            'packages/*/tsconfig.json',
            'packages/features/*/tsconfig.json',
          ],
        },
      },
    },
    rules: {
      'boundaries/no-unknown': 'error',
      // Dependency direction: apps → registry → features → foundation.
      // Everything not allowed here is disallowed. Imports within one package
      // are never checked. Foundation packages (core, ui, copy) and tooling
      // import no other workspace package; loosen deliberately with a new rule.
      'boundaries/dependencies': [
        'error',
        {
          default: 'disallow',
          rules: [
            {
              from: { type: 'app' },
              allow: { to: { type: ['feature', 'registry', 'foundation'] } },
            },
            {
              from: { type: 'registry' },
              allow: { to: { type: ['feature', 'foundation'] } },
            },
            {
              from: { type: 'feature' },
              allow: { to: { type: 'foundation' } },
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
    // Restricted imports across the whole codebase:
    // - CSS-in-JS libraries (use CSS modules)
    // - the raw database client (use withRLS) and the RLS-bypassing admin client
    // Flat config replaces, not merges, a rule's options per block — any later
    // block that sets no-restricted-imports must repeat every ban it keeps.
    files: ['**/*.ts', '**/*.tsx'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [...cssInJsBans, adminClientPathBan],
          patterns: [unsafeDbPatternBan, adminClientPatternBan],
        },
      ],
    },
  },
  {
    // The single file allowed to import the raw database client: withRLS is
    // built on it. Every other ban still applies here.
    files: ['packages/core/src/db/rls.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [...cssInJsBans, adminClientPathBan],
          patterns: [adminClientPatternBan],
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
            '**/vitest.config.*',
            // The ESLint plugin itself is a dev-only package
            'packages/eslint-plugin-sidekick/**',
          ],
          optionalDependencies: false,
        },
      ],
    },
  },
);
