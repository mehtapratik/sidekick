---
publish: true
id: opportunity.signup-confirmation-flow
created: 2026-09-19
kind: opportunity
version: 1.0.0
status: proposed
tags:
   - opportunity
   - authentication
   - ux
   - severity-low
related:
   - "[[03-system-design/non-functional/security/authentication]]"
---

**Problem**

Signup immediately navigates to the dashboard even when email confirmation can leave the user without a session.

**Risk**

The user is bounced back to login without a clear explanation of the required confirmation step.

**Recommended fix**

Handle the no-session signup result explicitly and show a confirmation-pending state.
