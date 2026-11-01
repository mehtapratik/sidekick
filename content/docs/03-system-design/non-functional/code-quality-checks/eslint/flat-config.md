---
publish: true
id: system-design.non-functional.code-quality-checks.eslint.flat-config
title: Flat Config
created: 2026-09-19
updated: 2026-11-01
kind: spec
version: 1.1.0
tags:
   - system-design
   - code-quality-check
   - eslint
---

**D42** `decision` #eslint: ESLint uses the flat config format in `eslint.config.js`.

Sidekick to have Eslint 9+ flat config format: `eslint.config.js`.

**Why:** ESLint deprecated the legacy `.eslintrc.*` format in ESLint 9. The new flat config format:

- Is explicit — you import plugins and configs directly rather than referencing them by string name
- Is composable — configs are just arrays of objects
- Has better TypeScript support
- Is the only format that will be supported going forward

**Why `.js` and not `.json`:** ESLint 9's flat config requires a JavaScript file. There is no official JSON alternative. This is the one unavoidable exception to the project's [[prefer-json-config]] rule.

## Decision History

- 2026-09-19 · accepted · Flat Config
