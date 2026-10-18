---
publish: true
id: plan.phase-2.task-2-1
title: "Lesson 2 (task 2.1): resolveApiCaller"
created: 2026-10-18
updated: 2026-10-18
kind: plan
version: 2.0.0
tags:
   - plan
   - phase-2
   - task
   - api-guard
   - authentication
   - supabase
   - nextjs
status: planned
---

> **Lesson 2 of 8.** Before this: [[task-2-6and2-7|lesson 1]]. Next: [[task-2-8and2-9|lesson 3]]. The coach follows [[contracts#Coaching rules|the coaching rules]]. The answer key is [[contracts#Caller|Caller]].

**What Pratik builds:** `resolveApiCaller(req)` in `packages/core/src/api/auth.ts`. It answers "who is calling?" for every API request.

**Concepts:** cookie sessions vs. Bearer tokens, how Supabase reads a session from cookies on the server, discriminated unions, failing closed, and mocking a module in Vitest.

**Coach reads first:** [[contracts]], [[authentication]], `packages/core/src/supabase/server.ts`, `apps/web/src/proxy.ts`.

## Steps

1. **The problem.** The coach explains that the proxy deliberately skips `/api`, so API routes must authenticate themselves. Pratik reads `proxy.ts` and finds the line that skips them.
2. **Design the return type.** Ask: "What does the guard need to know about a caller? What should it get when nobody is signed in?" Pratik writes `ApiCaller`. Then introduce discriminated unions (`kind`) if Pratik hasn't reached for them, and say why an `apiKey` variant exists before Phase 9.
3. **Session path.** Pratik writes the function using `createServerClient()` and `supabase.auth.getUser()`. Teach why `getUser()` is used, not `getSession()`, and why a thrown env-var error should stay loud ([[error-handling]]).
4. **Bearer path.** Ask: "Phase 9 hasn't built API keys yet. What's the safe answer for a Bearer header today?" Pratik implements "always no caller" and adds a comment pointing at task 9.4.
5. **`server-only`.** Ask Pratik to predict what `import 'server-only'` protects against, then add it.
6. **Test it.** Pratik writes `src/api/auth.test.ts` with `vi.mock('../supabase/server')`. The cases are: a session user, no user, an Auth error, a Bearer header, and a Bearer header plus a session. Then Pratik breaks the Bearer check on purpose and watches a test fail.
7. **Verify and ship.** Pratik runs the CI-equivalent checks, then commits and opens the PR.

## Check understanding

- Why does a Bearer header beat a valid cookie, instead of falling back to it?
- What would go wrong if `resolveApiCaller` returned `{ userId: undefined }` instead of `null`?
- What does `vi.mock` replace, and when does that happen?

**Done when:** Pratik's PR is green, and they can answer the questions above.

**Out of scope:** the `api_keys` table, any key lookup, and proxy changes.
