---
publish: true
id: system-design.non-functional.css.native-ui
title: Native UI
created: 2026-11-06
kind: spec
version: 1.0.0
tags:
   - system-design
   - css
   - design-system
   - mantine
status: accepted
---

**D255** `decision` #ui #css: `@sidekick/ui` builds its primitives on native HTML with no UI library, and Mantine leaves the App in lesson M1; the interface is Sidekick's own, the smallest one today's screens need. derived-from [[D254]] derived-from [[D2]]

The MVP's UI is primitive, and the platform now does what UI libraries used to (Pratik, 2026-11-06): the `dialog` element for modals, the `popover` attribute for menus, tooltips and the Sneak Peek Link's preview, `details` for disclosure, the native `select`, date and other input types, and native form validation beside zod. The browser handles focus, Escape and top-layer stacking. A custom implementation of something the platform supports is avoided.

- **`ui` has zero dependencies** beyond React, so it renders in the App, the site and on third-party pages. It adds only tokens, CSS modules and Sidekick's props.
- **Our interface, not Mantine's.** No compatibility with Mantine's props. `Button` has two variants, primary and secondary. What isn't reused (Mantine's `Text`, `Title`, `Paper`, `Stack`, `AppShell`) becomes plain markup and a CSS module, not a component. `ui` starts with `Button`, `TextInput`, `PasswordInput` and a link, and grows only when a screen needs more.
- **Who writes it.** `ui` components have little learning payoff for Pratik, so the coach writes them and Pratik reviews them; Pratik rewires the screens.
- **Lesson M1** (after Checkpoint 3a, before I1, about two days): login, signup, the app shell and the dashboard move off Mantine. `useForm` becomes a native form with zod and Sidekick's error keys ([[D252]]), the template for every later form; notifications become inline `role="alert"` messages; `MantineProvider` and `ColorSchemeScript` give way to the theme file and the pre-paint script ([[D254]]). Then `@mantine/*`, `postcss-preset-mantine` and `sidekick/no-mantine-style-props` are deleted.

**Rejected:** keeping Mantine for good (two design systems, two dark-mode switches, and `ui` could never use it, since the site and third parties can't carry its provider); a headless library such as React Aria Components or Base UI (it solves hard widgets the MVP doesn't need, and native elements cover the rest); building complex widgets from scratch. If a need comes up that native HTML can't meet and building it would cost real time, a library is chosen for that one widget, and the reason is written here.

## Decision History

- 2026-11-06 · accepted · Native HTML primitives in `ui`; Mantine removed in lesson M1
