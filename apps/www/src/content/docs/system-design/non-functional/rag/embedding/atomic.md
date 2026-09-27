---
title: Atomic
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
appliesTo: []
isSection: false
docId: system-design.non-functional.rag.embedding.atomic
sourcePath: sources/docs/03-system-design/non-functional/rag/embedding/atomic.md
wordCount: 28
readingMinutes: 1
author: Pratik Mehta
license: CC BY-NC 4.0
description: ''
---

1. Embedding must be written as single atomic transaction.
2. Never `delete and then insert` _outside_ a transaction. Doing so outside an transaction, temporary makes those embedding unavailable.
