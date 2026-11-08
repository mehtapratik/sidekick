---
publish: true
id: prd.synergy.one-repo.ticket-12
title: Components in Content
created: 2026-11-05
kind: plan
type: grilling
blocked_by: []
status: deprecated
assignee: claude
updated: 2026-11-05
tags:
   - prd
   - synergy
   - one-repo
   - wayfinder
---

> **Retired 2026-11-05.** The outcome lives in the [[02-prd/03-features/01-synergy/09.prd.features.synergy.one-repo|One Repo PRD]] and the [[02-prd/03-features/01-synergy/spec#One Repo|spec's One Repo section]]. This page stays as the record of how it was decided.

## Question

Raised by Pratik on 2026-11-05: an Entry sometimes needs UI that Markdown cannot express. Can content render React components, through MDX or a similar means, and can those components come from the design system in `packages/foundation/ui`? Is it static HTML or interactive islands, what syntax does a page use, and how are the components styled when the App uses Mantine and the site uses `tokens.css`?

## Resolution

Grilled with Pratik on 2026-11-05. **Content renders static React components from a fenced block in plain `.md`.** There is no MDX for now. Components are plain React styled with CSS modules and `tokens.css`, with no Mantine.

### Static, no MDX yet

- **Static only:** a component renders to HTML at build time and ships no JS (a timeline, a comparison table, a status card). Pratik is fine with static components for now.
- **No MDX now, because adding it later costs the same:** `@astrojs/mdx` and `@astrojs/react` in the Astro config, plus widening the places that assume `.md`: the content collection glob and about five spots in `vault.mjs` (scan, slugs, wikilink resolution). The privacy and datum gates read content through `vault.mjs` too. Adding it now would leave a dependency and a test page with no use.
- **The guard that keeps it cheap:** new code that scans content goes through `vault.mjs`'s helpers, so the file extension stays in one place.
- **MDX's other costs, if it ever comes:** Obsidian does not preview `.mdx`, and MDX reads `{` and `<` in prose as code (29 vault docs had `{word` text on 2026-11-05), so it would be opt-in per file, only where an interactive island is needed.

### The syntax: a fenced block

A component is a fenced code block whose info string is `sidekick:<name>`, with YAML props as its body:

````md
```sidekick:timeline
items:
   - date: 2026-11-05
     label: One-repo tickets settled
```
````

A remark plugin in `apps/www` finds these blocks, loads the named component, renders it with React's `renderToStaticMarkup` and puts the HTML in place of the block. Obsidian shows the block as readable code, the page stays `.md`, and wikilinks and the other remark plugins keep working. An unknown name or props that fail the component's schema fail the build, as a broken datum relation does.

### How components are built

- **Plain React, no Mantine.** Static blocks need no state or hooks, and Mantine on the site would bring its provider, its whole stylesheet and a second look.
- **Styled with CSS modules and CSS variables** from `tokens.css`, so light and dark themes work without code.
- **`tokens.css` is the one token source and lives in `@sidekick/ui`.** The site imports it, and the App's Mantine theme can read the same variables when the App is redesigned.

### Where components live

- **`apps/www` by default.** A component that knows site concepts (Entry, Writing, Doc) stays with the site.
- **`@sidekick/ui` (`packages/foundation/ui`) when it is a design-system candidate:** domain-free and useful beyond the site, per [[03-system-design/non-functional/monorepo/dependency-flow|Dependency flow]]. It then takes `react` as a peer dependency, and the site imports it like any app imports foundation.

### When

Not in Lesson 0. The plugin, `tokens.css` moving into `@sidekick/ui`, and the first component come together in the redesign lessons, when the first Entry needs one.
