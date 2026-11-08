---
publish: true
id: system-design.non-functional.css.design-tokens
title: Design Tokens
created: 2026-11-06
kind: spec
version: 1.0.0
tags:
   - system-design
   - css
   - design-system
status: accepted
---

**D254** `decision` #css #ui: `@sidekick/ui` names the design tokens and holds no values in its components; Sidekick's values ship as an opt-in theme file that each app imports, and a contract check fails when a theme leaves a token unset. derived-from [[D227]]

A design token is a named design decision (`--sk-surface`, `--sk-font-body`) that every stylesheet uses instead of a raw value. [[D227]] made `tokens.css` the one token source; this page says how (Q6 of the [[03-system-design/phase-3-additions-handover|Phase 3 additions handover]], Pratik, 2026-11-06).

- **The contract.** `ui` defines the token names, with a short prefix (`--sk-`) so they never clash with a host's variables, and its components read only those names. A component never contains a colour, size or font.
- **The theme.** Sidekick's values (the colours, the three typefaces, light and dark) live in `@sidekick/ui/themes/sidekick.css`, which no `ui` component imports. The App and the site import it as their default theme; a different product, or a third party, can write its own theme for the same names. This keeps `ui` independent of any one look, the same way it is independent of any one catalog ([[D249]]).
- **The check.** An unset variable fails silently (a fallback font, a transparent colour), so a small script compares every theme file against the contract's list and fails CI on a gap.
- **Dark mode** is a `data-theme` attribute on `<html>` (`auto`, `light`, `dark`), set before first paint by a tiny inline script, so there is no flash.
- **One source for both surfaces.** The App and the site share the theme file, so one edit changes both. Tokens can't live in an app, because the other app would have to import an app.

Built in lesson M1, which moves the design handover's `tokens.css` into `ui` as the contract and the theme; S1 reuses them for the site ([[04-phases/03-synergy/00-plan|Synergy plan]]).

## Decision History

- 2026-11-06 · accepted · Token names in `ui`, values in an opt-in theme file, a contract check
