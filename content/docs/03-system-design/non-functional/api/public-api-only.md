---
publish: true
id: system-design.non-functional.api.public-api-only
title: Public API Only
created: 2026-09-19
updated: 2026-11-01
kind: spec
version: 1.1.0
tags:
   - system-design
   - api
   - rls
   - authentication
   - cli
---

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

## Decision History

- 2026-10-27 · accepted · One Interface for Every Consumer
