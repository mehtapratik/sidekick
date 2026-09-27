---
title: Checkpoint d
deck: ''
created: '2026-09-19'
updated: '2026-09-27'
kind: plan
status: built
version: 1.0.0
tags:
  - plan
  - phase-0
  - checkpoint
  - api-guard
  - rls
  - supabase
  - drizzle
  - api
  - authentication
appliesTo: []
isSection: false
docId: plan.phase-0.checkpoint-d
sourcePath: sources/docs/04-plans/phase-0-foundation-and-tooling/checkpoint-d.md
wordCount: 232
readingMinutes: 2
author: Pratik Mehta
license: CC BY-NC 4.0
description: ''
---

- Add an environment template file (avoid committing secrets):
   - document **all variables listed in the architecture handover §20.1**, explicitly including:
      - Supabase: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `DATABASE_URL`
      - AI Providers: `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`
      - Billing/Stripe: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`
      - App: `NEXT_PUBLIC_APP_URL`
   - clarify which are needed now vs later phases
- Commit + push to GitHub **before** linking Vercel:
   - create a GitHub repo
   - make an initial commit
   - push the repository (Vercel will pull source via the Git provider)
- Set up Vercel project:
   - link repo to Vercel
   - configure environment variables in Vercel dashboard (values may be placeholders until Phase 1/6/11)
   - confirm build command / root directory / framework detection works for the monorepo.

**Checkpoint D exit**: Vercel project is linked and can build `apps/web` (even if runtime features are not configured yet).

## Verification steps (done at each checkpoint)

- `pnpm turbo build`
- `pnpm turbo dev` (web starts)
- dependency-boundary enforcement is automated (lint fails if `packages/*` imports from `apps/*`).

## Primary files we’ll create/touch in Phase 0

- Root: `package.json`, `pnpm-workspace.yaml`, `turbo.json`, `tsconfig.base.json`, `.eslint*`, `.prettierrc*`, `README.md`
- Apps: `apps/web/*`, `apps/cli/*`
- Packages: `packages/core/*`, `packages/ui/*`, `packages/features-registry/*`
- Persistence: `docs/progress/phase-0.md`, `docs/decisions/phase-0.md`

### Out of scope for Phase 0 (explicitly)

- Supabase project creation, auth, RLS, Drizzle migrations orchestration (`pnpm db:migrate`) — starts Phase 1.
- Implementing `withApiGuard`, feature entitlements, or any `/api/v1/*` routes — starts Phase 2.
