---
title: Observable
deck: ''
created: '2026-09-19'
updated: '2026-09-27'
kind: spec
status: draft
version: 1.0.0
tags:
  - system-design
  - rag
  - embedding
  - embeddings
  - observability
appliesTo: []
isSection: false
docId: system-design.non-functional.rag.embedding.observable
sourcePath: sources/docs/03-system-design/non-functional/rag/embedding/observable.md
wordCount: 25
readingMinutes: 1
author: Pratik Mehta
license: CC BY-NC 4.0
description: ''
---

1. Embedding writes must be observable.
2. [[observability|MVP does not require full observability infrastructure]]. At minimum, support structured logs, failed embedding logs, and latency visibility.
