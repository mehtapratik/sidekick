---
publish: true
id: harness.commands-and-environment
created: 2026-09-19
updated: 2026-10-24
kind: guidance
version: 1.1.0
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
pnpm ops:entitlements:grant --email <email> (--all | --feature <key>…) [--apply]
```

Database commands and `ops:*` scripts require `.env.local` at the repository root. `ops:*` scripts connect as the privileged role, print a plan by default and write only with `--apply`; exit codes are 0 ok, 1 failed, 2 usage error ([[04-plans/phase-2-core-infrastructure-api-guard-feature-system/contracts#Ops|ops conventions]]). Run them from the root: root scripts don't exist inside a package. Package scripts use `dotenv`; do not use Node `--env-file` through `NODE_OPTIONS`.

See [[03-system-design/non-functional/config/dotenv-cli|dotenv CLI]] for the environment contract.
