---
title: Portable documentation vault
deck: ''
created: '2026-09-19'
updated: '2026-09-27'
kind: opportunity
status: draft
version: 1.0.0
tags:
  - opportunity
  - documentation
  - agentic-coding
  - portability
  - severity-medium
appliesTo: []
isSection: false
docId: opportunity.portable-documentation-vault
sourcePath: sources/docs/03-system-design/opportunities/portable-documentation-vault.md
wordCount: 67
readingMinutes: 1
author: Pratik Mehta
license: CC BY-NC 4.0
description: ''
---

**Problem**

Sidekick's `docs` and agent guidance symlink into a sibling Arkive checkout.

**Risk**

Fresh clones, cloud agents, and CI environments lack the documentation unless repository checkout layout is recreated exactly. Code and specifications can also drift across repositories.

**Recommended fix**

Choose a portable distribution strategy before cloud or CI workflows depend on the vault: a Git submodule, an explicit checkout step, or a generated in-repo agent bundle.
