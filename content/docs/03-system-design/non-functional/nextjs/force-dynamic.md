---
id: system-design.non-functional.nextjs.force-dynamic
created: 2026-09-19
kind: spec
version: 1.0.0
tags:
   - system-design
   - nextjs
   - supabase
---

Add `export const dynamic = 'force-dynamic'` to the layout of every route group that touches Supabase cookies to prevent static pre-rendering failures.

[[06-decisions/technical/force-dynamic|more information]]
