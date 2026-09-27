---
id: moc.system-design.opportunities
created: 2026-09-19
kind: guidance
version: 1.0.0
status: proposed
tags:
   - moc
   - system-design
   - opportunity
   - phase-2
---

# Architecture opportunities

These notes capture pragmatic risks and improvements identified before Phase 2. They optimize for a solo developer and one user today while preserving clean seams for later scale.

- [[runtime-role-reproducibility]]
- [[db-access-chokepoint]]
- [[security-proof-and-ci]]
- [[profile-trigger-and-referential-integrity]]
- [[pooler-client-configuration]]
- [[environment-contract-drift]]
- [[package-boundary-enforcement]]
- [[api-route-fail-open]]
- [[portable-documentation-vault]]
- [[signup-confirmation-flow]]

## Resolved

- [[runtime-database-url-drift]]
