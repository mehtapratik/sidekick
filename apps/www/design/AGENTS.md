# Instructions for coding agents (Claude Code, Cursor, others)

You are rebuilding **arkive.blog** from scratch as a static Astro site.

1. Read `SPEC.md` in full before writing code. It is the source of truth.
2. `reference/*.html` is the markup contract. Serve this folder (`npx serve .`) and open
   `reference/entry.html` to see the finished result. Your build must emit the same structure,
   class names, ids and `data-*` hooks.
3. Ship `arkive.css`, `arkive.js` and `shiki-themes.mjs` as given. Change them only to fix a
   defect, and say why in the commit message.
4. House rules, which reviewers will check:
   - No media queries, no CSS framework, no UI framework, no web fonts, no third-party requests.
   - Never add a style and then override it. Prefer the browser's default.
   - No client JS beyond `arkive.js`. Every feature works without it, except search and copy.
   - An entry is built only when its frontmatter has `publish: true`.
   - "As of" = `updated` ?? `created`, from frontmatter only. Never file or build time.
   - Never build anything under the private vault paths listed in SPEC §3.1.
5. Work in small, reviewable steps: content loading and URLs → entry template → Index → tag pages
   and RSS → Markdown plugins → acceptance tests (SPEC §10).
6. When the spec is silent or a rule seems to block you, stop and ask the owner. Don't invent a
   new pattern.
