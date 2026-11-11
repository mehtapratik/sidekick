---
publish: true
id: system-design.non-functional.code-quality-checks.eslint.eslint-plugin-boundaries
title: ESLint Plugin Boundaries
created: 2026-09-19
updated: 2026-11-11
kind: spec
version: 2.4.0
tags:
   - system-design
   - code-quality-check
   - eslint
---

To enforce [[dependency-flow]], `eslint-plugin-boundaries` (v7, `boundaries/dependencies` rule) makes sure dependencies flow only in one direction, from apps down to the foundation: a layer may import any layer below it, never one above it or a sibling in its own layer (diagram in [[dependency-flow]]).

Element types since Phase 3a lesson 1, which moved the foundation packages into `packages/foundation/` and added the first platform package. Every layer and singleton has an explicit pattern, and there is no catch-all:

```js
// Patterns match relative to the repo root. `pnpm lint` runs ESLint inside each
// package; with the default root (cwd) every file is "unknown" and nothing is enforced.
"boundaries/root-path": import.meta.dirname,
"boundaries/elements": [
	{ type: "site", pattern: "apps/www" }, // before "app": the first match wins
	{ type: "app", pattern: "apps/*" },
	{ type: "registry", pattern: "packages/features-registry" },
	{ type: "feature", pattern: "packages/features/*" },
	{ type: "platform", pattern: "packages/platform/*" },
	// core, ui, i18n (copy until I1); `package` captures the folder name
	{ type: "foundation", pattern: "packages/foundation/*", capture: ["package"] },
	{ type: "tooling", pattern: "packages/eslint-plugin-sidekick" },
	{ type: "ops", pattern: "packages/ops" },
]
```

Allowed dependencies (`policies` with `{ element: { type } }` selectors; everything else is disallowed; imports within one package are not checked):

| From         | May import                                                       |
| ------------ | ---------------------------------------------------------------- |
| `app`        | feature, registry, platform, foundation — not other apps         |
| `site`       | foundation except `core`; nothing imports it ([[D258]])          |
| `registry`   | feature, platform, foundation                                    |
| `feature`    | platform, foundation — not other features, the registry, or apps |
| `ops`        | registry, platform, foundation; nothing imports it               |
| `platform`   | foundation — not other platform packages until a rule allows it  |
| `foundation` | nothing; loosen deliberately with an explicit rule               |
| `tooling`    | nothing; nothing imports it                                      |

The import resolver's `project` list (the `import/resolver` setting, which boundaries reads) must include every layer folder (`packages/foundation/*/tsconfig.json`, `packages/platform/*/tsconfig.json`, `packages/features/*/tsconfig.json`) and the singletons; otherwise imports inside those packages cannot be resolved and classified. `boundaries/no-unknown-dependencies` (renamed from `no-unknown` in v7) reports imports of unclassifiable files, and the unknown-files rule reports files in no element, so a package created outside the layer folders fails lint instead of silently counting as foundation.

The site's rule is two policies: an `allow` to `foundation`, then a `disallow` to `{ type: "foundation", captured: { package: "core" } }`. When policies conflict the later one wins, and the error names the denying policy ("Denied by policy at index 6"). `core` is itself a foundation package, so the `allow` alone would let the site import it; lesson 1's probe caught that.

Repo-root files (`eslint.config.js`, `stylelint.config.js`, `scripts/`) sit in no element. `pnpm lint` never lints them, but editors do, so one block turns `boundaries/no-unknown-files` off for `*.{js,mjs,cjs,ts}` and `scripts/**`. A pattern without a slash matches only the config's own folder, so no package file is exempt.

`content/` is not an element: it holds Markdown, which ESLint never reads, and the site reads it by path. Its guard is a check script ([[D259]]).

## Linting the site

The `site` element only works if ESLint runs on `apps/www` (Pratik, 2026-11-06), but the site is temporary and not held to the App's strictness ([[D256]]). So its lint is minimal:

- `apps/www` gets a `lint` script; `eslint-plugin-astro` parses `.astro` files so their frontmatter imports are checked too.
- One override block at the end of `eslint.config.js` turns the App's strictness off for `apps/www/**`: explicit return types, `import type` and interface-over-type. It declares `process` and `console` for the Node build scripts, allows `console`, lets `no-unused-vars` ignore rest siblings and turns `no-useless-escape` off. `boundaries`, the `js` and `typescript-eslint` recommended sets, the restricted imports and the type-aware promise checks stay on.
- The Pages Router ban keeps `files: ["apps/*/pages/**", "apps/*/src/pages/**"]` and gains `ignores: ["apps/www/**"]`, because Astro routes from `src/pages/` too. An app added later gets the ban by default. The Next.js and React hooks rules already target `apps/app/**` only, so they need no change.
- `**/.astro/**` (Astro's generated types, which boundaries reports as unknown files) and `apps/www/public/**` (shipped as given) are global ignores.
- `eslint-plugin-astro` is a root dev dependency, like every plugin `eslint.config.js` imports.
- Built in Phase 3a lesson 1, with the layer folders.

**Verify rules from inside a package**, the way `pnpm lint` runs: a probe run from the repo root passes even when `root-path` is wrong.

[[enforced-conventions|underlying reasoning]]
