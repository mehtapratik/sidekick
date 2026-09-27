---
id: decision.technical.env-vars-in-turbo-json
created: 2026-09-19
kind: decision
version: 1.0.0
tags:
   - decisions
   - technical
   - architecture-decision
   - turborepo
   - vercel
applies_to:
   - "[[03-system-design/non-functional/monorepo/env-vars-in-turbo-json]]"
status: accepted
---

List all environment variables as `env` array of the `build` task of `turbo.json`.

[[turborepo]] caches builds by hashing source files. Without declaring environment variables, Turbo has no way to know that a change to `NEXT_PUBLIC_APP_URL` should invalidate the cached build. Declaring variables in `env` includes their values in the cache hash. If a value changes, the cache is invalidated and the app.

[[03-system-design/non-functional/monorepo/vercel]]'s build system reads `turbo.json` and warns if environment variables are configured in the Vercel dashboard but not declared in `turbo.json`.
