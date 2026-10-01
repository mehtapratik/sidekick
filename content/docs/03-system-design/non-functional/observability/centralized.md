---
publish: true
id: system-design.non-functional.observability.centralized
created: 2026-09-19
kind: spec
version: 1.0.0
tags:
   - system-design
   - observability
   - api
   - authentication
---

The primary logging surface is inside [[with-api-guard]]:

- Request start: method, path, userId
- Request end: status, latency
- Auth failures: 401/403 events with reason
- Feature entitlement denials

This centralizes visibility without requiring each route handler to implement its own logging.
