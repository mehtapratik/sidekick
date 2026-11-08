---
publish: true
id: harness.notes
title: Notes
created: 2026-09-19
kind: guidance
version: 1.0.0
tags:
   - ai-coding-harness
   - agent-guidance
   - nextjs
   - eslint
   - pnpm
   - css
---

## 1. pnpm approve-build exceptions

Three packages in Sidekick need script execution during install:

1. **`esbuild`** — Platform-specific binary setup for tooling that bundles with esbuild.
2. **`sharp`** — Next.js image optimization. Compiles C++ bindings for fast image processing.
3. **`unrs-resolver`** — Used internally by ESLint plugins. Also compiles native code.

All three are legitimate, widely-used packages. Approving them is safe.

They are approved in the `allowBuilds` map in `pnpm-workspace.yaml`, which covers every package, `apps/web` included. Do not run `pnpm approve-builds` per app, and do not use the `pnpm.onlyBuiltDependencies` field in `package.json` (pnpm 11 and later ignore it). See [[03-system-design/non-functional/monorepo/approve-builds|approve-builds]].

## Copies

- Never hardcode a user-visible string in a source file. Until lesson I1, import it from `packages/copy`; from I1, it lives in the owning package's catalog ([[03-system-design/non-functional/content/internationalization|Internationalization]], D243 supersedes D36).
- Strings that are purely structural (HTML, CSS class names, internal identifiers) are not "copy" and do not need to live here.
- Technical error messages logged to the server console (not shown to users) are not copy.
