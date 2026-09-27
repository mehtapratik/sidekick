---
id: system-design.non-functional.build-for-today-designed-for-future
created: 2026-09-19
kind: spec
version: 1.0.0
tags:
   - system-design
   - offline
---

Sidekick is intentionally designed to to balance complexity and simplicity in a way that works today for solo-developer while keeping it open enough to add needed complexity later when need arises.

- Build for solo developer/small team - ready to tackle enterprise scale need when needed
- Build for single user - ready to tackle commercial grade usage with millions of active users

This avoid premature complexity and support rapid development cycle. The architecture is open enough to support runtime feature loading, microservices, independent deployments, and offline sync-engines without large-scale rewrites.
