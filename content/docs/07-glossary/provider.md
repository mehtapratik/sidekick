---
publish: false
id: glossary.provider
created: 2026-10-30
updated: 2026-11-01
kind: glossary
version: 0.1.1
tags:
   - glossary
   - synergy
---

The package that registered a linkable entity type, such as Taxila for datums or the mock `packages/features/_sandbox/notes` for notes. It stores the entity's content, and registers a resolver and a renderer for the type, plus the feature whose entitlement gates it. Synergy calls each provider once per page, in a batch.
