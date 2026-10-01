---
publish: true
id: system-design.non-functional.nextjs.server-actions
created: 2026-09-19
kind: spec
version: 1.0.0
tags:
   - system-design
   - nextjs
   - rls
   - api
   - authentication
---

Server actions are permitted as long as they honor [[request-flow]] standard. In other words, server actions must not bypass (or implement its own) auth, entitlements, RLS or scope checks. This is to ensure [[api-first]] architecture.
