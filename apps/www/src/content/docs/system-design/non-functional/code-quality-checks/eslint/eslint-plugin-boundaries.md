---
title: ESLint plugin boundaries
deck: ''
created: '2026-09-19'
updated: '2026-09-27'
kind: spec
status: draft
version: 1.0.0
tags:
  - system-design
  - code-quality-checks
  - eslint
appliesTo: []
isSection: false
docId: >-
  system-design.non-functional.code-quality-checks.eslint.eslint-plugin-boundaries
sourcePath: >-
  sources/docs/03-system-design/non-functional/code-quality-checks/eslint/eslint-plugin-boundaries.md
wordCount: 44
readingMinutes: 1
author: Pratik Mehta
license: CC BY-NC 4.0
description: ''
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
