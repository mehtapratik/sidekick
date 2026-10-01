---
publish: true
id: system-design.functional-design.global-tagging-and-llinking.a-graph-pattern-not-a-graph-database
created: 2026-09-19
kind: spec
version: 1.0.0
tags:
   - system-design
   - global-tagging-and-llinking
   - postgresql
   - graph
---

**This is a graph _pattern_, not a graph _database_.** At MVP scale, plain PostgreSQL tables with recursive CTEs for traversal are sufficient. All access goes through a `GraphRepository` in `packages/core` — the swap boundary if scale ever demands a dedicated graph engine.
