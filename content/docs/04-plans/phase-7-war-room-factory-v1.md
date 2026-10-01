---
publish: true
id: plan.phase-7-war-room-factory-v1
created: 2026-09-19
kind: plan
version: 1.0.0
tags:
   - plan
   - living-plan
   - phase-7
   - war-room
   - factory
   - core-drive
   - rls
   - api
   - offline
status: planned
depends_on:
   - "[[04-plans/phase-6-core-drive-ai-layer-alter-ego]]"
---

> **Milestone:** Planning and push-button execution. Tasks exist; one click on a configured button (e.g., "School+Car") creates tomorrow's pickup task without typing a word.
> **Learning payoff:** Workflow/action modeling, form-defaults configuration, composing features through the graph service.
> **Prerequisites:** War Room and Factory PRDs in `docs/02-prd/`.
> **Context note:** War Room and Factory own **Tier 2 situational state** (current projects, priorities, goals, calendar, daily briefs — architecture §5.2.1). Once their entities exist, wire them into the Context Assembler as structured-query sources (task 7A.5). Boundary rule: they store state, never values — values live in Core Drive.

### 7A — War Room

| #    | Task                                                                                                                         | Complexity | Learning |
| ---- | ---------------------------------------------------------------------------------------------------------------------------- | ---------- | -------- |
| 7A.1 | Create `packages/feature-war-room`; define `tasks` (and optionally `plans`) schema — syncable                                | 🟡         | 📦 🗄️    |
| 7A.2 | Migration, RLS, trigger bindings, registry entry + entity types                                                              | 🟡         | 🔐 🗄️    |
| 7A.3 | Repository + guarded API routes (CRUD, soft-delete)                                                                          | 🟡         | 🧩 🔐    |
| 7A.4 | Palette-reachable UI: today view, task create/complete flows                                                                 | 🟡         | 🧩 🎨    |
| 7A.5 | Wire War Room/Factory state into the Context Assembler as Tier 2 sources (structured queries: open tasks, priorities, goals) | 🔴         | 🤖 🧩    |

### 7B — Factory v1 (MVP scope only: push-button workflows + input defaults)

| #    | Task                                                                                                                           | Complexity | Learning |
| ---- | ------------------------------------------------------------------------------------------------------------------------------ | ---------- | -------- |
| 7B.1 | Create `packages/feature-factory`; define `workflows` schema — name, icon, action definition (typed payload), enabled          | 🔴         | 📦 🗄️    |
| 7B.2 | Migration, RLS, registry entry                                                                                                 | 🟡         | 🔐 🗄️    |
| 7B.3 | Implement workflow execution through public APIs only (API-first guarantee) — e.g., "create War Room task with preset payload" | 🔴         | 🧩 🔐    |
| 7B.4 | UI: configure a push-button workflow; surface buttons in the command palette / toolbar                                         | 🟡         | 🧩 🎨    |
| 7B.5 | Implement configurable input defaults — forms open pre-filled with previously typed inputs                                     | 🟡         | 🧩       |

**Phase 7 Exit Criteria:** The "School+Car" flow works end-to-end: one configured button creates a task for tomorrow. Input defaults reduce repeat typing. All execution flows through guarded public APIs. (Inbox management, IoT, webhooks, and durable workflow engines remain post-MVP — see Post-MVP section.)

---
