---
id: system-design.non-functional.background-jobs
created: 2026-09-19
kind: spec
version: 1.0.0
tags:
   - system-design
   - vercel
   - background-jobs
---

1. Use lightweight async background jobs using `waitUntil()`, Vercel background execution, and retry wrappers.
2. As complexity emerge post-MVP and user-base increase, this will evolve in complex ingest flow, queues, cron jobs, and distributed workers.
