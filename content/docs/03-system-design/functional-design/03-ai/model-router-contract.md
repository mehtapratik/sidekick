---
publish: true
id: system-design.functional-design.ai.model-router-contract
created: 2026-09-19
kind: spec
version: 1.0.0
authority: canonical
retrieval_priority: high
tags:
  - system-design
  - ai
  - model-routing
  - provider-agnostic
  - embeddings
applies_to:
  - "[[model-routing]]"
related:
  - "[[03-system-design/functional-design/03-ai/context-assembler]]"
  - "[[03-system-design/non-functional/rag/00-rag]]"
---

Features request AI capabilities such as `chat`, `classify`, or `coach`; they never select a concrete provider or model.

`packages/core/ai` owns the static model router. It resolves a capability and `effortLevel` to configured provider/model settings through the Vercel AI SDK provider registry. Switching a text model or provider is configuration work, not feature work.

Embedding models are an exception. Their vectors are incompatible across models, so a model change requires a tracked re-embedding migration.
