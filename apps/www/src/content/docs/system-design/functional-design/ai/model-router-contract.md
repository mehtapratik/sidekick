---
title: Model router contract
deck: ''
created: '2026-09-19'
updated: '2026-09-27'
kind: spec
status: draft
version: 1.0.0
tags:
  - system-design
  - ai
  - model-routing
  - provider-agnostic
  - embeddings
appliesTo:
  - model-routing
isSection: false
docId: system-design.functional-design.ai.model-router-contract
sourcePath: sources/docs/03-system-design/functional-design/03-ai/model-router-contract.md
wordCount: 73
readingMinutes: 1
author: Pratik Mehta
license: CC BY-NC 4.0
description: ''
---

Features request AI capabilities such as `chat`, `classify`, or `coach`; they never select a concrete provider or model.

`packages/core/ai` owns the static model router. It resolves a capability and `effortLevel` to configured provider/model settings through the Vercel AI SDK provider registry. Switching a text model or provider is configuration work, not feature work.

Embedding models are an exception. Their vectors are incompatible across models, so a model change requires a tracked re-embedding migration.
