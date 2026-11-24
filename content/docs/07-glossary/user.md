---
publish: false
id: glossary.user
title: User
created: 2026-11-24
updated: 2026-11-24
kind: glossary
version: 0.1.0
tags:
   - glossary
   - security
---

The account that owns the data. Every request works on behalf of exactly one user: `user_id` on every row, the user row-level security compares, the user `withRLS(userId)` sets and the per-user lock is keyed on.

Not whoever sends the request or makes the write. A person, an agent, an API key or the system can all work for the same user; each is an [[actor]], and a request proves who it is as a [[caller]]. "End user" adds nothing and isn't used (Pratik, 2026-11-24, Synergy lesson 5).
