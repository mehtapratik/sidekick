---
publish: true
id: system-design.non-functional.monorepo.env-vars-in-turbo-json
title: Env Vars in Turbo JSON
created: 2026-09-19
updated: 2026-11-01
kind: spec
version: 1.1.0
tags:
   - system-design
   - monorepo
   - turborepo
   - vercel
---

List all environment variables as `env` array of the `build` task of `turbo.json`.

[[turborepo]] caches builds by hashing source files. Without declaring environment variables, Turbo has no way to know that a change to `NEXT_PUBLIC_APP_URL` should invalidate the cached build. Declaring variables in `env` includes their values in the cache hash. If a value changes, the cache is invalidated and the app.

[[03-system-design/non-functional/monorepo/vercel]]'s build system reads `turbo.json` and warns if environment variables are configured in the Vercel dashboard but not declared in `turbo.json`.

## Decision History

- 2026-09-19 · accepted · Env Vars in Turbo JSON
