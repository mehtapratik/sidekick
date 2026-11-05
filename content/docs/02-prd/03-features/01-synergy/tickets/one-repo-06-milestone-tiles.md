---
publish: true
id: prd.synergy.one-repo.ticket-06
title: Milestone Tiles From the Phases Folder
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

The home page's "Where things stand" tiles are built, in the handover, from `04-plans/phase-*.md` and `*-complete.md` files. That folder became `04-phases/NN-nickname/00-plan.md` in arkive #29, and phases now have nicknames (Groundwork, Front Door, Gatekeeper, Synergy...). Which files and frontmatter fields define a milestone, its status (done, next, planned, deferred), its order, its short label and its title? Do Front Door's sub-plans (Row-Level Security, Pre-2 hardening) get their own tiles?

## Resolution

Grilled with Pratik on 2026-11-05. **One tile per phase**, read from the phase plans' frontmatter. The handover's file-name rules (`phase-*.md`, `pre-*.md`, `-complete` siblings) are dropped, because those files no longer exist.

### The rule

- **A milestone** is `04-phases/NN-name/00-plan.md`, one level down only. Sub-plans such as `01-front-door/01-row-level-security/00-plan.md` are not milestones.
- **Order and short label:** the folder's `NN` prefix, shown as a number (`0` to `12`). This is the order the docs tree already uses.
- **Title:** the plan's frontmatter `title`, which is the phase nickname (Groundwork, Front Door, Synergy, ...). No title is derived from a file name, so the handover's open decision 5 is closed.
- **Hidden label:** "Phase {n}, {title}: {status}", for example "Phase 3, Synergy: Up next".
- **Status**, from the plan's frontmatter `status`:
   - _done_: `completed`;
   - _deferred_: `deferred`;
   - _up next_: the first phase, in order, that is neither done nor deferred;
   - _planned_: every other phase.
- **Sentence:** "{done} of {total} milestones complete. Up next: {title}", linking to that phase's plan. Deferred phases count in the total.
- **"All phases" list:** every phase with its number, title and status, and its sub-plans indented under it, so nothing is hidden by the coarser tiles.

From today's files that gives 13 tiles: Groundwork, Front Door and Gatekeeper done, Synergy up next, Taxila to Watchtower planned, Open House and Storefront deferred. The sentence reads "3 of 13 milestones complete. Up next: Synergy".

### Why one tile per phase

- **The rename settled it.** Row-Level Security and Hardening became part of Front Door in the phase renaming (2026-11-01). Tiles labelled `1.1` and `P2` would bring back the numbering that renaming retired.
- **The row stays stable.** With a tile per sub-plan, every future sub-phase (Synergy's 3a and 3b, for a start) would add a tile, so the row would grow in uneven steps and the count would shift with planning detail, not progress.
- **The cost:** the count is coarser ("3 of 13" instead of the handover's "5 of 15"), and Synergy shows as one tile through all of 3a and 3b.

### Notes for the build

- A phase that has started but not finished keeps `status: planned` and shows as up next. There is no separate "in progress" state.
- A phase folder without a `00-plan.md`, or a plan without `publish: true`, makes no tile, so the tiles follow the same publish gate as every other page.
