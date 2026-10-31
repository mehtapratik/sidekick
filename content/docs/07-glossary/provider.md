---
publish: false
id: glossary.provider
created: 2026-10-30
updated: 2026-10-30
kind: glossary
version: 0.1.0
tags:
   - glossary
   - synergy
---

The package that registered a linkable entity type, such as Taxila for datums or a mock module in `packages/ops` for notes. It stores the entity's content, and registers a resolver and a renderer for the type, plus the feature whose entitlement gates it. Synergy calls each provider once per page, in a batch.
