---
publish: true
id: prd.features.core-drive-vs-taxila
created: 2026-09-19
kind: prd
version: 1.0.0
tags:
   - system-design
   - prd
   - feature
   - taxila
   - core-drive
applies_to:
   - "[[04-plans/phase-4-taxila-v1-knowledge-management]]"
---

- Taxila is a monolithic corpus consumed via top-k similarity retrieval.
- Core Drive is a minimal but selectively curated source of facts and truth about the user, assembled by a tier system. The tier 0 (the kernel) sources are always loaded entirely whereas others depend on vector similarity match.
