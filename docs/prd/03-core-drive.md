---
title: PRD 03 — Core Drive
version: 0.1.0
audience: General
status: draft
tags: [prd, sidekick, core-drive]
deck: Draft PRD for Core Drive. Placeholder until the full PRD is written before Phase 6.
created: 2026-08-24
updated: 2026-08-24
---

> [!note]
> **Draft.** The full PRD will be written before Phase 6 begins and must detail the category taxonomy and tiered context model (architecture §5.2). For now this file holds reminders worth capturing early.

## Reminder: executable heuristics cross module boundaries

While Core Drive owns heuristics as *knowledge* ("lights come on → blinds go down", "check doors before bed"), some heuristics are **executable** — they blur into Factory's territory of automation and touch other modules' decision-making. The full PRD must decide how a heuristic goes from a stored entry to a triggered action: whether Core Drive heuristics can directly drive Factory workflows, or whether Factory merely *consults* them via the Context Assembler while owning all execution. This boundary shapes both schemas, so settle it before implementing either module's v1.
