---
title: Flat config
deck: ''
created: '2026-09-19'
updated: '2026-09-27'
kind: decision
status: approved
version: 1.0.0
tags:
  - decisions
  - technical
  - architecture-decision
  - typescript
  - eslint
appliesTo:
  - 03-system-design/non-functional/code-quality-checks/eslint/flat-config
isSection: false
docId: decision.technical.flat-config
sourcePath: sources/docs/06-decisions/technical/flat-config.md
wordCount: 97
readingMinutes: 1
author: Pratik Mehta
license: CC BY-NC 4.0
description: ''
---

Sidekick to have Eslint 9+ flat config format: `eslint.config.js`.

**Why:** ESLint deprecated the legacy `.eslintrc.*` format in ESLint 9. The new flat config format:

- Is explicit — you import plugins and configs directly rather than referencing them by string name
- Is composable — configs are just arrays of objects
- Has better TypeScript support
- Is the only format that will be supported going forward

**Why `.js` and not `.json`:** ESLint 9's flat config requires a JavaScript file. There is no official JSON alternative. This is the one unavoidable exception to the project's [[prefer-json-config]] rule.
