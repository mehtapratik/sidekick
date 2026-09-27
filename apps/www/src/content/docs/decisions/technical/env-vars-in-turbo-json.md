---
title: Env vars in turbo JSON
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
  - turborepo
  - vercel
appliesTo:
  - 03-system-design/non-functional/monorepo/env-vars-in-turbo-json
isSection: false
docId: decision.technical.env-vars-in-turbo-json
sourcePath: sources/docs/06-decisions/technical/env-vars-in-turbo-json.md
wordCount: 83
readingMinutes: 1
author: Pratik Mehta
license: CC BY-NC 4.0
description: ''
---

List all environment variables as `env` array of the `build` task of `turbo.json`.

[[turborepo]] caches builds by hashing source files. Without declaring environment variables, Turbo has no way to know that a change to `NEXT_PUBLIC_APP_URL` should invalidate the cached build. Declaring variables in `env` includes their values in the cache hash. If a value changes, the cache is invalidated and the app.

[[03-system-design/non-functional/monorepo/vercel]]'s build system reads `turbo.json` and warns if environment variables are configured in the Vercel dashboard but not declared in `turbo.json`.
