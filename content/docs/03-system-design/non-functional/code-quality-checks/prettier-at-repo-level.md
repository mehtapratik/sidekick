---
publish: true
id: system-design.non-functional.code-quality-checks.prettier-at-repo-level
title: Prettier at Repo Level
created: 2026-09-19
updated: 2026-11-01
kind: spec
version: 2.1.0
tags:
   - system-design
   - code-quality-check
   - prettier
---

**D56** `decision` #formatting: Prettier runs once from the repo root, not once per package.

Sidekick has repo-level Prettier commands instead of fanning out per package:

```json
{
   "scripts": {
      "format": "prettier --write \"**/*.{js,jsx,ts,tsx,json,md}\"",
      "prettier:check": "prettier --check \"**/*.{js,jsx,ts,tsx,json,md}\""
   },
   "lint-staged": {
      "*.{js,jsx,ts,tsx,json,md}": "prettier --write"
   }
}
```

- **`prettier:check`** runs in CI as the first check; it is the guarantee.
- **Pre-commit:** husky runs `lint-staged`, which formats only the staged files and adds the result to the same commit. It is a convenience: `git commit --no-verify` skips it, and a fresh clone has no hook until `pnpm install` runs `prepare`. Formatting the whole repo in the hook would format unstaged files and leave the commit itself unformatted.
- **`format`** formats the whole repo on demand.
- `.prettierignore` excludes tool-generated files (`apps/web/next-env.d.ts`, Drizzle `migrations/meta/`).

**Rationale:**
Prettier operates on files, not packages. It doesn't understand the package dependency graph and has no concept of "build this package before formatting that one." Running it once from the root is simpler, faster, and correct.

Turborepo caching would also be counterproductive for formatting — Prettier rewrites files in place, which would constantly invalidate the cache.

## Decision History

- 2026-09-19 · accepted · Why Prettier at Repo Level?
