---
publish: true
id: system-design.non-functional.css.cssmodules
title: CSS Modules
created: 2026-09-19
updated: 2026-11-01
kind: spec
version: 1.1.0
tags:
   - system-design
   - css
   - eslint
   - mantine
---

**D47** `decision` #css: All styling uses CSS modules; Mantine style props and utility classes such as Tailwind are banned.

All styling uses CSS modules without exception. Pure Mantine style props that set visual styles inline are banned and enforced via the `no-mantine-style-props` ESLint rule. Behavioral CSS props of Mantine (like `withShadow`) are an acceptable compromise. Tailwind (or similar) utility styling is also not allowed.

> How can we make sure developers do not end-up using Tailwind or building similar type of utility classes?

**What we chose:** CSS modules for all styling. Utilitarian styling alternatives like Mantine CSS props ( like `h`, `px`, `fw`, `c`, `mt`, `size`, `color`, `justify`, `gap`) or Tailwind CSS aren’t allowed. No Mantine style props.

**Why:** They bypass the CSS cascade, cannot be overridden by CSS modules, and make it impossible to have a consistent visual language without reading every component's props. CSS modules make styles explicit and co-located with the component.

**What is allowed:** Mantine behavioral props — props that configure component behavior, not visual style. Examples: `withBorder`, `shadow`, `navbar={{ width, breakpoint }}`. These configure Mantine's layout engine, not inline styles.

**Enforcement:** `packages/eslint-plugin-sidekick` contains the `no-mantine-style-props` rule. It is registered in the root `eslint.config.js` and fails lint immediately on any violation.

## Decision History

- 2026-09-19 · accepted · No Utility Styles
