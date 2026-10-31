---
publish: true
id: system-design.non-functional.testing.testing-layers
created: 2026-10-30
kind: spec
version: 1.0.0
tags:
   - system-design
   - testing
   - vitest
   - playwright
---

Sidekick tests at four layers. Each answers a different question, and a behaviour is proven at the cheapest layer that can observe it. Many unit tests, the most coverage at integration, a few end-to-end journeys, and visual regression once there is a design system to protect. The tools are in [[06-decisions/technical/vitest|Vitest]].

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

A playground page (such as Synergy's, behind the `sandbox` entitlement) is for looking, not asserting. It is the natural target for end-to-end and visual tests later. A component catalogue (Storybook or Ladle) is added only if one is wanted.
