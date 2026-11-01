---
publish: true
id: system-design.non-functional.code-quality-checks.typescript.module-resolution-bundler
title: "Module Resolution: Bundler"
created: 2026-09-19
updated: 2026-11-01
kind: spec
version: 1.1.0
tags:
   - system-design
   - code-quality-check
   - typescript
---

**D45** `decision` #typescript: `tsconfig.base.json` sets `moduleResolution` to `bundler`.

**What we chose:** `"moduleResolution": "bundler"` in `tsconfig.base.json`.

**Why:** There are several moduleResolution strategies in TypeScript:

- `"node"` — the classic Node.js resolution (requires file extensions, doesn't support `exports` field in package.json). Old and increasingly incompatible with modern packages.
- `"node16"` / `"nodenext"` — strict ES module resolution. Requires `.js` extensions on all imports, even for TypeScript files. Very pedantic, lots of friction.
- `"bundler"` — designed for code that runs through a bundler (Next.js, Vite, etc.). No extension requirements, supports `exports` field, matches how bundlers actually resolve modules.

Since all our code runs through Next.js (SWC) or another bundler, `"bundler"` is the right choice. It has the least friction and the most accurate behavior.

## Decision History

- 2026-09-19 · accepted · Module Resolution: Bundler
