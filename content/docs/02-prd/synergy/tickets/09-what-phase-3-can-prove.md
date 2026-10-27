---
publish: true
id: prd.synergy.ticket-09
title: "What Phase 3 can prove on its own"
created: 2026-10-25
kind: plan
type: grilling
blocked_by: []
status: closed
assignee: mehtapratik
tags:
   - prd
   - synergy
   - wayfinder
---

## Question

No module registers an entity type until Taxila in Phase 4. What does Phase 3 link and test against: a test-only entity type, an early Taxila datum, or a slimmer exit criterion?

## Resolution (2026-10-27)

- **Mock modules:** Phase 3 tests against two mock entity types in two modules, **note** and **task**. They live in `packages/ops`, are gated by a `sandbox` entitlement granted through the ops script, and retire like other ops code once Taxila and later modules absorb Phase 3. Their note and task renderers stay on as test fixtures for `packages/core`'s contract tests. Real users never hold the entitlement.
- **UI:** the Rich Live Link component is the only UI, and it is feature complete for the MVP: all four display types (inline, card, live preview, minimal) and every state. It works on a provider model. A package registers a renderer for its link type, and the component calls that renderer to get the React children for the content. The component owns the frame: display type, status, `*`/`#`/dot marks, and the locked, redacted and deleted states. Because of this, the component isn't limited to Sidekick entities: an external provider (a Slack thread, say) can render inside it once someone writes that renderer. Storing external links stays Taxila's job.
- Phase 3 ships two renderers, note and task, to prove the model.
- **Exit criteria** are integration tests through the public API only: link with a label and type; a version bump with a change note shows `#`; deprecate and supersede; deleting a referenced target is blocked; cycles are rejected; `key:value` tags work; search finds entities by title and metadata; disabling a module makes its links locked; another user's entities never leak.
- **Search, MVP:** title and metadata (type, status, tags) only, never body text. Body search is post-MVP advanced search. Whether search also uses a provider model (core passes the query to each module, which returns its matches) is for system design.
- **System design:** survey the options for mocking and testing a module in isolation (Storybook, Ladle, Vitest browser mode, Playwright component tests, MSW for the API, and so on).
