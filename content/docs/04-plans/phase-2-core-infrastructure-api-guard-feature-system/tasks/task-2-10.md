---
publish: true
id: plan.phase-2.task-2-10
title: "Task 2.10: dev entitlement seed script"
created: 2026-10-18
kind: plan
version: 1.0.0
tags:
   - plan
   - phase-2
   - task
   - feature-system
   - database
   - postgresql
status: planned
---

> **Handoff:** wave 2, runs alongside [[task-2-2and2-3]]. Starts after [[task-2-6and2-7]] and [[task-2-8and2-9]] are merged.

**Goal:** one command that enables every feature in `ALL_FEATURES` for a given account during development.

**Read first:** [[contracts#Entitlements|entitlements contract]], [[08-ai-coding-harness/commands-and-environment|commands and environment]], `.env.example`.

## Build

1. Create `packages/features-registry/scripts/seed-dev-entitlements.ts`. It lives in the registry because the registry may import foundation packages, but `packages/core` can't import the registry.
2. Usage: `pnpm --filter @sidekick/features-registry seed:dev -- --email <address> [--dry-run]`. Load the root `.env.local` with `dotenv-cli`, as `db:migrate` does.
3. Connect with `postgres` to `DATABASE_DIRECT_URL`, because `app_runtime` can't write entitlements. Look up the profile id by email, then for each slug run `INSERT … ON CONFLICT (user_id, feature_slug) DO NOTHING`. Print what it did. Exit non-zero with a clear message when `DATABASE_DIRECT_URL` is missing or the email has no profile. With `ALL_FEATURES` empty, it says "no features registered" and exits 0.
4. Run it with Node 24's built-in TypeScript support if importing `../src/index.ts` works without tsconfig changes. Otherwise add `tsx` as a devDependency. Say which you chose in the PR.

## Done when

- `--dry-run` prints the plan without writing anything.
- Pratik has run it against the dev project after [[task-2-8and2-9]]'s migration is applied. The script can't run from a cloud container, because it needs `.env.local`.
- `pnpm turbo lint typecheck build --force` passes.

## Out of scope

A disable command (disable by deleting the row, documented in the walkthrough), production use, and admin UI.

**Learning focus:** why a seed script uses the privileged connection, idempotent inserts, and keeping scripts out of the app bundle.
