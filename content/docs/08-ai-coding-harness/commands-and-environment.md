---
publish: true
id: harness.commands-and-environment
title: Commands and Environment
created: 2026-09-19
updated: 2026-11-11
kind: guidance
version: 1.2.0
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

`test:integration` runs `scripts/test-db/with-test-db.sh`: it builds one throwaway PostgreSQL 17, runs every package's migrations through `turbo run db:migrate`, then runs each package's `test:integration` against it. It needs the PostgreSQL 17 tools installed locally and is never cached. Run one package's suite with `pnpm test:integration --filter=<package>`.

Database commands and `ops:*` scripts require `.env.local` at the repository root. Only the root `db:*` scripts load it; Turbo runs in strict env mode, so `turbo.json` passes `DATABASE_DIRECT_URL` through to `db:migrate` and `db:generate` and to no other task. Package `db:*` scripts are plain `drizzle-kit` and read no env file, so the test script's throwaway URL can never fall back to dev. `db:migrate` runs packages in dependency order (`dependsOn: ["^db:migrate"]`). Generate one package's migration with `pnpm db:generate --filter=<package> -- --custom --name=<name>`. `ops:*` scripts connect as the privileged role, print a plan by default and write only with `--apply`; exit codes are 0 ok, 1 failed, 2 usage error ([[04-phases/02-gatekeeper/01-contracts#Ops|ops conventions]]). Run them from the root: root scripts don't exist inside a package. Scripts that need the env file use `dotenv`; do not use Node `--env-file` through `NODE_OPTIONS`.

See [[03-system-design/non-functional/config/dotenv-cli|dotenv CLI]] for the environment contract.
