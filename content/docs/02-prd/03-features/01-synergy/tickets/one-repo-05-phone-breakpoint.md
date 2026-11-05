---
publish: true
id: prd.synergy.one-repo.ticket-05
title: The Phone Breakpoint
created: 2026-11-03
kind: plan
type: grilling
blocked_by: []
status: closed
assignee: claude
updated: 2026-11-05
tags:
   - prd
   - synergy
   - one-repo
   - wayfinder
---

## Question

The new header hides the nav and theme control behind a menu on phones, and the docs tree becomes a Contents slide-over. That needs one width query, which breaks the house rule "no media queries for layout". Should the rule allow a single `@media (max-width: 40rem)`, a container query on the header, or should the design change so no query is needed?

## Resolution

Grilled with Pratik on 2026-11-05, after measuring the handover's reference pages in Chromium with the site's fonts. The house rule allows **one width breakpoint**, `@media (width < 58rem)`, and it may only swap chrome. The handover's 40rem is replaced.

### What the measurements showed

- **The header already wraps without a query.** Its row is `flex-wrap: wrap`, so it sits on one line down to about 790px and drops the Search and theme group to a second line below that. It only fails on phones: three rows and 155px tall at 375px.
- **The docs sidebar stops fitting at 920px.** The docs row wraps when the aside's 240px basis, the 56px gap, main's 560px basis and the two 32px gutters no longer fit: 920px, or 57.5rem. At the handover's 40rem (640px), every window from 640 to 920px, an iPad in portrait among them, would get the whole tree stacked above the article.

So the breakpoint sits where the sidebar stops fitting, rounded up to 58rem (928px at the default 16px) so no width leaves the tree stacked above the article, and the header switches at the same width so there is one number.

### The rule

The house rule's media-query line becomes:

> No media queries for layout, with one exception: a single width breakpoint, `@media (width < 58rem)`, which only swaps chrome. Media queries are otherwise allowed only for `prefers-color-scheme`, `prefers-reduced-motion` and `hover`. Everything else adapts intrinsically (wrapping, `auto-fit` grids, `clamp()`), and a component that must adapt to its own column uses a container query.

Below the breakpoint, and nowhere else:

- the header shows the wordmark, Search and Menu; the nav links and the theme control move into the Menu;
- the docs tree gives way to the Contents bar (Contents button and breadcrumbs), and the button opens the tree as the left slide-over;
- the `/` hint on the Search button is hidden. This replaces today's separate "hide shortcut hints below 30em" exception, so the rule still has one width query.

The rule changes in the site's `AGENTS.md` (today the repo's `CLAUDE.md`) in the redesign lesson that builds the chrome, not before: until then the current site keeps the current rule.

### Why not the alternatives

- **A container query on the header:** a container cannot query its own size, so the header's children would query a wrapper, and the tree is outside the header, so the docs row would need a second container holding the same number. Each adds size containment. Both boxes span the viewport anyway, so they would ask the viewport's question with more machinery.
- **A design that needs no query:** the header could cope (the nav wraps, the theme control moves to the footer), but the tree has no good place. Above the article it pushes reading down by a whole tree, below it is out of reach, and a Contents button on desktop gives up the sidebar.
- **Container queries stay** the tool for components that sit in columns of different widths, as the current CSS already does for numbered lists, wide tables and the pager.

### Notes for the build

- The breakpoint is written in rem on purpose: in a media query, rem follows the reader's browser text size, so a reader with large text gets the phone chrome sooner.
- CSS cannot put a custom property in a media condition, so the value is written once: one `@media (width < 58rem)` block holds every chrome swap.
- Tablets in portrait get the phone header and the Contents bar. That is the trade-off of one number, and the 44px targets suit touch screens.
- If the docs row's flex bases or gap change, the breakpoint moves with them: it is their sum plus the gutters, rounded up to a whole rem.

### Simplifications for the redesign

Pratik will simplify the chrome when it is built. These change the design, not this rule:

- **Theme control:** one button that cycles System, Light and Dark, in place of the three-button group.
- **Contents below the breakpoint:** the tree takes over the whole viewport, in place of the handover's 332px slide-over with a scrim. The reader closes it to get back to the article.
