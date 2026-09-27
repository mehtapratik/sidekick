---
id: system-design.non-functional.nextjs.use-navigation-hook
created: 2026-09-19
kind: spec
version: 1.0.0
tags:
   - system-design
   - nextjs
---

Always use `useNavigation()` instead of calling `router.push()` alone to ensure it is always followed by `router.refresh()` to prevent stale UI state.
