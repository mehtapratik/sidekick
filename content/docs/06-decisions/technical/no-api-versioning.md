---
publish: true
id: decision.technical.no-api-versioning
created: 2026-09-19
kind: decision
version: 1.0.0
tags:
   - decisions
   - technical
   - architecture-decision
   - api-guard
   - api
   - nextjs
   - cli
status: deferred
revisit_when: external clients, CLI, or agent integration materially expands
applies_to:
   - "[[03-system-design/non-functional/api/api-versioning]]"
---

## What

Current API routes live at `/api/` with no version prefix. Versioning (`/api/v1/`, `/api/v2/`) is deferred.

## Why not now

MVP has one client: the web application. There is no external party that needs migration time when a breaking change is made. Adding `/api/v1/` adds URL complexity and forces a naming convention decision (what constitutes a "version"?) with no current benefit. Breaking changes during MVP can be coordinated directly — there is only one consumer.

## When to add

Add API versioning when:

- Multiple external clients (CLI, agents, third-party integrations) need time to migrate after breaking changes
- Breaking changes become frequent enough that direct coordination is impractical

### How to add when the time comes

Create a versioned route group at `apps/web/src/app/api/v1/`. Move route handlers into the versioned group. No architectural rework is needed — Next.js route groups handle the URL structure, and `withApiGuard` works identically regardless of the URL prefix. Old unversioned routes can be aliased or left in place during a migration period.
