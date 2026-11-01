---
publish: true
id: system-design.non-functional.security.edge-runtime
title: Edge Runtime
created: 2026-09-19
updated: 2026-11-01
kind: spec
version: 1.1.0
tags:
   - system-design
   - security
   - supabase
---

**D38** `decision` #supabase #edge: Edge-runtime code uses `createProxyClient`, and nothing else does.

Sidekick to have a dedicated `createProxyClient(request, response)` Supabase client for edge runtime.

**Why:** `createServerClient()` (the standard server client) calls `cookies()` from `next/headers` to read and write session cookies. `next/headers` is a Node.js-only API — it is not available in the Edge runtime. `proxy.ts` runs in the Edge runtime, so using `createServerClient()` there would crash at runtime.

`createProxyClient` receives the incoming `Request` and outgoing `Response` objects directly, reads/writes cookies from those objects, and never calls `next/headers`. It must be used exclusively in `proxy.ts`.

## Decision History

- 2026-09-19 · accepted · Edge Runtime
