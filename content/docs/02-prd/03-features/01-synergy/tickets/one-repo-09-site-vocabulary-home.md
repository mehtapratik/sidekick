---
publish: true
id: prd.synergy.one-repo.ticket-09
title: A Home for the Site Vocabulary
created: 2026-11-03
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

The site's terms (Sidekick, App, Public site, Entry, Writing, Doc, About) live in `CONTEXT.md`, the file the `domain-modeling` skill reads. The project's settled terms live in `07-glossary/`. In the merged repo, does `CONTEXT.md` stay at the root as the glossary agents read, move to `apps/www/`, or fold into `07-glossary/`?

## Resolution

Grilled with Pratik on 2026-11-05. **The seven terms fold into `07-glossary/`, one page per term, and `CONTEXT.md` is deleted.** The merged repo has one glossary.

### Why one glossary

- **The vault already holds settled terms.** `07-glossary/` had 14 terms on 2026-11-05 (6 published), one page each. A second glossary in `CONTEXT.md` would drift from it.
- **The terms are not site-only.** "App" and "Sidekick" are project terms; only Entry, Writing, Doc, About and Public site are about the site. So a separate site context (`apps/www/CONTEXT.md` with a root `CONTEXT-MAP.md`) would split terms that belong together.
- **Pages do more than lines.** A glossary page can be linked (`[[app]]`), published, and later carry a `concept` datum. A line in `CONTEXT.md` can do none of that.

### The pages

One page per term in `content/docs/07-glossary/`: `sidekick.md`, `app.md`, `public-site.md`, `entry.md`, `writing.md`, `doc.md`, `about.md`. Each follows the existing glossary pages (`kind: glossary`, `id: glossary.<slug>`, tags `glossary` and `site`), carries the definition from `CONTEXT.md` as its body, and ends with its _Avoid_ line, so nothing from the skill's format is lost. Whether each page is published follows the vault's opt-in rule like any other page.

### The rule for agents

The `domain-modeling` skill reads a root `CONTEXT.md` and creates one when it is missing, so without a rule an agent would start a second glossary. The agent guide (`content/docs/08-ai-coding-harness/agent-guide.md`, which the root `AGENTS.md` points at) gains one line:

> Project vocabulary lives in `content/docs/07-glossary/`, one page per term. When a skill asks for `CONTEXT.md`, write or update the glossary page instead; never create a `CONTEXT.md`.

### When

In Lesson 0, PR 1, step 7 (agent notes), which already edits `AGENTS.md`: Pratik types the seven pages, deletes `apps/www/CONTEXT.md` and adds the agent-guide line ([Lesson 0: the Import](one-repo-04-lesson-0-import.md)).
