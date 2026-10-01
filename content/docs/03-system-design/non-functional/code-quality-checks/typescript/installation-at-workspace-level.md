---
publish: true
id: system-design.non-functional.code-quality-checks.typescript.installation-at-workspace-level
created: 2026-09-19
kind: spec
version: 1.0.0
tags:
   - system-design
   - code-quality-checks
   - typescript
   - pnpm
---

To ensure every package in monorepo use same Typescript version, install typescript as a `devDependency` at workspace root (`pnpm add -D -w typescript`).

[[typescript-hoisting]]
