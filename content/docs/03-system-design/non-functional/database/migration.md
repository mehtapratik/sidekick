---
id: system-design.non-functional.database.migration
created: 2026-09-19
kind: spec
version: 1.0.0
tags:
   - system-design
   - database
   - drizzle
   - pnpm
---

1. Every feature (aka. package) will have its own `schema.ts`, `drizzle.config.js`, and `migration` scripts There is NO global `drizzle-orm` config.
   1. This is to support [[isolation|feature level isolation]] and to support independent feature deployments in future.
2. With help of [[corepack]], `pnpm db:migrate` will orchestrate package (feature) discovery, running migration scripts in right order and failing fast on errors.
3. Having each package own its own database migration config eliminates the issues of schema drift, inconsistent environments, and hidden migration dependencies.
