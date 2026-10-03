---
publish: true
id: system-design.functional-design.core-drive.tiered-context-model
created: 2026-09-19
kind: spec
version: 1.0.0
tags:
   - system-design
   - core-drive
   - domain
   - situation
   - war-room
   - factory
   - ai
   - embedding
authority: canonical
retrieval_priority: high
related:
   - "[[03-system-design/functional-design/03-ai/context-assembler]]"
   - "[[03-system-design/functional-design/02-global-tagging-and-linking/00-global-tags-and-metadata]]"
---

Core drive may begin with few handful of principles, but it may grow into thousands of entries across [[02-private-information|many categories]]. Because Core Drive powers every AI-touched operation, it must be context-size efficient. Therefore, context for any AI-touched operation is assembled from three tiers:

- **Tier 0 — the kernel.** Identity, universal principles, communication style. Always injected, under a hard token budget (~1–2K tokens). The budget creates deliberate curation pressure: an entry _earns_ kernel status and is demoted when it stops being universal.
- **Tier 1 — conditionally loaded Core Drive.** Mental models, heuristics, tools, preferences — retrieved primarily by [[00-global-tags-and-metadata|applicability metadata]] (domain, situation, task type, e.g. `#domain:spending`, `#situation:planning`), with vector similarity as a secondary net. Applicability tags are the primary key precisely because “never shop hungry” must load when the _task_ is about spending, not when the prompt happens to resemble it.
- **Tier 2 — situational state.** Current projects, roles, prioritized backlog, goals, calendar, daily brief — owned by War Room and Factory. Assembled via ordinary structured repository queries (not embeddings).
