---
publish: true
id: system-design.non-functional.code-quality-checks.eslint.eslint-plugin-boundaries
title: ESLint Plugin Boundaries
created: 2026-09-19
updated: 2026-11-06
kind: spec
version: 2.3.0
tags:
   - system-design
   - code-quality-check
   - eslint
---

To enforce [[dependency-flow]], `eslint-plugin-boundaries` (v7, `boundaries/dependencies` rule) makes sure dependencies flow only in one direction, from apps down to the foundation: a layer may import any layer below it, never one above it or a sibling in its own layer (diagram in [[dependency-flow]]).

Element types from Phase 3a, when the foundation packages move into `packages/foundation/` and the first platform package lands (until then the config has a `packages/*` catch-all for foundation). Every layer and singleton has an explicit pattern, and there is no catch-all:

```js
// Patterns match relative to the repo root. `pnpm lint` runs ESLint inside each
// package; with the default root (cwd) every file is "unknown" and nothing is enforced.
"boundaries/root-path": import.meta.dirname,
"boundaries/elements": [
	{ type: "site", pattern: "apps/www" }, // before "app": the first match wins
	{ type: "app", pattern: "apps/*" },
	{ type: "feature", pattern: "packages/features/*" },
	{ type: "registry", pattern: "packages/features-registry" },
	{ type: "tooling", pattern: "packages/eslint-plugin-sidekick" },
	{ type: "ops", pattern: "packages/ops" },
	{ type: "platform", pattern: "packages/platform/*" },
	{ type: "foundation", pattern: "packages/foundation/*" }, // core, ui, i18n (copy until I1)
]
```

Allowed dependencies (`policies` with `{ element: { type } }` selectors; everything else is disallowed; imports within one package are not checked):

| From         | May import                                                       |
| ------------ | ---------------------------------------------------------------- |
| `app`        | feature, registry, platform, foundation — not other apps         |
| `site`       | foundation only; nothing imports it ([[D258]])                   |
| `registry`   | feature, platform, foundation                                    |
| `feature`    | platform, foundation — not other features, the registry, or apps |
| `ops`        | registry, platform, foundation; nothing imports it               |
| `platform`   | foundation — not other platform packages until a rule allows it  |
| `foundation` | nothing; loosen deliberately with an explicit rule               |
| `tooling`    | nothing; nothing imports it                                      |

The import resolver's `project` list (the `import/resolver` setting, which boundaries reads) must include every layer folder (`packages/foundation/*/tsconfig.json`, `packages/platform/*/tsconfig.json`, `packages/features/*/tsconfig.json`) and the singletons; otherwise imports inside those packages cannot be resolved and classified. `boundaries/no-unknown-dependencies` (renamed from `no-unknown` in v7) reports imports of unclassifiable files, and the unknown-files rule reports files in no element, so a package created outside the layer folders fails lint instead of silently counting as foundation.

`content/` is not an element: it holds Markdown, which ESLint never reads, and the site reads it by path. Its guard is a check script ([[D259]]).

## Linting the site

The `site` element only works if ESLint runs on `apps/www` (Pratik, 2026-11-06), but the site is temporary and not held to the App's strictness ([[D256]]). So its lint is minimal:

- `apps/www` gets a `lint` script; `eslint-plugin-astro` parses `.astro` files so their frontmatter imports are checked too.
- One override block at the end of `eslint.config.js` turns the strictness rules off for `apps/www/**` (explicit return types, the async handler rules and the rest). `boundaries` and the basics that catch real bugs stay on.
- The Pages Router ban and the Next.js rules keep `files: ["apps/*/pages/**", "apps/*/src/pages/**"]` and gain `ignores: ["apps/www/**"]`, because every Astro page lives in `src/pages/`. An app added later gets the ban by default.
- Built in Phase 3a lesson 1, with the layer folders, since that lesson rewrites this config anyway.

**Verify rules from inside a package**, the way `pnpm lint` runs: a probe run from the repo root passes even when `root-path` is wrong.

[[enforced-conventions|underlying reasoning]]
