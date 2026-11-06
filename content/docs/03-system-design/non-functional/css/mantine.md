---
publish: true
id: system-design.non-functional.css.matine
title: Mantine
created: 2026-09-19
updated: 2026-11-06
kind: spec
version: 1.0.0
status: deprecated
tags:
   - system-design
   - css
   - mantine
---

> **Retired 2026-11-06.** Mantine leaves the App in lesson M1 ([[03-system-design/non-functional/css/native-ui|Native UI]], [[D255]]). This page stays as the record of how the App used it until then.

To prevent hydration errors with Mantine’s theme injection, we must add `suppressHydrationWarning` to the `<html>` element. `defaultColorScheme="auto"` must be set on both `ColorSchemeScript` and `MantineProvider`.

> [!question]
> Can we exclude `ColorSchemaScript` to remove `suppressHydrationWarning` if we just default to the user’s preferred color scheme?
