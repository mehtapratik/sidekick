---
publish: false
id: notes.coding-standards
title: Coding standards
created: 2026-10-20
updated: 2026-10-23
kind: notes
version: 1.1.0
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
