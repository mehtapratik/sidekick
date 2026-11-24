---
publish: false
id: glossary.actor
title: Actor
created: 2026-11-24
updated: 2026-11-24
kind: glossary
version: 0.1.0
tags:
   - glossary
   - synergy
---

Who made a write on a [[user]]'s behalf: a `human` (a person), an `agent`, an `api_key` or the `system`. One of four actor [[kind|kinds]], stored with the actor's id (none for the system) in each row's provenance columns, `actor_kind` and `actor_id`, and in each outbox event. `toActorColumns(actor)` in Synergy's repository turns an `Actor` into those columns.

A nightly agent tidying your notes: the user is you, the actor is the agent (Pratik, 2026-11-24, Synergy lesson 5).
