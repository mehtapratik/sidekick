---
id: decision.technical.force-dynamic
created: 2026-09-19
kind: decision
version: 1.0.0
tags:
   - decisions
   - technical
   - architecture-decision
   - supabase
   - authentication
   - nextjs
applies_to:
   - "[[03-system-design/non-functional/nextjs/force-dynamic]]"
status: accepted
---

Sudekick to add `export const dynamic = 'force-dynamic'` to the layout of every route group that touches Supabase.

**Why:** Next.js attempts to statically pre-render layouts at build time unless told otherwise. Layouts that call Supabase (for session reads, user data, etc.) read cookies — a request-time operation that doesn't exist at build time. Without `force-dynamic`, the build will either fail or produce a stale static layout.

**Where:** `(secure)/layout.tsx` and `(auth)/layout.tsx` — any route group whose layout imports a Supabase client.

**Scope:** This only affects the layout and its children. Route groups that don't touch Supabase can remain statically rendered.
