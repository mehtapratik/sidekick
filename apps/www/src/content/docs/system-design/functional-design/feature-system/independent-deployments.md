---
title: Independent deployments
deck: ''
created: '2026-09-19'
updated: '2026-09-27'
kind: spec
status: draft
version: 1.0.0
tags:
  - system-design
  - feature-system
appliesTo: []
isSection: false
docId: system-design.functional-design.feature-system.independent-deployments
sourcePath: >-
  sources/docs/03-system-design/functional-design/00-feature-system/independent-deployments.md
wordCount: 25
readingMinutes: 1
author: Pratik Mehta
license: CC BY-NC 4.0
description: ''
---

Though we’re [[03-system-design/non-functional/monorepo/bundle-everything|bundling everything]] regardless of feature entitlements, [[migration]] strategy ensures that we can easily support independent deployments without major re-architecture efforts when need arises.
