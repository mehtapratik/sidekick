---
publish: true
id: decision.technical.testing-layers
created: 2026-10-30
kind: decision
version: 1.0.0
tags:
   - decision
   - technical
   - architecture-decision
   - testing
status: accepted
applies_to:
   - "[[03-system-design/non-functional/testing/testing-layers]]"
   - "[[06-decisions/technical/vitest]]"
---

## What

Sidekick tests at four layers ([[03-system-design/non-functional/testing/testing-layers|Testing layers]]): unit (mock only at the boundaries; wrap and test third-party libraries through our use of them), integration (route handler, guard and real database; the main seam), end-to-end (a few critical journeys with Playwright) and visual regression (from the design system on, in one pinned environment). Components are tested with Vitest browser mode, Testing Library and MSW, not Storybook (Pratik, 2026-10-30).

## Why

- Integration tests exercise the one interface every consumer uses, and run fast enough to cover every rule. End-to-end tests prove the pieces meet in a real browser but are too slow and brittle to carry the detail.
- Mocking only at boundaries keeps tests about behaviour, so refactors don't break them.
- Vitest is already the test framework; browser mode adds a real browser without a second tool. A component catalogue would duplicate the playground for now.
- Visual baselines are only worth keeping once there is styling to protect.
