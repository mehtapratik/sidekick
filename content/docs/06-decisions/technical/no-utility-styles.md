---
publish: true
id: decision.technical.no-utility-styles
created: 2026-09-19
kind: decision
version: 1.0.0
tags:
   - decision
   - technical
   - architecture-decision
   - eslint
   - mantine
   - css
status: accepted
---

**What we chose:** CSS modules for all styling. Utilitarian styling alternatives like Mantine CSS props ( like `h`, `px`, `fw`, `c`, `mt`, `size`, `color`, `justify`, `gap`) or Tailwind CSS aren’t allowed. No Mantine style props.

**Why:** They bypass the CSS cascade, cannot be overridden by CSS modules, and make it impossible to have a consistent visual language without reading every component's props. CSS modules make styles explicit and co-located with the component.

**What is allowed:** Mantine behavioral props — props that configure component behavior, not visual style. Examples: `withBorder`, `shadow`, `navbar={{ width, breakpoint }}`. These configure Mantine's layout engine, not inline styles.

**Enforcement:** `packages/eslint-plugin-sidekick` contains the `no-mantine-style-props` rule. It is registered in the root `eslint.config.js` and fails lint immediately on any violation.
