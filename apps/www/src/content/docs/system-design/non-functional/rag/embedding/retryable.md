---
title: Retryable
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
docId: system-design.non-functional.rag.embedding.retryable
sourcePath: sources/docs/03-system-design/non-functional/rag/embedding/retryable.md
wordCount: 26
readingMinutes: 1
author: Pratik Mehta
license: CC BY-NC 4.0
description: ''
---

1. Embedding jobs must retry twice (configurable number)
2. Use exponential backoff strategy
3. Log each failure
4. Set `embeddingStatus = ‘failed’` after retries are exhausted
