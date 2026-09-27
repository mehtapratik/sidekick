---
title: Instrumentation
deck: ''
created: '2026-09-19'
updated: '2026-09-27'
kind: spec
status: draft
version: 1.0.0
tags:
  - system-design
  - observability
  - vercel
  - embeddings
appliesTo: []
isSection: false
docId: system-design.non-functional.observability.instrumentation
sourcePath: sources/docs/03-system-design/non-functional/observability/instrumentation.md
wordCount: 155
readingMinutes: 1
author: Pratik Mehta
license: CC BY-NC 4.0
description: ''
---

## MVP: `console.*` via Vercel dashboard

Primitive but sufficient for a single-developer MVP. Vercel streams function logs to a dashboard in real time. `console.error`, `console.warn`, and `console.log` are visible there.

Log structured objects rather than concatenated strings:

```ts
// Prefer this
console.error("Embedding failed", { noteId, userId, error: err.message });

// Over this
console.error("Embedding failed for note " + noteId + ": " + err.message);
```

Structured logs are easier to filter and grep, and will migrate cleanly to a proper logging service later.

## Post-MVP: Sentry or equivalent

After MVP ships, integrate a structured error tracking service (Sentry is the most common). Benefits over `console.*`:

- Error deduplication (one alert for 1000 identical errors, not 1000 alerts)
- Stack trace capture with source maps
- User context attached to errors
- Alert routing and on-call integrations
- Performance monitoring
  The transition from `console.*` to Sentry is low-friction — it's an additive change, not a rewrite.
