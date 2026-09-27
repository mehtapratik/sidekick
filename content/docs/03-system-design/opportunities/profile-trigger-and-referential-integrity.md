---
id: opportunity.profile-trigger-and-referential-integrity
created: 2026-09-19
kind: opportunity
version: 1.0.0
status: proposed
tags:
   - opportunity
   - phase-2
   - database
   - authentication
   - integrity
   - severity-high
related:
   - "[[03-system-design/non-functional/security/profile-creation-postgres-trigger]]"
   - "[[03-system-design/non-functional/security/profiles-schema]]"
---

**Problem**

The auth-user profile trigger is manual database state, and `profiles.id` lacks a foreign key to `auth.users(id)`.

**Risk**

Fresh environments can miss profile creation and deleted users can leave orphaned rows.

**Recommended fix**

Version `CREATE OR REPLACE FUNCTION` and the auth trigger in a migration. Add the foreign key with explicit `ON DELETE CASCADE` semantics.
