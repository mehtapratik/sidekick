---
title: Commands and environment
deck: ''
created: '2026-09-19'
updated: '2026-09-27'
kind: guidance
status: draft
version: 1.0.0
tags:
  - ai-coding
  - commands
  - environment
  - agent-guidance
  - prettier
  - pnpm
  - cli
appliesTo: []
isSection: false
docId: harness.commands-and-environment
sourcePath: sources/docs/08-ai-coding-harness/commands-and-environment.md
wordCount: 51
readingMinutes: 1
author: Pratik Mehta
license: CC BY-NC 4.0
description: ''
---

Run commands from the Sidekick repository root.

```bash
pnpm dev
pnpm build
pnpm lint
pnpm typecheck
pnpm format
pnpm prettier:check
pnpm db:generate
pnpm db:migrate
```

Database commands require `.env.local` at the repository root. Package scripts use `dotenv`; do not use Node `--env-file` through `NODE_OPTIONS`.

See [[03-system-design/non-functional/config/dotenv-cli|dotenv CLI]] for the environment contract.
