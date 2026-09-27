---
title: AI coding harness
deck: ''
created: '2026-09-19'
updated: '2026-09-27'
kind: guidance
status: draft
version: 1.0.0
tags:
  - moc
  - ai-coding
  - engineering
  - agent-guidance
  - ai
appliesTo: []
isSection: true
docId: moc.ai-coding-harness
sourcePath: sources/docs/08-ai-coding-harness/index.md
wordCount: 87
readingMinutes: 1
author: Pratik Mehta
license: CC BY-NC 4.0
description: ''
---

Start here for implementation work.

- [[agent-guide|Agent gateway]]
- [[commands-and-environment]]
- [[architecture-invariants]]
- [[database-and-security]]
- [[feature-package-work]]
- [[best-practices]]
- [[tag-taxonomy|Tag taxonomy and retrieval]]
- [[model-selection/index|Model selection]]

Use the task-specific note or MOC instead of loading every guidance note.

## Retrieval map

- **Feature work:** [[02-prd/index|PRDs]] → [[../04-plans/living-plan|living plan]] → [[feature-package-work]].
- **API, data, or security:** [[database-and-security]] → the relevant [[03-system-design/non-functional/index|non-functional spec]].
- **AI, context, or RAG:** [[03-system-design/functional-design/03-ai/context-assembler|context assembler]] → [[03-system-design/functional-design/01-core-drive/00-tiered-context-model|tiered context model]] → [[03-system-design/non-functional/rag/00-rag|RAG]].
- **Bot, automation, or CLI work:** [[03-system-design/functional-design/02-global-tagging-and-linking/00-global-tags-and-metadata|global metadata]] → [[03-system-design/non-functional/cli/cli|CLI]] → [[03-system-design/functional-design/index|functional design]].
