---
title: Many clients and many consumers
deck: ''
created: '2026-09-19'
updated: '2026-09-27'
kind: spec
status: draft
version: 1.0.0
tags:
  - system-design
  - api
  - pwa
  - ai
  - rag
  - cli
appliesTo: []
isSection: false
docId: system-design.non-functional.many-clients-and-many-consumers
sourcePath: >-
  sources/docs/03-system-design/non-functional/many-clients-and-many-consumers.md
wordCount: 105
readingMinutes: 1
author: Pratik Mehta
license: CC BY-NC 4.0
description: ''
---

- Sidekick will be accessible through many types of **clients** and it will have various type of **consumers**.
- MVP offers consumption through a web-app, side-loaded PWA, cli, a RAG agent, and public API.
- Sidekick’s consumer doesn’t have to be human only; they can be third-party app, an LLM agent, crawler, automated job invoked through API, or a human user.

Why:

1. [[learn]]: To learn modern stack and remain competitive in market
2. [[career-growth]]: prove that you can build massive scope to land more opportunities
3. [[commercialization]] to have a real shot at commercialization, we must have API and CLI based interface at minimum.
