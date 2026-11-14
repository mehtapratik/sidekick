---
publish: false
id: glossary.kind
title: Kind
created: 2026-11-14
updated: 2026-11-14
kind: glossary
version: 0.1.0
tags:
   - glossary
   - synergy
---

A small, fixed set of values built into the code, where each value changes behaviour: a relation type's kind (reference or association), the three kinds of [[mention]], an actor's kind (`human`, `system`, `agent`, `api_key`). Stored as a key in a `text` column with a CHECK ([[D266]]).

Not a **type**, which is an open vocabulary that is registered or stored as rows and can grow without a code change: an entity's type (`note`, registered by its [[provider]]), a relation type (`cites`). A type gets no CHECK; the code that owns its registry validates it (Pratik asked which word to use, 2026-11-12).
