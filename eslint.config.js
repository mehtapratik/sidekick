import boundaries from 'eslint-plugin-boundaries';
import { createTypeScriptImportResolver } from 'eslint-import-resolver-typescript';
import importX from 'eslint-plugin-import-x';
import reactHooks from 'eslint-plugin-react-hooks';
import { defineConfig } from 'eslint/config';
import tseslint from 'typescript-eslint';

import js from '@eslint/js';
import nextPlugin from '@next/eslint-plugin-next';
import sidekickPlugin from '@sidekick/eslint-plugin-sidekick';

// ── Request entry points ────────────────────────────────────────────────────
// Every request must enter through an App Router route handler wrapped in
// withApiGuard (sidekick/require-api-guard). These bans close the other ways
// Next.js can serve a request. apps/web's build also verifies the built
// endpoint list (apps/web/scripts/verify-endpoints.mjs).
// Composed per block: flat config replaces no-restricted-syntax per block.
const serverActionBan = {
  selector: 'ExpressionStatement[directive="use server"]',
  message:
    'Server Actions are not allowed: each one is a public POST endpoint outside withApiGuard. Go through the public API instead (see the server-actions note).',
};

const pagesRouterBan = {
  selector: 'Program',
  message:
    'The Pages Router is not used: any file under pages/api becomes an unguarded endpoint. Use an App Router route handler with withApiGuard.',
};

const pageExtensionsBan = {
  selector: 'Property[key.name="pageExtensions"], Property[key.value="pageExtensions"]',
  message:
    'pageExtensions changes which files Next.js serves as routes, so sidekick/require-api-guard would miss them. Keep the default.',
};

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

const tsProjects = [
  'tsconfig.base.json',
  'apps/*/tsconfig.json',
  'packages/*/tsconfig.json',
  'packages/features/*/tsconfig.json',
];

