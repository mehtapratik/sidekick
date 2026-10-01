---
publish: true
id: system-design.non-functional.css.matine
created: 2026-09-19
kind: spec
version: 1.0.0
tags:
   - system-design
   - css
   - mantine
---

To prevent hydration errors with Mantine’s theme injection, we must add `suppressHydrationWarning` to the `<html>` element. `defaultColorScheme="auto"` must be set on both `ColorSchemeScript` and `MantineProvider`.

> [!question]
> Can we exclude `ColorSchemaScript` to remove `suppressHydrationWarning` if we just default to the user’s preferred color scheme?
