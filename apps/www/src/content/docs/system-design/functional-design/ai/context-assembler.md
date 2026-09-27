---
title: Context assembler
deck: ''
created: '2026-09-19'
updated: '2026-09-27'
kind: spec
status: draft
version: 1.0.0
tags:
  - system-design
  - ai
  - war-room
  - factory
  - api-guard
appliesTo: []
isSection: false
docId: system-design.functional-design.ai.context-assembler
sourcePath: sources/docs/03-system-design/functional-design/03-ai/context-assembler.md
wordCount: 162
readingMinutes: 1
author: Pratik Mehta
license: CC BY-NC 4.0
description: ''
---

A single **Context Assembler** service in `packages/core/ai` (alongside the [[model-routing]]) is the only way features obtain AI context.

Input: a task descriptor `(feature, taskType, effortLevel)`.
Output: an assembled context bundle (kernel + applicable Tier 1 entries + relevant Tier 2 state, within budget).

No feature ever hand-rolls its own context gathering — the same enforced-convention philosophy as `withApiGuard`: one choke point, impossible to drift.

**Effort Level** is a first-class parameter in the AI request contract. It is a budget knob on the assembler — how many tiers are consulted, retrieval depth (k), how much situational state — and the model router responds to it too (higher effort can route to a more capable model). One parameter; two systems respond.

**MVP cut:** the schema fields above and a v1 assembler (kernel + top-k by tag/similarity) ship with the first AI feature; `effortLevel` exists in the contract from day one but initially only tunes retrieval depth. Tier 2 assembly arrives when War Room/Factory exist.
