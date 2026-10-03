---
publish: true
id: opportunity.environment-contract-drift
created: 2026-09-19
kind: opportunity
version: 1.0.0
status: proposed
tags:
   - opportunity
   - phase-2
   - config
   - security
   - developer-experience
   - severity-medium
related:
   - "[[03-system-design/non-functional/config/dotenv-cli]]"
---

**Problem**

`.env.example` does not match the Supabase keys or direct database URL consumed by code.

**Risk**

A new developer or environment follows the documented bootstrap path and gets a broken app or migration workflow; the runtime/direct role distinction is forgotten.

**Recommended fix**

Match every variable name used by code and document that `DATABASE_URL` uses the restricted runtime role while `DATABASE_DIRECT_URL` uses the migration owner role.
