---
publish: true
id: system-design.non-functional.observability
created: 2026-09-19
kind: spec
version: 1.0.0
tags:
   - system-design
   - api-guard
   - api
   - authentication
   - vercel
   - observability
---

1. MVP will support simple request logging, failed job logging, API latency logging, and auth failure logging.
2. To be done inside `withAPIGuard` to ensure we log irrespective of client.
3. Simpler plain text logs supported by Vercel should be sufficient for MVP scope.
