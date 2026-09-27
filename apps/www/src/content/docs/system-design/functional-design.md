---
title: Functional design
deck: ''
created: '2026-09-19'
updated: '2026-09-27'
kind: guidance
status: draft
version: 1.0.0
tags:
  - moc
  - system-design
  - functional-design
  - ai
  - feature-system
appliesTo: []
isSection: true
docId: moc.functional-design
sourcePath: sources/docs/03-system-design/functional-design/index.md
wordCount: 78
readingMinutes: 1
author: Pratik Mehta
license: CC BY-NC 4.0
description: ''
---

- [[00-feature-system/registry|Feature registry]] — canonical feature contract and entity-type ledger.
- [[01-core-drive/00-tiered-context-model|Tiered context model]] — AI context budget and retrieval policy.
- [[02-global-tagging-and-linking/00-global-tags-and-metadata|Global tags and metadata]] — primary applicability key for cross-feature retrieval.
- [[03-ai/context-assembler|Context assembler]] — required choke point for AI context; no feature assembles context independently.
- [[03-ai/model-router-contract|Model router contract]] — provider and model selection boundary.
- [[03-ai/structured-response-attribution|Structured response attribution]] — streaming source and citation contract.
- [[../non-functional/rag/00-rag|RAG]] — embedding and retrieval pipeline for knowledge content.
