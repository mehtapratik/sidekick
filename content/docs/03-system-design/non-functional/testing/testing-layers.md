---
publish: true
id: system-design.non-functional.testing.testing-layers
title: Testing Layers
created: 2026-10-30
updated: 2026-11-08
kind: spec
version: 1.2.1
tags:
   - system-design
   - testing
   - vitest
   - playwright
---

**D60** `decision` #testing: Tests run at four layers, and a behaviour is proven at the cheapest layer that can observe it.

Sidekick tests at four layers. Each answers a different question, and a behaviour is proven at the cheapest layer that can observe it. Many unit tests, the most coverage at integration, a few end-to-end journeys, and visual regression once there is a design system to protect. The tools are in [[03-system-design/non-functional/testing/testing-layers|Vitest]].

## Every layer

A good test checks what a consumer can observe, never how the code does it. It doesn't assert on table layout, SQL or which internal functions were called, so code can be reshaped without rewriting its tests. Each bug fixed gets a regression test at the layer where it showed up.

## 1. Unit

Tests one module or component in isolation; its job is the module's own code paths.

- **Mock only at the boundaries:** the database, the network, the clock, and other packages' I/O. Pure functions need no mocks. Mocking internal functions ties a test to how the code works and breaks it on harmless refactors.
- **How a dependency behaves is that dependency's own test.** A component that renders a renderer's output trusts the renderer's tests.
- **Third-party libraries:** don't test the library; wrap it thinly and test our use of it through the wrapper. Those tests catch a breaking upgrade, which matters because Renovate merges upgrades on its own.
- Components run in Vitest browser mode (a real browser) with Testing Library, and fake the API with MSW.
- Location: `src/**/*.test.ts(x)`, next to the code.

## 2. Integration

Several real pieces working together, without the whole system: the real route handler wrapped in `withApiGuard`, a real Postgres built from the migrations, and only the signed-in caller faked. No browser and no running server.

- **The main seam.** It is fast enough to cover every rule and edge case, and it exercises exactly what bots, agents and Sidekick's own screens use (One Interface). Example: deleting a referenced entity returns `delete_blocked` with the referencer count.
- Location: `tests/integration/`, run inside `tests/with-test-db.sh`. Files use random per-file user ids so they run in parallel against one database.

## 3. End-to-end

The whole app driven like a user: Playwright opens a browser, signs in for real, clicks, and checks what is on screen, through the real Next.js server and database.

- **A handful of critical journeys only,** because these tests are slow and brittle. Example: sign in, link a note to a task, bump the task's version, see the red dot.
- If something can be proven at integration, prove it there instead.

## 4. Visual regression

A screenshot per component state, compared with a committed baseline, so upgrades to the design system, global styles or dependencies can't make components drift unnoticed.

- **Starts with the design system** (`packages/ui`). Phase 3's UI is deliberately unstyled, so screenshots there would only track plain text.
- Baselines are captured and compared in one pinned environment (the CI Linux container), because fonts render differently on each machine.
- Component level with Vitest browser mode's screenshot assertion; page level with Playwright's `toHaveScreenshot` where an end-to-end journey already exists.

## Previewing by eye

A playground page (such as Synergy's, behind the sandbox entitlements) is for looking, not asserting. It is the natural target for end-to-end and visual tests later. A component catalogue (Storybook or Ladle) is added only if one is wanted.

## Test Framework: Vitest

**D59** `decision` #testing: Vitest is the single unit and integration test framework for the whole monorepo.

**What we chose:** Vitest is the single unit and integration test framework for the whole monorepo — every package, `apps/app`, and `apps/cli`, client and server code alike. One API to learn, and one `test` task that Turborepo runs per package, the same way it runs `lint` and `typecheck`.

**Why:**

- TypeScript and ESM work without a separate compiler step. Our packages are `"type": "module"` with `moduleResolution: "bundler"`, and Vitest resolves modules the way Next.js does.
- One framework covers every environment: `node` for packages, server code, and the CLI; `jsdom` (or a real browser) for React and Mantine components.
- Next.js documents a Vitest setup, and the API (`describe`, `it`, `expect`, `vi.fn`) is Jest-compatible, so documentation and examples transfer.

**Not tied to Vite:** Vitest uses Vite's module pipeline only to load files while tests run. It is a dev dependency and builds nothing that ships. The app still builds with Next.js, and packages with `tsc`. Choosing Vitest does not commit Sidekick to Vite as a bundler, and the Jest-compatible API keeps a future migration cheap. Tests may occasionally need configuration that mirrors Next.js behavior, such as an alias.

**Alternatives rejected:**

- **Jest** — predates ESM; TypeScript and ESM need `ts-jest`, SWC, or Babel and ongoing configuration.
- **Node's `node:test`** — no DOM environment, so the web app would need a second framework.
- **Bun test** — runs tests under Bun, not Node, so tests would not match production.

### Layout

- `src/**/*.test.ts` — unit tests next to the code they test; no database, fast.
- `tests/integration/` — tests that need a real database. They run inside `tests/with-test-db.sh`, which builds a throwaway Postgres from the migrations and Supabase stand-ins (`tests/supabase-stub.sql`), then deletes it.
- `tests/stubs/` — test-only stand-ins. For example, `server-only` throws outside Next.js's `react-server` condition, so `vitest.config.ts` aliases it to an empty stub.

### Beyond unit and integration tests

- **End-to-end:** async Server Components and full user flows cannot be rendered by any unit-test runner. Use Playwright when there are flows worth testing that way. This is a separate layer, not a second unit-test framework.
- **Visual regression (planned):** Sidekick will have visual regression tests. The tool is not chosen yet. Candidates to evaluate:
   - Vitest browser mode screenshot assertions — component level, same framework as unit tests.
   - Playwright `toHaveScreenshot` — page level, shared with end-to-end tests.

   Whichever is chosen, baselines must be captured and compared in one pinned environment — same OS, browser version, and fonts, typically CI or a container — or screenshots will differ by machine.

## Why These Layers

### Why

- Integration tests exercise the one interface every consumer uses, and run fast enough to cover every rule. End-to-end tests prove the pieces meet in a real browser but are too slow and brittle to carry the detail.
- Mocking only at boundaries keeps tests about behaviour, so refactors don't break them.
- Vitest is already the test framework; browser mode adds a real browser without a second tool. A component catalogue would duplicate the playground for now.
- Visual baselines are only worth keeping once there is styling to protect.

## Decision History

- 2026-10-14 · accepted · Vitest
- 2026-10-30 · accepted · Testing Layers
