---
publish: true
id: decision.technical.vitest
created: 2026-10-14
updated: 2026-10-14
kind: decision
version: 1.0.0
tags:
   - decision
   - technical
   - architecture-decision
   - testing
   - vitest
   - monorepo
status: accepted
---

**What we chose:** Vitest is the single unit and integration test framework for the whole monorepo — every package, `apps/web`, and `apps/cli`, client and server code alike. One API to learn, and one `test` task that Turborepo runs per package, the same way it runs `lint` and `typecheck`.

**Why:**

- TypeScript and ESM work without a separate compiler step. Our packages are `"type": "module"` with `moduleResolution: "bundler"`, and Vitest resolves modules the way Next.js does.
- One framework covers every environment: `node` for packages, server code, and the CLI; `jsdom` (or a real browser) for React and Mantine components.
- Next.js documents a Vitest setup, and the API (`describe`, `it`, `expect`, `vi.fn`) is Jest-compatible, so documentation and examples transfer.

**Not tied to Vite:** Vitest uses Vite's module pipeline only to load files while tests run. It is a dev dependency and builds nothing that ships. The app still builds with Next.js, and packages with `tsc`. Choosing Vitest does not commit Sidekick to Vite as a bundler, and the Jest-compatible API keeps a future migration cheap. Tests may occasionally need configuration that mirrors Next.js behavior, such as an alias.

**Alternatives rejected:**

- **Jest** — predates ESM; TypeScript and ESM need `ts-jest`, SWC, or Babel and ongoing configuration.
- **Node's `node:test`** — no DOM environment, so the web app would need a second framework.
- **Bun test** — runs tests under Bun, not Node, so tests would not match production.

## Layout

- `src/**/*.test.ts` — unit tests next to the code they test; no database, fast.
- `tests/integration/` — tests that need a real database. They run inside `tests/with-test-db.sh`, which builds a throwaway Postgres from the migrations and Supabase stand-ins (`tests/supabase-stub.sql`), then deletes it.
- `tests/stubs/` — test-only stand-ins. For example, `server-only` throws outside Next.js's `react-server` condition, so `vitest.config.ts` aliases it to an empty stub.

## Beyond unit and integration tests

- **End-to-end:** async Server Components and full user flows cannot be rendered by any unit-test runner. Use Playwright when there are flows worth testing that way. This is a separate layer, not a second unit-test framework.
- **Visual regression (planned):** Sidekick will have visual regression tests. The tool is not chosen yet. Candidates to evaluate:
   - Vitest browser mode screenshot assertions — component level, same framework as unit tests.
   - Playwright `toHaveScreenshot` — page level, shared with end-to-end tests.

  Whichever is chosen, baselines must be captured and compared in one pinned environment — same OS, browser version, and fonts, typically CI or a container — or screenshots will differ by machine.
