---
title: Bundle everything
deck: ''
created: '2026-09-19'
updated: '2026-09-27'
kind: spec
status: draft
version: 1.0.0
tags:
  - system-design
  - monorepo
appliesTo: []
isSection: false
docId: system-design.non-functional.monorepo.bundle-everything
sourcePath: sources/docs/03-system-design/non-functional/monorepo/bundle-everything.md
wordCount: 71
readingMinutes: 1
author: Pratik Mehta
license: CC BY-NC 4.0
description: ''
---

Sidekick’s MVP will not do entitlement checks at build time and bundle every feature into final distribution regardless of the fact that if client is enrolled into a feature is not.

Nevertheless, every feature is designed as separate package with clear and documented dependency tree.

Adding dynamic bundling later when we want to scale at enterprise level should be easy since supporting foundation is already setup from day one.

Why? [[build-for-today-designed-for-future]]
