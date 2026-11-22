---
publish: true
id: system-design.functional-design.feature-system.registry
title: Registry
created: 2026-09-19
updated: 2026-11-22
kind: spec
version: 1.2.0
tags:
   - system-design
   - feature-system
---

`packages/features-registry` is the ledger of all features Sidekick will offer. It will host feature manifests, metadata and registration information.

It is only a catalog: it says what features exist (`FeatureManifest`: `key`, `name`, `description`) and changes only with a deploy. Who is provisioned for a feature lives in the `user_feature_entitlements` table. Whether a feature is ready to be seen at all (rollout gating) is a separate, post-MVP system ([[backlogged-unplanned#B5 — Feature rollout gating|B5]]). A feature's `key` is stored in entitlement rows, so it never changes once users have them.

**How a feature joins it (Synergy lesson 4).** Each feature package's main entry exports `FEATURE_KEY`, a plain `MANIFEST` object and `ENTITY_TYPE` (the entity types it provides). A feature sits below the registry and can't import it, so the `FeatureManifest` type stays here: `ALL_FEATURES: readonly FeatureManifest[]` checks each manifest, and `FeatureKey` is the union of every feature's `typeof FEATURE_KEY` (a key read off a plain object would widen to `string`). The first entries are the dev-only sandbox providers, `sandbox-notes` and `sandbox-tasks`. Entity types stay with their provider and are never listed centrally (D200). A feature's routes live in its `/server` entry, its request and response schemas in `/contracts`, and `apps/app` mounts each route in one line.
