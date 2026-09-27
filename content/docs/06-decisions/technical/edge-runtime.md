---
id: decision.technical.edge-runtime
created: 2026-09-19
kind: decision
version: 1.0.0
tags:
   - decisions
   - technical
   - architecture-decision
   - supabase
   - api
   - nextjs
applies_to:
   - "[[03-system-design/non-functional/security/edge-runtime]]"
status: accepted
---

Sidekick to have a dedicated `createProxyClient(request, response)` Supabase client for edge runtime.

**Why:** `createServerClient()` (the standard server client) calls `cookies()` from `next/headers` to read and write session cookies. `next/headers` is a Node.js-only API — it is not available in the Edge runtime. `proxy.ts` runs in the Edge runtime, so using `createServerClient()` there would crash at runtime.

`createProxyClient` receives the incoming `Request` and outgoing `Response` objects directly, reads/writes cookies from those objects, and never calls `next/headers`. It must be used exclusively in `proxy.ts`.
