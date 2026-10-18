---
publish: true
id: system-design.functional-design.feature-system.registry
created: 2026-09-19
updated: 2026-10-18
kind: spec
version: 1.1.0
tags:
   - system-design
   - feature-system
---

`packages/features-registry` is the ledger of all features Sidekick will offer. It will host feature manifests, metadata and registration information.

It is only a catalog: it says what features exist (`FeatureManifest`: `key`, `name`, `description`) and changes only with a deploy. Who is provisioned for a feature lives in the `user_feature_entitlements` table. Whether a feature is ready to be seen at all (rollout gating) is a separate, post-MVP system ([[backlogged-unplanned#B5 — Feature rollout gating|B5]]). A feature's `key` is stored in entitlement rows, so it never changes once users have them.
