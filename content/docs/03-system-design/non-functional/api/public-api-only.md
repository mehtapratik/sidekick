---
publish: true
id: system-design.non-functional.api.public-api-only
created: 2026-09-19
kind: spec
version: 1.0.0
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
