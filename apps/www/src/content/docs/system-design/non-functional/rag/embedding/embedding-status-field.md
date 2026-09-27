---
title: Embedding status field
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
  - typescript
  - embeddings
appliesTo: []
isSection: false
docId: system-design.non-functional.rag.embedding.embedding-status-field
sourcePath: >-
  sources/docs/03-system-design/non-functional/rag/embedding/embedding-status-field.md
wordCount: 95
readingMinutes: 1
author: Pratik Mehta
license: CC BY-NC 4.0
description: ''
---

1. All content table participating in embedding pipeline must include `embedding_status` field.

```typescript
embeddingStatus: text("embedding_status").notNull().default("pending"); // 'pending' | 'complete' | 'failed'
```

2. Use `embedding_status` field to:
   1. query un-embedded or failed content
   2. manual or automatic retries of failures
   3. have visibility in embedding pipeline health
   4. support re-embedding after model upgrades/replacements

3. Status transition:
   1. `pending` → `complete` (successful embedding write)
   2. `pending` → `failed` (all retries exhausted)
   3. `failed` → `pending` (manual or automated retry trigger)

4. All failures must be logged. Do not fail silently.
5. All failures must be retriable.
