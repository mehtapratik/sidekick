# Arkive design handover

This folder holds the design contract for arkive.blog.

- `SPEC.md`: the full specification (principles, content rules, routes, markup, behaviour, tests).
  Revision 2 is the polished pass.
- `AGENTS.md`: short operating rules for coding agents.
- `reference/`: runnable HTML pages built from real content. They are the markup contract and the
  visual target. View them with `npx serve design/reference` and open `/entry.html`. The folder is
  self-contained (its own copy of the CSS, JS, fonts and icons), so it renders exactly like the site.

Production assets live in the repo, not here: `public/arkive.css`, `public/arkive.js`,
`public/fonts/`, `public/icons/`, `src/shiki-themes.mjs`.

**Pointing an agent at it:**
- **Claude Code:** the repo's `CLAUDE.md` starts with `@design/AGENTS.md`.
- **Cursor:** add a project rule that says "Follow design/AGENTS.md and design/SPEC.md".
