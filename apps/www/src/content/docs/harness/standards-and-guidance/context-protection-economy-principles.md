---
title: Context protection economy principles
deck: ''
created: '2026-09-23'
updated: '2026-09-27'
kind: spec
status: draft
version: 1.0.0
tags: []
appliesTo: []
isSection: false
docId: >-
  08-ai-coding-harness-standards-and-guidance-context-protection-economy-principles
sourcePath: >-
  sources/docs/08-ai-coding-harness/standards-and-guidance/context-protection-economy-principles.md
wordCount: 81
readingMinutes: 1
author: Pratik Mehta
license: CC BY-NC 4.0
description: ''
---

https://github.com/cursor/plugins/blob/main/pstack/skills/principle-foundational-thinking/SKILL.md

Some ideas:
- Offload easy tasks to cost effective models such as fetching Figma frames, monitoring CI, or running quality gates before creating PR.
- What if we invert the rule? Start with lowest capability model and offload to higher capability model when situation demands. 
- Save state by caching repeated lookups locally and then pushing HEAD query to check if cache is invalidated. e.g. Name and email of PR reviewers for a all PR raised for specific projects. 
-
