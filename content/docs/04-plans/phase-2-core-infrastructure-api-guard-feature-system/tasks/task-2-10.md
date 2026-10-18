---
publish: true
id: plan.phase-2.task-2-10
title: "Lesson 7 (task 2.10): dev entitlement seed script"
created: 2026-10-18
updated: 2026-10-18
kind: plan
version: 2.1.0
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

## Steps

By default the coach hands over each step's code as one small piece, with an explanation below it, and the two of you discuss it before it's final ([[contracts#How we build|how we build]]). **Good to write yourself:** nothing in particular; this is a good lesson to go piece by piece. Pratik decides, and can switch any step either way.

1. **Where does it live?** Ask: "Which package may import both the registry and the database schema?" Pratik explains why, then place the script in `packages/features-registry/scripts/`.
2. **Which connection?** Ask why `DATABASE_URL` (`app_runtime`) can't do this. Connect with `DATABASE_DIRECT_URL`.
3. **Write it.** Write the script: look up the profile by email, insert one row per slug with `ON CONFLICT DO NOTHING`, and print what happened. It fails clearly when the env var or the profile is missing, and supports `--dry-run`.
4. **Run it.** Add a `seed:dev` script. Pratik runs it with Node 24's built-in TypeScript support, or with `tsx` if that doesn't work. With `ALL_FEATURES` empty, Pratik temporarily adds a test manifest to see a row land in the dev database, then removes the manifest and the row.
5. **Verify and ship.**

## Check understanding

- Why run it twice in a row? What should the second run print?
- Why must this script never run against production as it stands?

**Done when:** Pratik's PR is green, and the script has been run against dev.

**Out of scope:** a disable command (delete the row; this goes in the walkthrough) and admin UI.
