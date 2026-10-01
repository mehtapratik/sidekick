---
publish: true
id: opportunity.api-route-fail-open
created: 2026-09-19
kind: opportunity
version: 1.0.0
status: proposed
tags:
   - opportunity
   - phase-2
   - api
   - security
   - eslint
   - severity-low
related:
   - "[[03-system-design/non-functional/security/with-api-guard]]"
---

**Problem**

The proxy deliberately does not authenticate API routes, but nothing prevents a new route from omitting `withApiGuard`.

**Risk**

A future route can be publicly reachable because its author follows the shortest path instead of the intended guard.

**Recommended fix**

Extend the existing custom ESLint plugin to require API route handlers to use `withApiGuard`.
