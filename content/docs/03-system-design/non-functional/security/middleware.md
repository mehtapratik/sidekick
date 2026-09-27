---
id: system-design.non-functional.security.middleware
created: 2026-09-19
kind: spec
version: 1.0.0
tags:
   - system-design
   - security
   - api
   - authentication
---

`proxy.ts` is responsible for…

- session refresh,
- redirecting unauthenticated users, and
- excluding API routes from redirect behavior.

It must not contain authorization logic, which strictly belongs in [[with-api-guard]].
