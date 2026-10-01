---
publish: true
id: system-design.non-functional.code-quality-checks.eslint.eslint-plugin-boundaries
created: 2026-09-19
kind: spec
version: 1.0.0
tags:
   - system-design
   - code-quality-checks
   - eslint
---

To enforce [[dependency-flow]] we will have a custom eslint rule, `eslint-plugin-boundaries` to make sure dependencies flow only in one direction.

How the rule is configured:

```js
"boundaries/elements": [
	{ type: "app-elements", pattern: "apps/*" },
	{ type: "package-elements", pattern: "packages/*" },
]
```

[[enforced-conventions|underlying reasoning]]
