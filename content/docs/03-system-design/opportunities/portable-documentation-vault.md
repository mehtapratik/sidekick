---
id: opportunity.portable-documentation-vault
created: 2026-09-19
kind: opportunity
version: 1.0.0
status: proposed
tags:
   - opportunity
   - documentation
   - agentic-coding
   - portability
   - severity-medium
related:
   - "[[08-ai-coding-harness/agent-guide]]"
---

**Problem**

Sidekick's `docs` and agent guidance symlink into a sibling Arkive checkout.

**Risk**

Fresh clones, cloud agents, and CI environments lack the documentation unless repository checkout layout is recreated exactly. Code and specifications can also drift across repositories.

**Recommended fix**

Choose a portable distribution strategy before cloud or CI workflows depend on the vault: a Git submodule, an explicit checkout step, or a generated in-repo agent bundle.
