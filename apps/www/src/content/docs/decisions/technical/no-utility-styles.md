---
title: No utility styles
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
  - eslint
  - mantine
  - css
appliesTo: []
isSection: false
docId: decision.technical.no-utility-styles
sourcePath: sources/docs/06-decisions/technical/no-utility-styles.md
wordCount: 122
readingMinutes: 1
author: Pratik Mehta
license: CC BY-NC 4.0
description: ''
---

**What we chose:** CSS modules for all styling. Utilitarian styling alternatives like Mantine CSS props ( like `h`, `px`, `fw`, `c`, `mt`, `size`, `color`, `justify`, `gap`) or Tailwind CSS aren’t allowed. No Mantine style props.

**Why:** They bypass the CSS cascade, cannot be overridden by CSS modules, and make it impossible to have a consistent visual language without reading every component's props. CSS modules make styles explicit and co-located with the component.

**What is allowed:** Mantine behavioral props — props that configure component behavior, not visual style. Examples: `withBorder`, `shadow`, `navbar={{ width, breakpoint }}`. These configure Mantine's layout engine, not inline styles.

**Enforcement:** `packages/eslint-plugin-sidekick` contains the `no-mantine-style-props` rule. It is registered in the root `eslint.config.js` and fails lint immediately on any violation.
