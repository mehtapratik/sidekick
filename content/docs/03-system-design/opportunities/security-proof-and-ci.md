---
id: opportunity.security-proof-and-ci
created: 2026-09-19
kind: opportunity
version: 1.0.0
status: proposed
tags:
   - opportunity
   - phase-2
   - testing
   - ci
   - security
   - severity-high
related:
   - "[[08-ai-coding-harness/best-practices]]"
   - "[[03-system-design/non-functional/security/with-api-guard]]"
---

**Problem**

There is no test runner or code CI for the authorization chokepoint. Schema inspection cannot prove the role used by the running application.

**Risk**

RLS and authorization regressions can be marked complete without ever executing their critical behavior.

**Recommended fix**

Add one integration test that uses the runtime connection: two users see only their own rows and a context-free query sees zero. Run it with lint, typecheck, and build in CI.
