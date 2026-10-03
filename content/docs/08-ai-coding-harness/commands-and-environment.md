---
publish: true
id: harness.commands-and-environment
created: 2026-09-19
kind: guidance
version: 1.0.0
tags:
   - ai-coding
   - command
   - environment
   - agent-guidance
   - prettier
   - pnpm
   - cli
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
