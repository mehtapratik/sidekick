---
publish: true
id: plan.phase-2.lesson-8-close-out
title: "Lesson 8: Phase 2 close-out"
created: 2026-10-24
updated: 2026-10-24
kind: plan
version: 1.0.0
tags:
   - plan
   - phase-2
   - task
   - guidance
status: planned
---

> **Lesson 8 of 8.** Before this: [[task-2-10|lesson 7]]. After this: [[04-plans/phase-3-graph-store-metadata-service|Phase 3]]. The coach follows [[contracts#How we build|how we build]].

**What gets built:** no code. Phase 2 gets written up and closed: a phase walkthrough, the plan marked complete, the guard spec brought up to what shipped, the agent guide's status, and the phase's learnings.

**Concepts:** reading seven lessons as one system (the request path from route to row), what "complete" means for a plan, keeping a vault's links and versions true after a rename, and choosing what to carry forward versus fix now.

**Coach reads first:** [[phase-2-core-infrastructure-api-guard-feature-system|the plan]] (exit criteria and decisions), [[contracts]] (2.8.0), the seven lesson walkthroughs in `05-builds/phase-2-core-infrastructure-api-guard-feature-system/`, [[04-plans/pre-2-foundation-hardening-complete|Pre-2]] (how a completed plan looks), [[with-api-guard]], and [[05-builds/pre-2-walkthrough]] (the post-note pattern).

## Handover from lesson 7

What changed in lesson 7 ([[05-builds/phase-2-core-infrastructure-api-guard-feature-system/lesson-7-ops|walkthrough]]) that this lesson builds on:

- **Task 2.10 shipped as an `ops` package, not a registry script** ([sidekick#23](https://github.com/mehtapratik/sidekick/pull/23), env loading fixed in [sidekick#24](https://github.com/mehtapratik/sidekick/pull/24)). The phase walkthrough describes `packages/ops`, `withPrivilegedDb` and `pnpm ops:entitlements:grant`. The dependency direction now has a side branch, `ops → registry, foundation`, imported by nothing ([[contracts#Ops|contracts]]); the agent guide already says so.
- **The exit criteria hold, and each has a proof to cite:** `/api/health` returns 401 and 200 (lesson 6, by hand), `FEATURE_DISABLED` 403 is pinned by `packages/core/tests/integration/guard.test.ts` (lesson 4), and `entitlements grant` enables a feature per user (lesson 7, against dev). Disabling is a `DELETE` with the privileged role; there's no `revoke` command.
- **`ALL_FEATURES` is still empty.** Nothing is granted until Phase 4 registers Taxila. The write-up says so rather than implying a working grant.
- **Open items to carry, not fix:** a `--target` check for `ops` scripts once a second environment exists; a `pnpm ops <noun> <verb>` dispatcher with the second `ops` command; a `revoke` command; Phase 9's CLI owning CLI design; a public liveness probe, which would be a recorded exception to `require-api-guard` (lesson 6); `getClaims()` as the latency lever, with its revocation trade-off (lesson 6).
- **Pratik merges fast.** Check `gh pr view <n> --json state` before pushing more to a PR's branch: lesson 7's last commit landed on a merged branch and needed its own PR.
- **Don't run arkive's Prettier on notes with code blocks.** Its config (three spaces, double quotes) rewrites Sidekick's code samples, which follow Sidekick's Prettier (two spaces, single quotes). Lesson 7 had to restore a walkthrough and a contracts sample by hand.
- **Teaching style** is unchanged from lessons 4–7 ([[contracts#How we build|how we build]]): state exactly what to write, then the reasoning; no quizzes. Pratik can hand any step to the coach.

## Steps

There's no code, so "piece by piece" here means one document at a time: the coach drafts or outlines it, Pratik edits and agrees, and only then does the next one start. **Good to write yourself:** the phase walkthrough's opening (what Phase 2 built and why it matters) and the learnings note's themes; they're the parts only Pratik can say. Pratik decides, and can switch any step either way.

1. **Check the exit criteria against `main`.** Re-run the proofs from the handover on a fresh `main`: `pnpm test:integration` (the 403), `pnpm dev` plus `curl -i localhost:3000/api/health` (the 401), a signed-in browser (the 200), and `pnpm ops:entitlements:grant --email <you> --all` (the grant path). Anything that fails is fixed before the phase is called complete.
2. **Write `05-builds/phase-2-walkthrough.md`.** It ties the seven lesson walkthroughs into one path: what each lesson added, in order, and how a request travels through the result (route → `withApiGuard` → `resolveApiCaller` → scope → `withRLS` → entitlements → handler → logs), plus the `ops` side path that writes entitlements. It links each lesson walkthrough for the steps instead of repeating their code, and lists where post notes changed earlier walkthroughs.
3. **Mark the plan complete the way Pre-2 was closed.** Rename `04-plans/phase-2-core-infrastructure-api-guard-feature-system.md` to `…-complete.md`, set `status: completed`, add a "Completed:" line linking the phase walkthrough, and add a Status ✅ column to the task table (2.10 says it shipped as `ops`). Every wikilink to the old name must move with it: find them with `grep -rln "phase-2-core-infrastructure-api-guard-feature-system[]|#]" sources/docs`. The folder `phase-2-core-infrastructure-api-guard-feature-system/` (contracts, tasks) keeps its name, so links into it don't change. Update [[living-plan]]'s Phase 2 entry, and set `status: complete` on contracts and this brief.
4. **Bring [[with-api-guard]] up to the shipped behaviour.** It's still the planning sketch (JavaScript, scope check inside the transaction). Replace it with the TypeScript signature, the order of checks, the error shape and the log events from [[contracts#Guard|contracts]], or make it a short spec that links contracts as the source of truth. Bump `version` (a contract change).
5. **Update the agent guide's "Where things stand":** Phase 2 complete with its walkthrough; next is Phase 3 once its gate is checked. Keep the toolchain line true.
6. **Write the phase's learnings in `09-notes/`** (`publish: false`): the themes across the seven lesson notes rather than a repeat of them. Candidates: proving a guard by breaking it, "top level declares", verifying like CI (no cache, no env), where each guard layer sees and misses, and design decisions that came from Pratik's questions.
7. **Decide where the open items live.** Each one from the handover goes to [[backlogged-unplanned]], to the phase that owns it (Phase 9 for the CLI), or is dropped with a reason.
8. **Verify and ship:** `npm run build` in arkive (the privacy gate fails on a broken published link), check every edited note's `updated:` and `version`, then open the arkive PR.

## Check understanding

Covered while writing, not asked as a quiz:

- What would break first if `withApiGuard` were removed from one route, and which layer would catch it?
- Which Phase 2 decision would be hardest to reverse later, and why?

**Done when:** the exit criteria are re-proven on `main`, the arkive PR with the phase walkthrough, the completed plan, the updated guard spec, the agent guide and the learnings is merged, and `npm run build` passes.

**Out of scope:** any Sidekick code change (a failing proof in step 1 becomes its own PR first), and starting Phase 3.
