---

id: prd.ai.modal-routing
title: Model Routing
created: 2026-09-19
updated: 2026-10-13
kind: prd
audience: everyone
version: 1.0.1
tags:
  - prd
  - vercel
  - ai
  - embedding
  - routing
publish: true
---
Do not lock-in to one or more LLM provider — allow switching model based on type of request, cost and other factors

## Static Router (`@packages/core/ai`) for MVP

mapping of requests to models via configuration — mapping based on capabilities requested — features to never request any model explicitly, only capabilities — Use Vercel’s AI SDK — move to dynamic routing as product needs evolve — switching models, providers or upgrade to dynamic routing to be restricted to `@packages/core/ai`; no features to be impacted

## Embedding models are not hot-swappable

Vectors are incompatible between models — switching involves re-embedding all content — `embeddingStatus` field to support this re-embed flow.
