---
publish: true
id: harness.commands-and-environment
title: Commands and Environment
created: 2026-09-19
updated: 2026-11-03
kind: guidance
version: 1.1.1
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
pnpm test
pnpm test:integration
pnpm db:generate
pnpm db:migrate
pnpm ops:entitlements:grant --email <email> (--all | --feature <key>…) [--apply]
```

`test:integration` runs the RLS proof on a throwaway PostgreSQL 17 and needs its tools installed locally; it is never cached. Database commands and `ops:*` scripts require `.env.local` at the repository root. `ops:*` scripts connect as the privileged role, print a plan by default and write only with `--apply`; exit codes are 0 ok, 1 failed, 2 usage error ([[04-phases/02-gatekeeper/01-contracts#Ops|ops conventions]]). Run them from the root: root scripts don't exist inside a package. Package scripts use `dotenv`; do not use Node `--env-file` through `NODE_OPTIONS`.

See [[03-system-design/non-functional/config/dotenv-cli|dotenv CLI]] for the environment contract.
