# Decision — `packages/copy` for Centralized String Copy

---

## What

All user-visible strings (labels, error messages, button text, page titles, navigation items, etc.) live in `packages/copy`. Source files never contain hardcoded strings.

```ts
import { copy } from '@sidekick/copy'

// Use
<Button>{copy.auth.signIn}</Button>
<p>{copy.errors.genericFailure}</p>
```

---

## Why

**Consistency across apps.** `apps/web` and `apps/cli` both display messages to users. Without a shared source of truth, the same concept gets worded differently in each app and drifts over time.

**One-place copy changes.** Fixing a typo, rewording a label, or updating a call-to-action means editing one file. Without `packages/copy`, you would need to grep across the entire codebase and hope you found every instance.

**Type safety.** The copy object is defined with TypeScript `as const`. This means:
- Autocomplete shows available keys as you type
- Referencing a key that doesn't exist is a compile-time error, not a runtime `undefined`
- Renaming a key is a rename refactor, not a search-and-replace

**Quicker iteration.** Non-technical collaborators can review or contribute copy by editing a single file without reading component code.

---

## How

`packages/copy` exports a `copy` object structured by domain:

```ts
export const copy = {
  auth: {
    signIn: 'Sign in',
    signUp: 'Create account',
    signOut: 'Sign out',
    // ...
  },
  nav: {
    dashboard: 'Dashboard',
    notes: 'Notes',
    // ...
  },
  errors: {
    genericFailure: 'Something went wrong. Please try again.',
    // ...
  },
} as const
```

Import via the workspace package name:

```ts
import { copy } from '@sidekick/copy'
```

---

## Rules

- Never hardcode a user-visible string in a source file. Always import from `packages/copy`.
- Strings that are purely structural (HTML, CSS class names, internal identifiers) are not "copy" and do not need to live here.
- Technical error messages logged to the server console (not shown to users) are not copy.
