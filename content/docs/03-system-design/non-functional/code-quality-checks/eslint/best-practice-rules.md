---
publish: true
id: system-design.non-functional.code-quality-checks.eslint.best-practice-rules
title: Best Practice Rules
created: 2026-10-16
updated: 2026-11-01
kind: spec
version: 1.2.0
tags:
   - system-design
   - code-quality-check
   - eslint
---

Sidekick's root `eslint.config.js` enforces, on top of `@eslint/js` and `typescript-eslint` recommended:

| Group                       | Rules                                                                                                                                                                                       | Scope                     |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------- |
| Type-only imports           | `@typescript-eslint/consistent-type-imports` (separate `import type`), `no-import-type-side-effects`; plus `verbatimModuleSyntax: true` in `tsconfig.base.json`                             | All TypeScript            |
| Promise safety (type-aware) | `no-floating-promises`, `no-misused-promises` (JSX attributes exempt), `await-thenable`, `consistent-type-exports`                                                                          | All TypeScript            |
| Correctness                 | `eqeqeq` (`== null` allowed), `no-console` (`warn`, `error` allowed)                                                                                                                        | All JS/TS                 |
| Imports                     | `eslint-plugin-import-x`: `import-x/no-duplicates`, `first`, `newline-after-import`, `no-self-import`, `no-cycle`, `no-extraneous-dependencies` (`import-x/extensions` includes TypeScript) | All JS/TS                 |
| React                       | `eslint-plugin-react-hooks` recommended (incl. React Compiler checks)                                                                                                                       | `apps/web`, `packages/ui` |
| Next.js                     | `@next/eslint-plugin-next` recommended + Core Web Vitals                                                                                                                                    | `apps/web`                |

Every linted TypeScript file must belong to a `tsconfig` (`parserOptions.projectService`).

**What we chose:** a curated set of widely used ESLint rules on top of `@eslint/js` and `typescript-eslint` recommended, plus `verbatimModuleSyntax` in `tsconfig.base.json`. Each rule targets a class of bug, not a style preference — formatting stays with Prettier.

**Why each group:**

- **Type-only imports** (`consistent-type-imports`, `no-import-type-side-effects`, `verbatimModuleSyntax`): a module imported only for its types must never reach the bundle or run its side effects. `verbatimModuleSyntax` makes the compiler refuse a type imported as a value; the lint rule adds editor feedback and an autofix. Enforced, not advised.
- **Promise safety** (`no-floating-promises`, `no-misused-promises`, `await-thenable`, `consistent-type-exports`): these read the TypeScript program. A forgotten `await` — for example on a database write — otherwise fails silently. `no-misused-promises` skips JSX attributes, because React ignores an event handler's return value; promises inside handlers are still checked.
- **Correctness** (`eqeqeq` with `== null` allowed, `no-console` with `warn`/`error` allowed).
- **Import hygiene** (`import-x/no-duplicates`, `first`, `newline-after-import`, `no-self-import`, `no-cycle`): `no-cycle` matters most — circular imports between modules cause load-order bugs. ESLint 10 dropped `eslint-plugin-import` support, so Sidekick uses its maintained fork `eslint-plugin-import-x`; its `import-x/extensions` setting must include TypeScript, or `no-cycle` silently skips `.ts` imports.
- **React** (`eslint-plugin-react-hooks` recommended, including the React Compiler checks) for `apps/web` and `packages/ui`: the Rules of Hooks were not checked anywhere before.
- **Next.js** (`@next/eslint-plugin-next` recommended + Core Web Vitals) for `apps/web`. `eslint-config-next` was installed in `apps/web` but never loaded, so it was removed; the root `eslint.config.js` is the only config.

**Trade-off:** the type-aware rules need `parserOptions.projectService`, so every linted TypeScript file must belong to a `tsconfig`, and lint is slower (about 7.6 s uncached for the whole repo in October 2026).

**Not adopted (yet):** `import/order` — the codebase already groups imports consistently, and an enforced order would churn every file and may conflict with editor import organizing. `jsx-a11y` — worth revisiting when the UI grows.

## Decision History

- 2026-10-16 · accepted · ESLint Best Practice Rules
