---
publish: true
id: system-design.non-functional.observability.centralized
created: 2026-09-19
updated: 2026-10-23
kind: spec
version: 1.1.0
tags:
   - system-design
   - observability
   - api
   - authentication
---

The primary logging surface is inside [[with-api-guard]], which logs one JSON line per event (shipped in Phase 2, lesson 5):

- Every request, at its end: `api.request` with method, path, userId, status and latency
- Every 401 and 403: `api.denied` with the error code, and the missing feature or scope
- Every 500: `api.error` with the error's name, message and stack frames, which the client never sees

This centralizes visibility without requiring each route handler to implement its own logging. The exact fields, and what is never logged (query strings, headers, cookies, tokens, bodies, emails), are in [[contracts#Logging|the Phase 2 contracts]].
