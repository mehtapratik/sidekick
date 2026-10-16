---
publish: true
id: opportunity.portable-documentation-vault
created: 2026-09-19
updated: 2026-10-16
kind: opportunity
version: 1.1.0
status: resolved
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

**Resolution (2026-10-16)**

Chose the explicit checkout. `pnpm install` runs `scripts/setup-docs.mjs` (root `postinstall`), which clones Arkive next to Sidekick — sparse, `sources/docs` only — when `docs/` does not resolve, so `docs/` and `AGENTS.md` (a symlink into it) work in fresh clones and agent environments. It is idempotent, skipped in CI and on Vercel (nothing there reads `docs/`), and never fails the install.

Docs are deliberately not pinned per commit (no submodule): plans and specs lead the code, so the latest Arkive `main` is the version to read. Version pinning applies to tools that execute code — see [[pin-versions]].
