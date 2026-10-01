---
publish: true
id: system-design.non-functional.monorepo.dependency-flow
created: 2026-09-19
kind: spec
version: 1.0.0
tags:
   - system-design
   - monorepo
   - cli
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
