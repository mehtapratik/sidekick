# Arkive redesign — handover

This folder is the handover for rebuilding arkive.blog from scratch.

**To start a coding agent:**

1. Put this folder in the new repository, for example as `design/`.
2. Point the agent at it:
   - **Claude Code**: add a line to the repo's `CLAUDE.md`: `@design/AGENTS.md`
   - **Cursor**: Cursor reads `AGENTS.md` at the repo root. Copy `design/AGENTS.md` there, or add
     a project rule that says "Follow design/AGENTS.md and design/SPEC.md".
   - **Any other agent**: tell it to read `design/AGENTS.md`, then `design/SPEC.md`.
3. First prompt: *"Read design/AGENTS.md and design/SPEC.md, then propose a step plan before writing code."*

**What's inside:**

- `SPEC.md`: the full specification (principles, content rules, routes, markup, behaviour, tests).
- `AGENTS.md`: short operating rules for the agent.
- `arkive.css`, `arkive.js`, `shiki-themes.mjs`: finished production assets.
- `reference/`: runnable HTML pages built from real content. They are the markup contract and the
  visual target. View them with `npx serve design` and open `/reference/entry.html`.

The `reference/` pages were checked in headless Chromium at 1280px and 390px, in light and dark:
no horizontal scrolling; Index open and close; tag filter and search; the filter persisting across
reloads; previous/next following the filter; Clear filter; the By date / By folder switch (also with
JS off); the tree following the filter; the copy button. No console errors.
