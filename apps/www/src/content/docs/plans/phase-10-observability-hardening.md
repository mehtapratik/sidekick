---
title: Phase 10 observability hardening
deck: ''
created: '2026-09-19'
updated: '2026-09-27'
kind: plan
status: approved
version: 1.0.0
tags:
  - plan
  - living-plan
  - phase-10
  - api-guard
  - rls
  - api
  - authentication
  - nextjs
  - offline
appliesTo: []
isSection: false
docId: plan.phase-10-observability-hardening
sourcePath: sources/docs/04-plans/phase-10-observability-hardening.md
wordCount: 268
readingMinutes: 2
author: Pratik Mehta
license: CC BY-NC 4.0
description: ''
---

> **Milestone:** The app is reliable enough for friends and family. You have visibility into what's failing. Error handling is consistent.
> **Learning payoff:** Structured logging, error boundaries, rate limiting, the operational side of running a web service.

| #     | Task                                                                                     | Complexity | Learning |
| ----- | ---------------------------------------------------------------------------------------- | ---------- | -------- |
| 10.1  | Add structured request logging to `withApiGuard` — method, path, userId, latency, status | 🟡         | 🧩       |
| 10.2  | Add auth failure logging — track 401/403 patterns                                        | 🟡         | 🔐       |
| 10.3  | Add failed embedding logging with enough context to retry                                | 🟡         | 🤖       |
| 10.4  | Add Next.js error boundaries to all main UI sections                                     | 🟡         | 🧩       |
| 10.5  | Add global API error response normalization — consistent `{ error, code }` shape         | 🟡         | 🧩       |
| 10.6  | Review and audit all API routes — confirm every route uses `withApiGuard`                | 🟢         | 🔐       |
| 10.7  | Audit all queries — confirm `where(isNull(table.deletedAt))` on syncable tables          | 🟢         | 🗄️       |
| 10.8  | Add basic rate limiting on auth routes and AI chat endpoint                              | 🟡         | 🔐       |
| 10.9  | Run a manual penetration test of your own app — try to access another user's data        | 🔴         | 🔐       |
| 10.10 | Add input validation (zod) on all API route handlers                                     | 🟡         | 🧩       |

**Phase 10 Exit Criteria:** Logs are structured and useful. All routes are guarded. No RLS gaps. Input validation is consistent across the API.

---
