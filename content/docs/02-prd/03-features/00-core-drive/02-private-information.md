---
publish: true
id: prd.features.core-drive.private-information
created: 2026-09-19
kind: prd
version: 1.0.0
tags:
   - system-design
   - prd
   - feature
   - core-drive
   - taxila
   - graph
applies_to:
   - "[[04-plans/phase-6-core-drive-ai-layer-alter-ego]]"
---

Sidekick relies heavily on [[information|personal information]] store to operate and advise. Here we will define different categories of private/internal information sources available to Sidekick to make optimal decisions:

| Category                  | Nature                                                             | Loading behavior                                                                          |
| ------------------------- | ------------------------------------------------------------------ | ----------------------------------------------------------------------------------------- |
| Identity                  | Who the user is, brief history                                     | Kernel (always loaded)                                                                    |
| Principles                | Universal truths (“No do-overs”) — apply almost everywhere         | Kernel (always loaded)                                                                    |
| Communication styles      | How the user prefers to communicate and write                      | Kernel (always loaded)                                                                    |
| Mental models             | Situational algorithms (“never shop hungry” → spending tasks only) | By applicability metadata                                                                 |
| Heuristics                | Mental shortcuts for low-consequence situations                    | By applicability metadata                                                                 |
| Tools & systems           | The user’s day-to-day toolchain                                    | By applicability metadata                                                                 |
| Preferences & constraints | Standing preferences and hard limits                               | By applicability metadata                                                                 |
| Domain knowledge          | Subject-matter knowledge                                           | **Lives in Taxila**, not Core Drive — Core Drive entries link to it via the graph service |