export default defineConfig(
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    plugins: {
      boundaries,
    },
    settings: {
      // Element patterns are matched relative to this root. `pnpm lint` runs
      // ESLint from inside each package (cwd = packages/core, …), where the
      // default root (cwd) makes every file "unknown" and boundaries silently
      // enforces nothing — so the repo root is set explicitly.
      'boundaries/root-path': import.meta.dirname,
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
      // eslint-plugin-boundaries resolves imports through the `import/resolver`
      // setting; eslint-plugin-import-x uses `import-x/resolver-next`. Both
      // point at the same TypeScript projects.
      'import/resolver': {
        typescript: {
          alwaysTryTypes: true,
          noWarnOnMultipleProjects: true,
          project: tsProjects,
        },
      },
      // import-x only parses these extensions when following imports (no-cycle,
      // no-duplicates across files); its default omits TypeScript.
      'import-x/extensions': ['.ts', '.tsx', '.cts', '.mts', '.js', '.jsx', '.cjs', '.mjs'],
      'import-x/resolver-next': [
        createTypeScriptImportResolver({
          alwaysTryTypes: true,
          noWarnOnMultipleProjects: true,
          project: tsProjects,
        }),
      ],
    },
    rules: {
      'boundaries/no-unknown-dependencies': 'error',
      // Dependency direction: apps → registry → features → foundation.
      // Everything not allowed here is disallowed. Imports within one package
      // are never checked. Foundation packages (core, ui, copy) and tooling
      // import no other workspace package; loosen deliberately with a new rule.
      'boundaries/dependencies': [
        'error',
        {
          default: 'disallow',
          policies: [
            {
              from: { element: { type: 'app' } },
              allow: { to: { element: { type: ['feature', 'registry', 'foundation'] } } },
            },
            {
              from: { element: { type: 'registry' } },
              allow: { to: { element: { type: ['feature', 'foundation'] } } },
            },
            {
              from: { element: { type: 'feature' } },
              allow: { to: { element: { type: 'foundation' } } },
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
    // Build output, and next-env.d.ts, which Next.js generates and rewrites
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/.next/**',
      '**/.turbo/**',
      '**/next-env.d.ts',
    ],
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
  {
    // Every App Router route handler must be wrapped in withApiGuard: the proxy
    // does not authenticate /api routes, so an unguarded handler is public.
    // Matches Next.js route files in every app — not utilities such as
    // utils/route.ts. Covers both app/ and src/app/ layouts.
    files: ['apps/*/src/app/**/route.{ts,tsx,js,jsx}', 'apps/*/app/**/route.{ts,tsx,js,jsx}'],
    plugins: { sidekick: sidekickPlugin },
    rules: {
      'sidekick/require-api-guard': 'error',
    },
  },
  {
    files: ['**/*.{ts,tsx,js,jsx,mjs,cjs}'],
    rules: {
      'no-restricted-syntax': ['error', serverActionBan],
    },
  },
  {
    files: ['apps/*/pages/**', 'apps/*/src/pages/**'],
    rules: {
      'no-restricted-syntax': ['error', serverActionBan, pagesRouterBan],
    },
  },
  {
    files: ['apps/*/next.config.*'],
    rules: {
      'no-restricted-syntax': ['error', serverActionBan, pageExtensionsBan],
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
  {
    // Type-only imports must say so (`import type { X }`). The compiler drops
    // them, so a module imported only for its types never reaches the bundle
    // or runs its side effects. tsconfig's verbatimModuleSyntax enforces the
    // same at compile time; this rule adds editor feedback and an autofix.
    files: ['**/*.ts', '**/*.tsx'],
    rules: {
      '@typescript-eslint/consistent-type-imports': [
        'error',
        { prefer: 'type-imports', fixStyle: 'separate-type-imports' },
      ],
      '@typescript-eslint/no-import-type-side-effects': 'error',
    },
  },
  {
    // Object shapes are interfaces: `extends` reports clearer errors and
    // type-checks faster than `&` intersections. The rule flags only
    // `type X = { … }`, so unions, tuples, function, mapped and conditional
    // types stay `type`, which is where an interface can't express them.
    files: ['**/*.ts', '**/*.tsx'],
    rules: {
      '@typescript-eslint/consistent-type-definitions': ['error', 'interface'],
    },
  },
  {
    // Type-aware rules: they read the TypeScript program, so they catch what
    // syntax alone cannot — above all, promises nobody awaits or handles
    // (a forgotten `await` on a database write fails silently).
    files: ['**/*.ts', '**/*.tsx'],
    languageOptions: {
      parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname },
    },
    rules: {
      '@typescript-eslint/no-floating-promises': 'error',
      // React ignores an event handler's return value, so async handlers in
      // JSX attributes are fine; every other promise misuse is reported.
      '@typescript-eslint/no-misused-promises': [
        'error',
        { checksVoidReturn: { attributes: false } },
      ],
      '@typescript-eslint/await-thenable': 'error',
      '@typescript-eslint/consistent-type-exports': 'error',
    },
  },
  // ── Correctness ───────────────────────────────────────────────────────────
  {
    files: ['**/*.{ts,tsx,js,jsx,mjs,cjs}'],
    rules: {
      // `==` coerces types; `== null` (null or undefined) stays allowed
      'eqeqeq': ['error', 'always', { null: 'ignore' }],
      // Stray console.log calls; warn/error remain for real diagnostics
      'no-console': ['error', { allow: ['warn', 'error'] }],
    },
  },
  {
    files: ['**/*.{ts,tsx,js,jsx,mjs,cjs}'],
    plugins: { 'import-x': importX },
    rules: {
      'import-x/no-duplicates': 'error',
      'import-x/first': 'error',
      'import-x/newline-after-import': 'error',
      'import-x/no-self-import': 'error',
      'import-x/no-cycle': 'error',
    },
  },
  {
    // The structured logger is the one file that writes logs with console.log:
    // every other file logs through it. warn and error stay allowed everywhere.
    files: ['packages/core/src/observability/log.ts'],
    rules: {
      'no-console': ['error', { allow: ['log', 'warn', 'error'] }],
    },
  },
  // ── React and Next.js ─────────────────────────────────────────────────────
  {
    // Rules of Hooks, exhaustive deps, and the React Compiler's checks
    ...reactHooks.configs.flat.recommended,
    files: ['apps/web/**/*.{ts,tsx}', 'packages/ui/**/*.{ts,tsx}'],
  },
  {
    files: ['apps/web/**/*.{ts,tsx,js,jsx}'],
    plugins: { '@next/next': nextPlugin },
    settings: { next: { rootDir: 'apps/web' } },
    rules: {
      ...nextPlugin.configs.recommended.rules,
      ...nextPlugin.configs['core-web-vitals'].rules,
      // Checks links to Pages Router pages only; the Pages Router is banned
      // (see pagesRouterBan), and the rule warns when pages/ does not exist.
      '@next/next/no-html-link-for-pages': 'off',
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
    plugins: { 'import-x': importX },
    rules: {
      'import-x/no-extraneous-dependencies': [
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
