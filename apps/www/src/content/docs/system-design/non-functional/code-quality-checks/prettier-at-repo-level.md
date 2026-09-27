---
title: Prettier at repo level
deck: ''
created: '2026-09-19'
updated: '2026-09-27'
kind: spec
status: draft
version: 1.0.0
tags:
  - system-design
  - code-quality-checks
  - prettier
appliesTo: []
isSection: false
docId: system-design.non-functional.code-quality-checks.prettier-at-repo-level
sourcePath: >-
  sources/docs/03-system-design/non-functional/code-quality-checks/prettier-at-repo-level.md
wordCount: 43
readingMinutes: 1
author: Pratik Mehta
license: CC BY-NC 4.0
description: ''
---

Sidekick to have repo level prettier formatting commands instead of fanning out per package.

```
{
	“name”: “sidekick”
	“scripts": {
		// for ci-validations
		“format:check”: “prettier --check  ’**/*’”,
		// for pre-commit hooks and to format manually
		“format”: “prettier --write ‘**/*’”,
	}
}
```

[[why-prettier-at-repo-level?]]
