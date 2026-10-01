---
publish: true
id: system-design.non-functional.rag.rag
created: 2026-09-19
kind: spec
version: 1.0.0
tags:
   - system-design
   - rag
   - ai
   - embeddings
authority: canonical
retrieval_priority: high
related:
   - "[[03-system-design/functional-design/03-ai/context-assembler]]"
---

- The pipeline requires pgvector, HNSW indexing, semantic chunking, async embedding generation, and streaming AI responses.
