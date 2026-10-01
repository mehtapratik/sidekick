---
publish: true
id: system-design.non-functional.rag.embedding.atomic
created: 2026-09-19
kind: spec
version: 1.0.0
tags:
   - system-design
   - rag
   - embedding
   - embeddings
---

1. Embedding must be written as single atomic transaction.
2. Never `delete and then insert` _outside_ a transaction. Doing so outside an transaction, temporary makes those embedding unavailable.
