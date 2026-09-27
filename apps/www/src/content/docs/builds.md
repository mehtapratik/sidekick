---
title: Builds
deck: ''
created: '2026-05-29'
updated: '2026-09-27'
kind: guidance
status: built
version: 1.0.0
tags:
  - moc
  - build
  - walkthrough
appliesTo: []
isSection: true
docId: moc.builds
sourcePath: sources/docs/05-builds/index.md
wordCount: 97
readingMinutes: 1
author: Pratik Mehta
license: CC BY-NC 4.0
description: ''
---

Step-by-step build guides that reconstruct each phase from scratch in its correct final form — no back-and-forth, with a "what and why" note on every step.

Use these to reinforce understanding after completing a phase, or to rebuild cleanly after resetting a branch.

## Phases

- [[05-builds/phase-0-foundation-and-tooling/index|Phase 0 — Foundation and tooling]] — monorepo setup, Turborepo, TypeScript, ESLint, Prettier
- [[05-builds/phase-1-walkthrough|Phase 1 — Supabase auth, DB schema, and UI shell]] — Supabase project, Drizzle, profiles table, auth pages, app shell
- [[05-builds/phase-1-1-db-rls-enforcement|Phase 1.1 — Database security hardening]] — `app_runtime` role, RLS enforcement, soft-delete triggers, `withRLS` transaction fix
