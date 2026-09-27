---
title: Dependency flow
deck: ''
created: '2026-09-19'
updated: '2026-09-27'
kind: spec
status: draft
version: 1.0.0
tags:
  - system-design
  - monorepo
  - cli
appliesTo: []
isSection: false
docId: system-design.non-functional.monorepo.dependency-flow
sourcePath: sources/docs/03-system-design/non-functional/monorepo/dependency-flow.md
wordCount: 95
readingMinutes: 1
author: Pratik Mehta
license: CC BY-NC 4.0
description: ''
---

- Between `apps/*` and `packages/*`, dependency always flow in one direction `packages/*` artifacts can be imported in `app/*` artifact; never the other way around.
- Allowed dependency flow:

```markdown
apps/* -> packages/features/* -> packages/core
```

**Open questions:** Should we enforce the following dependency flows?

1. Use folder-level depth to reflect dependency boundaries (e.g., packages `foo` and `bar` cannot depend on each other, but both can depend on `packages/globals/core`. Similarly, `apps/web` and `apps/cli` cannot reference each other).
2. Move features into a dedicated `packages/features/` folder.
3. House `features-registry` inside the `packages/` folder solely as a registry.
