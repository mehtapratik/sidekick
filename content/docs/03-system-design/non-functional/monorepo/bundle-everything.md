---
publish: true
id: system-design.non-functional.monorepo.bundle-everything
created: 2026-09-19
kind: spec
aliases:
   - bundle-everything-syml
version: 1.0.0
tags:
   - system-design
   - monorepo
---

Sidekick’s MVP will not do entitlement checks at build time and bundle every feature into final distribution regardless of the fact that if client is enrolled into a feature is not.

Nevertheless, every feature is designed as separate package with clear and documented dependency tree.

Adding dynamic bundling later when we want to scale at enterprise level should be easy since supporting foundation is already setup from day one.

Why? [[build-for-today-designed-for-future]]
