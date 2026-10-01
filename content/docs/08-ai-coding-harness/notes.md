---
publish: true
id: harness.notes
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

pnpm approve-builds exceptions

Two packages in Sidekick need native compilation during install:

1. **`sharp`** — Next.js image optimization. Compiles C++ bindings for fast image processing.
2. **`unrs-resolver`** — Used internally by ESLint plugins. Also compiles native code.

Both are legitimate, widely-used packages. Approving them is safe.

```shell
# From the repo root
pnpm approve-builds

# Follow the interactive prompt — select sharp and unrs-resolver
```

You may need to run it inside `apps/web` separately if that package has its own local `node_modules` context (pnpm install contexts are per-workspace, and `apps/web` can have a separate context if it was bootstrapped with `create-next-app`).

## Copies

- Never hardcode a user-visible string in a source file. Always import from `packages/copy`.
- Strings that are purely structural (HTML, CSS class names, internal identifiers) are not "copy" and do not need to live here.
- Technical error messages logged to the server console (not shown to users) are not copy.
