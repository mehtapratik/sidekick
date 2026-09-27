---
id: opportunity.package-boundary-enforcement
created: 2026-09-19
kind: opportunity
version: 1.0.0
status: proposed
tags:
   - opportunity
   - phase-2
   - monorepo
   - eslint
   - architecture
   - severity-medium
related:
   - "[[03-system-design/non-functional/monorepo/dependency-flow]]"
   - "[[03-system-design/non-functional/code-quality-checks/eslint/eslint-plugin-boundaries]]"
---

**Problem**

The current boundaries configuration groups all packages into one type, so it does not enforce the documented `apps → feature packages → core` direction.

**Risk**

The first feature packages can create reverse dependencies that turn shared core infrastructure into a feature-aware dependency.

**Recommended fix**

Model app, feature-package, and core-package as separate boundary elements before adding the first cross-package feature dependency.
