---
id: system-design.non-functional.code-quality-checks.prettier-at-repo-level
created: 2026-09-19
kind: spec
version: 1.0.0
tags:
   - system-design
   - code-quality-checks
   - prettier
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
