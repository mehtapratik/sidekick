---
publish: true
id: system-design.non-functional.code-quality-checks.prettier-at-repo-level
title: Prettier at Repo Level
created: 2026-09-19
updated: 2026-11-11
kind: spec
version: 2.4.0
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
      "format": "prettier --write .",
      "prettier:check": "prettier --check ."
   },
   "lint-staged": {
      "*": "prettier --write --ignore-unknown"
   }
}
```

- **`prettier:check`** runs in CI as the first check; it is the guarantee.
- **Pre-commit:** husky runs `lint-staged`, which formats only the staged files and adds the result to the same commit. It is a convenience: `git commit --no-verify` skips it, and a fresh clone has no hook until `pnpm install` runs `prepare`. Formatting the whole repo in the hook would format unstaged files and leave the commit itself unformatted.
- **`format`** formats the whole repo on demand.
- `.prettierignore` excludes tool-generated files (`apps/app/next-env.d.ts`, Drizzle `migrations/meta/`, `pnpm-lock.yaml`), `content/` (Obsidian writes the vault, [[D216]]) and the files the site ships as given (`public/arkive.css`, `arkive.js`, `src/shiki-themes.mjs`, `public/fonts/`, `public/icons/`).
- The root gains `prettier-plugin-astro` (Lesson 0, PR 1), so `.astro` files are formatted with the rest.
- **Imports are sorted by Prettier** with `@ianvs/prettier-plugin-sort-imports` (2026-11-11, right after Synergy lesson 1, [sidekick#49](https://github.com/mehtapratik/sidekick/pull/49)), listed after `prettier-plugin-astro` in `.prettierrc.json`. `importOrder` sets four groups, separated by one blank line: Node built-ins, packages, Sidekick's own workspace packages (`@sidekick/*`), then relative imports, each A to Z by module path (Pratik, 2026-11-11). The `@sidekick/*` group makes a file's workspace dependencies, the ones boundaries polices, visible at a glance. Side-effect imports (`import 'server-only'`, CSS) stay where they are and sorting never moves an import across them, because their order can matter. `import type` lines stay separate, as `consistent-type-imports` requires. So the order is fixed everywhere Prettier runs: on save in an editor that formats with Prettier, in the pre-commit hook, and in CI's `prettier:check`, which fails a file whose imports are out of order. An editor extension that sorts imports is no longer needed, and one with a different order would fight Prettier.
- **`package.json` files are sorted by Prettier** with `prettier-plugin-packagejson` (2026-11-11, right after Synergy lesson 2), listed last in `.prettierrc.json`. It applies `sort-package-json`'s fixed order: top-level keys in the conventional order (`name`, `version`, `private`, `license`, `type`, `exports`, `scripts`, then `dependencies`, `devDependencies`, `peerDependencies`), and scripts and dependencies A to Z. The first run reordered every workspace `package.json` and nothing else. Like import sorting, the order is now fixed wherever Prettier runs, and CI's `prettier:check` fails an unsorted `package.json`; an editor's own sort-on-save for `package.json` is no longer needed and would fight Prettier.
- The scripts are `prettier --write .` and `prettier --check .` today; `.prettierignore` decides what is skipped, not a glob in the script.

**Rationale:**
Prettier operates on files, not packages. It doesn't understand the package dependency graph and has no concept of "build this package before formatting that one." Running it once from the root is simpler, faster, and correct.

Turborepo caching would also be counterproductive for formatting — Prettier rewrites files in place, which would constantly invalidate the cache.

## Decision History

- 2026-09-19 · accepted · Why Prettier at Repo Level?
- 2026-11-06 · accepted · `content/`, the site's ship-as-given files and `prettier-plugin-astro`
- 2026-11-11 · accepted · Prettier sorts imports (`@ianvs/prettier-plugin-sort-imports`)
- 2026-11-11 · accepted · Prettier sorts `package.json` (`prettier-plugin-packagejson`)
