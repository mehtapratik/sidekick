---
publish: true
id: system-design.non-functional.code-quality-checks.eslint.best-practice-rules
created: 2026-10-16
updated: 2026-10-16
kind: spec
version: 1.1.0
tags:
   - system-design
   - code-quality-check
   - eslint
---

Sidekick's root `eslint.config.js` enforces, on top of `@eslint/js` and `typescript-eslint` recommended:

| Group | Rules | Scope |
| --- | --- | --- |
| Type-only imports | `@typescript-eslint/consistent-type-imports` (separate `import type`), `no-import-type-side-effects`; plus `verbatimModuleSyntax: true` in `tsconfig.base.json` | All TypeScript |
| Promise safety (type-aware) | `no-floating-promises`, `no-misused-promises` (JSX attributes exempt), `await-thenable`, `consistent-type-exports` | All TypeScript |
| Correctness | `eqeqeq` (`== null` allowed), `no-console` (`warn`, `error` allowed) | All JS/TS |
| Imports | `eslint-plugin-import-x`: `import-x/no-duplicates`, `first`, `newline-after-import`, `no-self-import`, `no-cycle`, `no-extraneous-dependencies` (`import-x/extensions` includes TypeScript) | All JS/TS |
| React | `eslint-plugin-react-hooks` recommended (incl. React Compiler checks) | `apps/web`, `packages/ui` |
| Next.js | `@next/eslint-plugin-next` recommended + Core Web Vitals | `apps/web` |

Every linted TypeScript file must belong to a `tsconfig` (`parserOptions.projectService`).

[[eslint-best-practice-rules|rationale]]
