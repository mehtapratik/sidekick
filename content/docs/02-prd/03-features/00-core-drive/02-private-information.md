---
id: prd.features.core-drive.private-information
title: Private Information
created: 2026-09-19
updated: 2026-10-13
version: 1.0.1
kind: prd
audience: everyone
tags:
  - system-design
  - prd
  - feature
  - core-drive
  - taxila
  - graph
applies_to:
  - "[[04-plans/phase-6-core-drive-ai-layer-alter-ego]]"
publish: true
---
Sidekick relies heavily on [[information|personal information]] store to operate and advise. Here we identify different categories of information:

| Category                  | Nature                                                                  | Loading behavior                                                                          |
| ------------------------- | ----------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| Identity                  | Who the user is, brief history                                          | Kernel (always loaded)                                                                    |
| Principles                | Universal truths (e.g. [[principle.balance]]) — apply almost everywhere | Kernel (always loaded)                                                                    |
| Communication styles      | How the user prefers to communicate and write                           | Kernel (always loaded)                                                                    |
| Mental models             | Situational algorithms (“never shop hungry” → spending tasks only)      | By applicability metadata                                                                 |
| Heuristics                | Mental shortcuts for low-consequence situations                         | By applicability metadata                                                                 |
| Tools & systems           | The user’s day-to-day toolchain                                         | By applicability metadata                                                                 |
| Preferences & constraints | Standing preferences and hard limits                                    | By applicability metadata                                                                 |
| Domain knowledge          | Subject-matter knowledge                                                | **Lives in Taxila**, not Core Drive — Core Drive entries link to it via the graph service |
