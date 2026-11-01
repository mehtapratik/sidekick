---
publish: true
id: system-design.non-functional.nextjs.force-dynamic
title: Force Dynamic
created: 2026-09-19
updated: 2026-11-01
kind: spec
version: 1.1.0
tags:
   - system-design
   - nextjs
   - supabase
---

**D43** `decision` #nextjs: The layout of every route group that touches Supabase cookies exports `dynamic = 'force-dynamic'`.

Sudekick to add `export const dynamic = 'force-dynamic'` to the layout of every route group that touches Supabase.

**Why:** Next.js attempts to statically pre-render layouts at build time unless told otherwise. Layouts that call Supabase (for session reads, user data, etc.) read cookies — a request-time operation that doesn't exist at build time. Without `force-dynamic`, the build will either fail or produce a stale static layout.

**Where:** `(secure)/layout.tsx` and `(auth)/layout.tsx` — any route group whose layout imports a Supabase client.

**Scope:** This only affects the layout and its children. Route groups that don't touch Supabase can remain statically rendered.

## Decision History

- 2026-09-19 · accepted · Force Dynamic
