---
publish: true
id: system-design.non-functional.code-quality-checks.prettier-at-repo-level
created: 2026-09-19
updated: 2026-10-16
kind: spec
version: 2.0.0
tags:
   - system-design
   - code-quality-check
   - prettier
---

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

[[why-prettier-at-repo-level]]
