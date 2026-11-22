---
publish: true
id: system-design.non-functional.api.public-api-only
title: Public API Only
created: 2026-09-19
updated: 2026-11-20
kind: spec
version: 1.2.0
tags:
   - system-design
   - api
   - rls
   - authentication
   - cli
---

**D48** `decision` #api #interface: Every capability has one interface, and Sidekick's own clients use it the way bots, jobs and third parties do. derived-from [[D3]]

## Reasons

1. One of the motivation is [[motivation.commercialization]] and modern services aren’t just consumed by humans via user interfaces. They are also accessed by bots, scheduled jobs, shell scripts, and third-party applications via CLI or public APIs.
2. We have multiple clients ([[many-clients-and-many-consumers]]) and building API layer for each will be a maintenance nightmare and may introduce drifts which are hard to fix later.

## Spec

- Every client — internal or external — must go through Public API.
- Public API will come with detailed documentation to support,
   - bots
   - automations
   - bespoke solutions
   - third-party provider integrations

## Benefits

1. Centralize auth, RLS, and business logic
2. Reduce chances of drifts
3. API scope are centralized

## What

Every capability has one interface. Sidekick's own clients use it exactly the way bots, jobs, agents and third parties do. No internal path sits beside a public one: no server actions, no pages that read the database directly, no private routes that copy a public endpoint.

## Why

- Bots and agents can't tell you a screen is confusing. They fail quietly against a contract nobody inside tested.
- Two paths to one capability drift apart, and the one Sidekick doesn't use is the one that breaks.
- An API its own maker uses every day is one others can trust.

## Consequences

- When the interface doesn't serve Sidekick's own UI well, change the interface. Don't route around it.
- `packages/ops` is outside this rule. It holds privileged maintenance, not a second way into a capability, and each script names the endpoint that will retire it.

## The App's UI goes through the API

**D269** `rule` #api #lint: In `apps/app`, only route handlers (`src/app/api/**/route.ts`) may import `@sidekick/core/db`, `@sidekick/core/api` or any package's `/server` entry point; pages, layouts and components reach data by calling the API. derived-from [[D48]]

The API and the UI share one Next.js app, so nothing but a rule stops a Server Component from importing `withRLS` and reading the database directly: a second, private path beside the public one, which D48 forbids. ESLint's `no-restricted-imports` refuses those imports everywhere in `apps/app/src` except route files (Pratik, 2026-11-20, Synergy lesson 4). A feature's main entry point (its `FEATURE_KEY` and manifest) and its `/contracts` stay importable anywhere. Auth helpers (`@sidekick/core/supabase/*`) are not data access and stay allowed.

## Where the API is served

**D270** `decision` #api #hosting: The API stays inside `apps/app`, served by the same Next.js deployment as the UI; a separate `apps/api` at its own address is deferred to Phase 9 (Terminal). related-to [[D48]] related-to [[D269]]

A separate deployment would make "the UI is just another client" structural and let the API deploy and scale on its own. Today it would cost cross-origin auth (CORS and Supabase session cookies across subdomains, or a proxy), a network hop for every Server Component that needs data, and two deployments whose versions can drift, with no gain a user feels (Pratik, 2026-11-20). The split stays cheap: handlers live in their feature packages and each route file is one line of wiring, so moving them is moving those lines, and D269 already keeps the UI off the data layer.

**Revisit at Phase 9**, when the CLI and a public developer API need the API's own address and versioning, or earlier if the API must deploy, scale or run on a runtime separately from the UI.

## Decision History

- 2026-10-27 · accepted · One Interface for Every Consumer
- 2026-11-20 · accepted · The App's UI goes through the API, enforced by lint ([[D269]]), Synergy lesson 4
- 2026-11-20 · deferred · A separate API deployment, revisited at Phase 9 ([[D270]]), Synergy lesson 4
