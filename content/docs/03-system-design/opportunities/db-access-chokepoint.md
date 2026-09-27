---
id: opportunity.db-access-chokepoint
created: 2026-09-19
kind: opportunity
version: 1.0.0
status: proposed
tags:
   - opportunity
   - phase-2
   - database
   - rls
   - architecture
   - severity-high
related:
   - "[[03-system-design/non-functional/database/repository-client]]"
   - "[[03-system-design/non-functional/security/row-level-security]]"
---

**Problem**

The raw database client is exported directly and no automated rule requires user-data access through `withRLS` or a repository boundary.

**Risk**

Convenient direct queries will accumulate before a repository chokepoint is established, making later security retrofits costly.

**Recommended fix**

Restrict the raw client export to an explicitly unsafe/server-only entry point and prohibit imports with `no-restricted-imports`. Make the safe RLS-aware path the shortest import.
