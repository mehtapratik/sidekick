---
publish: false
id: glossary.relationship
created: 2026-10-25
kind: glossary
version: 0.1.0
tags:
   - glossary
   - synergy
---

A stored connection from one entity to another. It carries a free-text label that says what the target answers from this source ("Why am I feeling this way?"), an optional relation type, and its own tags. The same two entities can share several relationships with different labels. A reference is a relationship whose type says the source depends on the target, so it records the target's version and goes stale when the target moves on.
