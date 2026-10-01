---
publish: true
id: system-design.non-functional.css.cssmodules
created: 2026-09-19
kind: spec
version: 1.0.0
tags:
   - system-design
   - css
   - eslint
   - mantine
---

All styling uses CSS modules without exception. Pure Mantine style props that set visual styles inline are banned and enforced via the `no-mantine-style-props` ESLint rule. Behavioral CSS props of Mantine (like `withShadow`) are an acceptable compromise. Tailwind (or similar) utility styling is also not allowed.

> How can we make sure developers do not end-up using Tailwind or building similar type of utility classes?

[[no-utility-styles|more information]]
