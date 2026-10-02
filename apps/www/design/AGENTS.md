# Instructions for coding agents (Claude Code, Cursor, others)

You are maintaining **arkive.blog**, a static Astro site.

1. Read `SPEC.md` in full before writing code. It is the source of truth.
2. `reference/*.html` is the markup contract. Serve it (`npx serve design/reference`) and open
   `/entry.html` to see the finished result. Your build must emit the same structure, class names,
   ids, `data-*` hooks and `aria-*` attributes.
3. Ship `public/arkive.css`, `public/arkive.js`, `src/shiki-themes.mjs`, `public/fonts/` and
   `public/icons/` as given. Change them only to fix a defect, and say why in the commit message.
4. House rules, which reviewers will check:
   - No CSS framework, no UI framework, no third-party requests. Fonts and icons are self-hosted.
   - Native behaviour first: popover, `details`, radios and links do the work. Styling decorates them,
     but never changes semantics or accessibility.
   - No media queries for layout. They are allowed only for `prefers-color-scheme`,
     `prefers-reduced-motion`, `hover`, and hiding shortcut hints below 30em.
   - No client JS beyond `arkive.js`. Everything works without it except search, the filter, copy and
     the keyboard shortcuts.
   - Peacock (`--accent`) colours links inside `.prose` only. Navigation stays in the text colour.
   - No hero images or illustrations in the chrome.
   - An entry is built only when its frontmatter has `publish: true`.
   - "As of" = `updated` ?? `created`, from frontmatter only. Never file or build time.
   - Never build anything under the private vault paths listed in SPEC §3.1.
5. Work in small, reviewable steps, and run the acceptance checks (SPEC §10) before you finish.
6. When the spec is silent or a rule seems to block you, stop and ask the owner. Don't invent a
   new pattern.
