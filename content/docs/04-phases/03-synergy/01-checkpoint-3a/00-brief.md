---
publish: true
id: plan.phase-3.checkpoint-3a
title: "Synergy Checkpoint 3a: Prove the Store, Plan 3b"
created: 2026-11-01
updated: 2026-11-05
kind: plan
version: 1.1.0
tags:
   - plan
   - phase-3
   - checkpoint
   - guidance
status: planned
---

> **Checkpoint after lesson 13.** Before this: [[04-phases/03-synergy/00-lessons/lesson-13-race-tests/00-brief|lesson 13]]. Next: [[04-phases/03-synergy/00-plan#Site lessons (the redesign)|site lesson S1]], then the first 3b lesson, planned here. The coach follows the plan's [[04-phases/03-synergy/00-plan#How we build|how we build]].

**What gets built:** no code. 3a is proven on `main`, and 3b is planned from what 3a actually built (Pratik, 2026-11-01: what 3b needs depends on how 3a gets built and the decisions made on the way).

**Learning payoff:** reading thirteen lessons as one system (the save path from a provider route to an outbox row); planning from what was built rather than from the design; deciding what to carry forward versus fix now.

**Coach reads first:** [[04-phases/03-synergy/00-plan|the Phase 3 plan]] (exit criteria, decisions, the 3b candidate list), the thirteen walkthroughs in each lesson's folder under `04-phases/03-synergy/00-lessons/`, the Synergy overview at its current version, and every change it went through in 3a.

## Steps

One document or decision at a time: the coach drafts or recommends, Pratik edits and agrees, then the next.

1. **Re-prove 3a on `main`.** Fill the plan's exit-criteria table with the test that proves each 3a row (file and test name), and run the integration suites with Turbo `--force`. Anything that doesn't hold becomes a fix before 3b.
2. **Reconcile the design.** List where 3a departed from the overview and the decisions, and check each departure is recorded (overview version, decision notes, post notes).
3. **Settle the deferred questions**, one at a time, each with a recommendation:
   - **Editor order.** Passages need Tiptap, planned for Phase 5, while Taxila's passages are in Phase 4. Move the shared editor ahead of Taxila's passages, or move the passages to Phase 5? The editor lesson also owns the 409 auto-merge and the "Page updated" banner.
   - **Retiring the sandbox providers.** Name the lessons that delete `packages/features/_sandbox/notes` and `/tasks` (for example when Taxila's notes and War Room's second real type land), and where their renderers live on as Synergy test fixtures.
4. **Plan 3b.** Turn the plan's 3b candidate list into Lessons-table rows and one brief per lesson in this folder, in the same format as 3a's briefs, ending with a Phase 3 close-out lesson like [[04-phases/02-gatekeeper/lessons/lesson-8-close-out/00-brief|Phase 2's lesson 8]].
5. **Brief site lesson S1** from the plan's site lessons table and the [[02-prd/03-features/01-synergy/spec#One Repo|spec's One Repo section]], since it runs next; later site lessons are briefed as each one starts.
6. **Update the project memory** with S1 and 3b's first lesson, so a new thread can begin without asking.

**Done when:** one arkive PR carries the filled exit-criteria table, the answers to the deferred questions, the 3b Lessons table and briefs, and Pratik has approved it. `npm run build` passes.
