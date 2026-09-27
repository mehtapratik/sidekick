---
title: A graph pattern not a graph database
deck: ''
created: '2026-09-19'
updated: '2026-09-27'
kind: spec
status: draft
version: 1.0.0
tags:
  - system-design
  - global-tagging-and-llinking
  - postgresql
  - graph
appliesTo: []
isSection: false
docId: >-
  system-design.functional-design.global-tagging-and-llinking.a-graph-pattern-not-a-graph-database
sourcePath: >-
  sources/docs/03-system-design/functional-design/02-global-tagging-and-linking/01-a-graph-pattern-not-a-graph-database.md
wordCount: 42
readingMinutes: 1
author: Pratik Mehta
license: CC BY-NC 4.0
description: ''
---

**This is a graph _pattern_, not a graph _database_.** At MVP scale, plain PostgreSQL tables with recursive CTEs for traversal are sufficient. All access goes through a `GraphRepository` in `packages/core` — the swap boundary if scale ever demands a dedicated graph engine.
