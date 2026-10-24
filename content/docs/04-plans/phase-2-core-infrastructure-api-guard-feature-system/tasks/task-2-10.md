---
publish: true
id: plan.phase-2.task-2-10
title: "Lesson 7 (task 2.10): dev entitlement seed script"
created: 2026-10-18
updated: 2026-10-23
kind: plan
version: 2.1.1
tags:
   - plan
   - phase-2
   - task
   - feature-system
   - database
   - postgresql
status: planned
---

> **Lesson 7 of 8.** Before this: [[task-2-11and2-12|lesson 6]]. Next: close-out in [[phase-2-core-infrastructure-api-guard-feature-system|the plan]]. The coach follows [[contracts#How we build|how we build]]. The target design is [[contracts#Entitlements|Entitlements]].

**What gets built:** a command that enables every feature in `ALL_FEATURES` for one account in the dev database.

**Concepts:** Node scripts in a monorepo, environment files, privileged vs. runtime database roles, idempotent inserts (`ON CONFLICT DO NOTHING`), dry runs, and clear failure messages.

**Coach reads first:** [[contracts]], [[08-ai-coding-harness/commands-and-environment|commands and environment]], `.env.example`, Pratik's lesson 1 and lesson 3 code.

## Handover from lesson 6

What changed in lesson 6 ([[05-builds/phase-2-core-infrastructure-api-guard-feature-system/lesson-6-health|walkthrough]]) that this lesson builds on:

- **Start from a fresh `main`.** It has `/api/health` ([sidekick#21](https://github.com/mehtapratik/sidekick/pull/21)) and the startup check ([sidekick#22](https://github.com/mehtapratik/sidekick/pull/22)). Pratik's checkout may still be on `feature/P2L6-health`: `git switch main && git pull`.
- **The runtime client is now `getUnsafeDb()`,** created on first use (`packages/core/src/db/unsafe.ts`). The seed must not use it anyway: it's `app_runtime`, which can't write entitlements, and lint bans `**/unsafe` imports outside the wrappers. The script opens its own `postgres()` client on `DATABASE_DIRECT_URL`.
- **Top level declares, it doesn't act.** CI's first lesson 6 run failed because `unsafe.ts` read and checked `DATABASE_URL` at import, and `next build` imports every route module. Read the env, connect and throw inside the script's main function, not at module level, so importing the file (from a test, for instance) never needs a database.
- **CI has no `.env.local` and no secrets.** A local green run proves the code, not the environment. Before shipping, run what CI runs with the variables removed (`env -u DATABASE_URL …`), and make sure nothing the build or the unit tests import needs `DATABASE_DIRECT_URL`.
- **Don't add `DATABASE_DIRECT_URL` to `apps/web/src/instrumentation.ts`.** That list is what the web server needs to start. The privileged URL is for migrations and this seed only, and is never set in Vercel (`.env.example`).
- **`.env.example` has a stale comment:** `DATABASE_URL` says it's "used by the app (packages/core/src/db/index.ts)"; it's `db/unsafe.ts`. Fix it in this lesson's PR, since the lesson reads that file.
- **Teaching style** is unchanged from lessons 4–6 ([[contracts#How we build|how we build]]): give the exact code for each piece with the reasoning below, and turn this brief's "Ask:" steps into recommendations. Pratik types each piece and says "done"; review only then. Commit with the editor, not `-m`.
- **Check Next.js and library behaviour against the installed docs** before stating it: Next 16 ships its docs in `apps/web/node_modules/next/dist/docs/`. In lesson 6 the coach's first explanation of why a route was dynamic was wrong, and the bundled docs corrected it.

## Steps

By default the coach hands over each step's code as one small piece, with an explanation below it, and the two of you discuss it before it's final ([[contracts#How we build|how we build]]). **Good to write yourself:** nothing in particular; this is a good lesson to go piece by piece. Pratik decides, and can switch any step either way.

1. **Where does it live?** Ask: "Which package may import both the registry and the database schema?" Pratik explains why, then place the script in `packages/features-registry/scripts/`.
2. **Which connection?** Ask why `DATABASE_URL` (`app_runtime`) can't do this. Connect with `DATABASE_DIRECT_URL`.
3. **Write it.** Write the script: look up the profile by email, insert one row per feature key with `ON CONFLICT DO NOTHING`, and print what happened. It fails clearly when the env var or the profile is missing, and supports `--dry-run`.
4. **Run it.** Add a `seed:dev` script. Pratik runs it with Node 24's built-in TypeScript support, or with `tsx` if that doesn't work. With `ALL_FEATURES` empty, Pratik temporarily adds a test manifest to see a row land in the dev database, then removes the manifest and the row.
5. **Verify and ship.**

## Check understanding

- Why run it twice in a row? What should the second run print?
- Why must this script never run against production as it stands?

**Done when:** Pratik's PR is green, and the script has been run against dev.

**Out of scope:** a disable command (delete the row; this goes in the walkthrough) and admin UI.
