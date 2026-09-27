---
id: system-design.non-functional.offline-ready
created: 2026-09-19
kind: spec
version: 1.0.0
tags:
   - system-design
   - api
   - pwa
   - offline
   - soft-delete
   - idempotency
---

1. Offline capabilities aren’t in MVP scope
2. But we want to design architecture for offline support so it can be done easily in later phases.
3. Rules
   1. Clients to generate UUIDs to prevent collision issues later
   2. We need [[idempotent-api]] so repeated request with same ID produce same result. This is critical for sync reliability.
   3. Every request to funnel through [[repository-client]] to prevent sync challenges later.
   4. Soft-delete only on [[syncable-tables]].
   5. Timestamp columns are mandatory for [[syncable-tables]].

Why do we need offline-ready capabilities?

- [[build-for-today-designed-for-future]]
- [[many-clients-and-many-consumers]] (one of the client is native app with PWA)

**Open questions:**

1. Support a user decides to close their account. This triggers hard deletion of associated user profile row since `user_profile` is non-syncable table. But, user also has content on various syncable tables. What should happen to them? Deleting user profile but leaving their content on other tables is merely waste of space and source of confusion. It may also introduce privacy and user rights issues in certain countries where users have right to permanently wipe out their data.
