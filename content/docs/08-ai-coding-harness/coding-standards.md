---
publish: false
id: notes.coding-standards
title: Coding Standards
created: 2026-10-20
updated: 2026-11-14
kind: notes
version: 1.3.0
tags:
   - guidance
   - typescript
---

1. Prefer `undefined` over `null` for typing since not assigning value in JavaScript already defaults to `undefined`, leading to a convention that aligns with JavaScript’s default behavior.
2. Write declarative code
3. Code for today’s needs not for tomorrow’s anticipation.
4. Rely on explicitly typing for exported members only. Internal functions, variables, etc can rely on implicit typing based on what it does and stores.
5. Which source to trust vs which source to filter and validate thoroughly?
6. Name variables and exports by their full qualifier, so the name says what a thing is wherever it's read: `MOCK_SESSION_CALLER` (even inside `mocks.ts`), `createMockHttpRequest`, `mockHandler`, `consoleErrorSpy`, `testAdminDb`.
7. Variables and functions use camelCase, as CSS class names do. SCREAMING_SNAKE_CASE is only for configuration constants read from the environment or fixed at module level, such as `DATABASE_URL` or `MOCK_SESSION_CALLER` (Pratik, 2026-11-11).
8. Name a type by its layer (Pratik, 2026-11-14). A database row is `<Table>Row` (`EntityIndexRow`, a Drizzle `InferSelectModel`); the contract that crosses a package or API boundary keeps the plain noun (`Entity`, inferred from its zod schema in `/contracts`); a component's props are `<Component>Props`. A small mapper turns a row into its contract, so a column rename never reaches the UI.
9. Name an inferred type as an interface (`export interface EntityIndexRow extends InferSelectModel<typeof entityIndex> {}`), so editors show its name instead of every field (Pratik, 2026-11-14). Lint allows an empty interface that extends exactly one type.
