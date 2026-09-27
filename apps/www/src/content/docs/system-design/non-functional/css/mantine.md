---
title: Mantine
deck: ''
created: '2026-09-19'
updated: '2026-09-27'
kind: spec
status: draft
version: 1.0.0
tags:
  - system-design
  - css
  - mantine
appliesTo: []
isSection: false
docId: system-design.non-functional.css.matine
sourcePath: sources/docs/03-system-design/non-functional/css/mantine.md
wordCount: 46
readingMinutes: 1
author: Pratik Mehta
license: CC BY-NC 4.0
description: ''
---

To prevent hydration errors with Mantine’s theme injection, we must add `suppressHydrationWarning` to the `<html>` element. `defaultColorScheme="auto"` must be set on both `ColorSchemeScript` and `MantineProvider`.

> [!question]
> Can we exclude `ColorSchemaScript` to remove `suppressHydrationWarning` if we just default to the user’s preferred color scheme?
