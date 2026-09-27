---
title: CSS modules
deck: ''
created: '2026-09-19'
updated: '2026-09-27'
kind: spec
status: draft
version: 1.0.0
tags:
  - system-design
  - css
  - eslint
  - mantine
appliesTo: []
isSection: false
docId: system-design.non-functional.css.cssmodules
sourcePath: sources/docs/03-system-design/non-functional/css/css—modules.md
wordCount: 66
readingMinutes: 1
author: Pratik Mehta
license: CC BY-NC 4.0
description: ''
---

All styling uses CSS modules without exception. Pure Mantine style props that set visual styles inline are banned and enforced via the `no-mantine-style-props` ESLint rule. Behavioral CSS props of Mantine (like `withShadow`) are an acceptable compromise. Tailwind (or similar) utility styling is also not allowed.

> How can we make sure developers do not end-up using Tailwind or building similar type of utility classes?

[[no-utility-styles|more information]]
