---
publish: true
id: decision.technical.flat-config
created: 2026-09-19
kind: decision
version: 1.0.0
tags:
   - decision
   - technical
   - architecture-decision
   - typescript
   - eslint
applies_to:
   - "[[03-system-design/non-functional/code-quality-checks/eslint/flat-config]]"
status: accepted
---

Sidekick to have Eslint 9+ flat config format: `eslint.config.js`.

**Why:** ESLint deprecated the legacy `.eslintrc.*` format in ESLint 9. The new flat config format:

- Is explicit — you import plugins and configs directly rather than referencing them by string name
- Is composable — configs are just arrays of objects
- Has better TypeScript support
- Is the only format that will be supported going forward

**Why `.js` and not `.json`:** ESLint 9's flat config requires a JavaScript file. There is no official JSON alternative. This is the one unavoidable exception to the project's [[prefer-json-config]] rule.
