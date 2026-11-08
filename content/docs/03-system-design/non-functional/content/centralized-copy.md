---
publish: true
id: system-design.non-functional.content.centralized-copy
title: Centralized Copy
created: 2026-09-19
updated: 2026-11-08
kind: spec
version: 1.2.1
tags:
   - system-design
   - content
---

**D36** `decision` #copy: All user-visible strings live in `packages/copy`; source files never hardcode them.

> [!note] Being replaced
> [[03-system-design/non-functional/content/internationalization|Internationalization]] (D243) supersedes this decision: strings move into ICU catalogs colocated with each package, with shared words in `@sidekick/i18n`, and `packages/copy` is deleted in lesson I1. Until I1 lands, this page describes the code.

All user-visible strings such as labels, error messages, button text, and page titles live in `packages/copy`. Source files never contain hardcoded strings.

```ts
import { copy } from '@sidekick/copy'

// Use
<Button>{copy.auth.signIn}</Button>
<p>{copy.errors.genericFailure}</p>
```

## Why

\> **Consistency across apps.** `apps/app` and `apps/cli` both display messages to users. Without a shared source of truth, the same concept gets worded differently in each app and drifts over time.

\> **One-place copy changes.** Fixing a typo, rewording a label, or updating a call-to-action means editing one file. Without `packages/copy`, you would need to grep across the entire codebase and hope you found every instance.

\> **Type safety.** The copy object is defined with TypeScript `as const`. This means:

- Autocomplete shows available keys as you type
- Referencing a key that doesn't exist is a compile-time error, not a runtime `undefined`
- Renaming a key is a rename refactor, not a search-and-replace

\> **Quicker iteration.** Non-technical collaborators can review or contribute copy by editing a single file without reading component code.

## Decision History

- 2026-09-19 · accepted · Centralized Copy
- 2026-11-05 · superseded · by [[03-system-design/non-functional/content/internationalization|Internationalization]] (D243), effective when lesson I1 lands
