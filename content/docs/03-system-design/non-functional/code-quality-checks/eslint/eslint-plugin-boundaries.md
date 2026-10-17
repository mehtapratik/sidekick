---
publish: true
id: system-design.non-functional.code-quality-checks.eslint.eslint-plugin-boundaries
created: 2026-09-19
updated: 2026-10-16
kind: spec
version: 2.0.0
tags:
   - system-design
   - code-quality-check
   - eslint
---

To enforce [[dependency-flow]], `eslint-plugin-boundaries` (v6, `boundaries/dependencies` rule) makes sure dependencies flow only in one direction: apps → registry → features → foundation.

Element types — a file belongs to the first matching pattern, so specific patterns come before the catch-all:

```js
"boundaries/elements": [
	{ type: "app", pattern: "apps/*" },
	{ type: "feature", pattern: "packages/features/*" },
	{ type: "registry", pattern: "packages/features-registry" },
	{ type: "tooling", pattern: "packages/eslint-plugin-sidekick" },
	{ type: "foundation", pattern: "packages/*" }, // core, ui, copy
]
```

Allowed dependencies (everything else is disallowed; imports within one package are not checked):

| From | May import |
| --- | --- |
| `app` | feature, registry, foundation — not other apps |
| `registry` | feature, foundation |
| `feature` | foundation — not other features, the registry, or apps |
| `foundation` | nothing; loosen deliberately with an explicit rule |
| `tooling` | nothing; nothing imports it |

The import resolver's `project` list must include `packages/features/*/tsconfig.json`; otherwise imports inside feature packages cannot be resolved and classified.

[[enforced-conventions|underlying reasoning]]
