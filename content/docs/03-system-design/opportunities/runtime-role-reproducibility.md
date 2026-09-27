---
id: opportunity.runtime-role-reproducibility
created: 2026-09-19
kind: opportunity
version: 1.0.0
status: proposed
tags:
   - opportunity
   - phase-2
   - database
   - security
   - severity-critical
related:
   - "[[03-system-design/non-functional/database/app_runtime-for-drizzle]]"
---

**Problem**

The `app_runtime` role is granted privileges in migrations but its existence is assumed to have been created manually.

**Risk**

Fresh databases, staging environments, and recovery workflows cannot reproduce the intended security boundary.

**Recommended fix**

Create `app_runtime NOLOGIN` idempotently in a migration. Keep only the login password out of Git and configure it out of band.
