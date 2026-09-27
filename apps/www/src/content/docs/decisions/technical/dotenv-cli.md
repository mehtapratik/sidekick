---
title: dotenv CLI
deck: ''
created: '2026-09-19'
updated: '2026-09-27'
kind: decision
status: approved
version: 1.0.0
tags:
  - decisions
  - technical
  - architecture-decision
  - cli
appliesTo:
  - 03-system-design/non-functional/config/dotenv-cli
isSection: false
docId: decision.technical.dotenv-cli
sourcePath: sources/docs/06-decisions/technical/dotenv-cli.md
wordCount: 97
readingMinutes: 1
author: Pratik Mehta
license: CC BY-NC 4.0
description: ''
---

Sidekick to use `dotenv-cli` over Node.js `--env-file` flag to load environment variables.

**Why:**
Node.js blocks the `--env-file` flag when it is passed via `NODE_OPTIONS`. Scripts that set `NODE_OPTIONS=--env-file=.env.local` fail immediately with a security error. This is intentional in Node.js — `NODE_OPTIONS` is an environment variable itself and allowing arbitrary flags via it would be a security risk.

`dotenv-cli` sidesteps this entirely. It loads the `.env.local` file into the process environment before the command runs, without touching `NODE_OPTIONS`.

**Single source of truth:** `.env.local` lives at the repo root only. Never create a `.env.local` inside `apps/web` or any package.
