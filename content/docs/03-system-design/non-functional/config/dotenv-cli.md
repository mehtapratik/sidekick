---
publish: true
id: system-design.non-functional.config.dotenv-cli
title: dotenv CLI
created: 2026-09-19
updated: 2026-11-08
kind: spec
version: 1.1.1
tags:
   - system-design
   - config
   - cli
---

**D37** `decision` #config: Environment variables load through `dotenv-cli`, not Node's `--env-file` flag.

Sidekick to use `dotenv-cli` over Node.js `--env-file` flag to load environment variables.

**Why:**
Node.js blocks the `--env-file` flag when it is passed via `NODE_OPTIONS`. Scripts that set `NODE_OPTIONS=--env-file=.env.local` fail immediately with a security error. This is intentional in Node.js — `NODE_OPTIONS` is an environment variable itself and allowing arbitrary flags via it would be a security risk.

`dotenv-cli` sidesteps this entirely. It loads the `.env.local` file into the process environment before the command runs, without touching `NODE_OPTIONS`.

**Single source of truth:** `.env.local` lives at the repo root only. Never create a `.env.local` inside `apps/app` or any package.

## Decision History

- 2026-09-19 · accepted · dotenv CLI
