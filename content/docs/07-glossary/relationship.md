---
publish: false
id: glossary.relationship
created: 2026-10-25
updated: 2026-10-30
kind: glossary
version: 0.2.0
tags:
   - glossary
   - synergy
---

A **link**: the stored connection from a source entity to a target, or to several ordered targets (a [[list-relationship|list link]]). It carries an optional label that says what the target answers from the source ("Why am I feeling this way?"), an optional type and its own tags. Its type makes it a **reference** (the source relies on the target: it records the target's version and revision, goes stale when the target moves on, blocks the target's delete and protects a referenced [[passage]]) or an **association** (it only connects). An untyped link is a reference. A link can point at a whole entity or at a passage. The same two entities can share several links with different labels. A link lives while its source [[mention|mentions]] it.
