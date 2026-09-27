---
id: harness.model-selection.phase-learning-map
created: 2026-09-19
kind: guidance
version: 1.0.0
tags:
   - ai-coding
   - model-selection
   - learning
   - planning
   - private
related:
   - "[[04-plans/living-plan]]"
---

Use the [[04-plans/living-plan|living plan]] to identify the current phase, then select a session mode according to its learning value.

- **Phases 2–3:** teach mode; prioritize security and backend reasoning.
- **Phase 4:** teach the schema, migration, API, and repository loop; auto-pilot only routine command-palette UI.
- **Phase 5:** auto-pilot most editor/UI work unless the implementation itself has learning value.
- **Phase 6:** teach mode; never auto-pilot the RAG, Context Assembler, or privacy-sensitive work.
- **Phase 7:** teach a new pattern once, then use auto-pilot for repetition.
- **Phases 8–10:** teach the unfamiliar or high-risk portions; auto-pilot configuration and boilerplate only after understanding the pattern.
- **Phases 11–12 and post-MVP:** reassess the teaching value and risk before choosing a model.
