---
publish: true
id: harness.database-and-security
created: 2026-09-19
updated: 2026-10-23
kind: guidance
version: 1.1.0
tags:
   - ai-coding
   - database
   - security
   - agent-guidance
   - api-guard
   - rls
   - drizzle
   - api
   - react
   - repository-pattern
---

Use the repository client for database access, preserve RLS, and route mutations through the API layer. Drizzle never runs in client components.

Supabase's Data API is off, and its roles (`anon`, `authenticated`) hold no privileges in `public`; default privileges keep new tables, sequences and functions that way. Never grant them anything, and don't add `SECURITY DEFINER` functions without a review. `tests/integration/data-api-roles.test.ts` fails if either slips.

- [[03-system-design/non-functional/database/repository-client|Repository client]]
- [[03-system-design/non-functional/security/row-level-security|Row-level security]]
- [[03-system-design/non-functional/api/never-mutate-outside-api-layer|Mutation boundary]]
- [[03-system-design/non-functional/security/with-api-guard|API guard]]
