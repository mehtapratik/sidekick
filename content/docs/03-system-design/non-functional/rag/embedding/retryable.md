---
publish: true
id: system-design.non-functional.rag.embedding.retryable
created: 2026-09-19
kind: spec
version: 1.0.0
tags:
   - system-design
   - rag
   - embedding
---

1. Embedding jobs must retry twice (configurable number)
2. Use exponential backoff strategy
3. Log each failure
4. Set `embeddingStatus = ‘failed’` after retries are exhausted
