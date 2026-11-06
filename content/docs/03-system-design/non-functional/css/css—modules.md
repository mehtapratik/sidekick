---
publish: true
id: system-design.non-functional.css.cssmodules
title: CSS Modules
created: 2026-09-19
updated: 2026-11-06
kind: spec
version: 2.0.0
tags:
   - system-design
   - css
   - eslint
   - stylelint
---

**D47** `decision` #css: Every component in the App and in packages is styled with a CSS module; global CSS is allowed only in a named list of files, and inline styles and utility classes such as Tailwind are banned.

A CSS module (`*.module.css`) makes its class names unique per component, so `.title` in one component never clashes with `.title` in another, and a component's styles sit next to it. Utility styling (Tailwind, Mantine style props such as `h`, `px`, `fw`, `mt`) bypasses the cascade, can't be overridden by a module and spreads the visual language across every component's props.

## Global CSS: the named list

Some CSS is global by nature, and the list is short and explicit:

- an app's reset and base file (`apps/app/src/app/globals.css`);
- `ui`'s token contract and theme files ([[03-system-design/non-functional/css/design-tokens|Design tokens]]).

Anything else goes in a module. The public site, `apps/www`, is outside this rule: it is temporary and uses global stylesheets only, with no CSS modules at all ([[D256]], Pratik, 2026-11-06). Its successor follows D47.

## Enforcement

- **Stylelint**, one config with two blocks: `*.module.css` keeps camelCase classes (`styles.myClass` is a plain, type-checked property access; `styles['my-class']` is not); the named global files use kebab-case. Both blocks run `stylelint-use-logical` ([[D246]]).
- **`lint:styles` globs every `.css` file** in `apps/app` and `packages/`, so a new global file outside the list matches no block and fails, the same "explicit list, fail on the unknown" pattern as the boundaries rule.
- **ESLint:** `sidekick/no-inline-styles` bans the `style` prop. `sidekick/no-mantine-style-props` goes with Mantine in lesson M1 ([[D255]]).

## Decision History

- 2026-09-19 · accepted · No Utility Styles
- 2026-11-06 · accepted · CSS modules for every component in the App and packages, a named list of global files, `apps/www` exempt; Stylelint covers every CSS file
