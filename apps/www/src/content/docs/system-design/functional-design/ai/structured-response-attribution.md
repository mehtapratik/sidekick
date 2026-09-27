---
title: Structured response attribution
deck: ''
created: '2026-09-19'
updated: '2026-09-27'
kind: spec
status: draft
version: 1.0.0
tags:
  - system-design
  - ai
  - structured-streaming
  - source-attribution
  - citations
appliesTo:
  - source-attribution
isSection: false
docId: system-design.functional-design.ai.structured-response-attribution
sourcePath: >-
  sources/docs/03-system-design/functional-design/03-ai/structured-response-attribution.md
wordCount: 71
readingMinutes: 1
author: Pratik Mehta
license: CC BY-NC 4.0
description: ''
---

AI responses are structured streams, not plain text streams.

Each response segment carries its source class: internal knowledge or live web retrieval. The response contract also preserves footnoted citations so the UI can distinguish source classes and show supporting material without post-processing prose.

The stream protocol must support this contract from the first AI feature, even when live web retrieval is not yet implemented. Alter Ego is the first planned consumer.
