---
title: Build for today designed for future
deck: ''
created: '2026-09-19'
updated: '2026-09-27'
kind: spec
status: draft
version: 1.0.0
tags:
  - system-design
  - offline
appliesTo: []
isSection: false
docId: system-design.non-functional.build-for-today-designed-for-future
sourcePath: >-
  sources/docs/03-system-design/non-functional/build-for-today-designed-for-future.md
wordCount: 91
readingMinutes: 1
author: Pratik Mehta
license: CC BY-NC 4.0
description: ''
---

Sidekick is intentionally designed to to balance complexity and simplicity in a way that works today for solo-developer while keeping it open enough to add needed complexity later when need arises.

- Build for solo developer/small team - ready to tackle enterprise scale need when needed
- Build for single user - ready to tackle commercial grade usage with millions of active users

This avoid premature complexity and support rapid development cycle. The architecture is open enough to support runtime feature loading, microservices, independent deployments, and offline sync-engines without large-scale rewrites.
