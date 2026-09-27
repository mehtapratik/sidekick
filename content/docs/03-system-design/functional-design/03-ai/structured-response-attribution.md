---
id: system-design.functional-design.ai.structured-response-attribution
created: 2026-09-19
kind: spec
version: 1.0.0
authority: canonical
retrieval_priority: high
tags:
  - system-design
  - ai
  - structured-streaming
  - source-attribution
  - citations
applies_to:
  - "[[source-attribution]]"
related:
  - "[[03-system-design/functional-design/03-ai/context-assembler]]"
  - "[[03-system-design/non-functional/rag/00-rag]]"
---

AI responses are structured streams, not plain text streams.

Each response segment carries its source class: internal knowledge or live web retrieval. The response contract also preserves footnoted citations so the UI can distinguish source classes and show supporting material without post-processing prose.

The stream protocol must support this contract from the first AI feature, even when live web retrieval is not yet implemented. Alter Ego is the first planned consumer.
