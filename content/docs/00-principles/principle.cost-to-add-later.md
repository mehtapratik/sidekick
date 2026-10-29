---
id: principle.cost-to-add-later
title: Cost to Add Later
created: 2026-10-29
kind: guidance
version: 1.0.0
tags:
   - principle
   - product
   - engineering
publish: true
---

Every MVP is a bet on what can wait. Most teams draw the line by layer: backend now, polish later, or the reverse. That line is in the wrong place. Some backend work is cheap to add next year, and some frontend work becomes a rewrite if it waits.

Sidekick draws the line by asking one question of every item: what does it cost to add later? If the answer is "a new endpoint" or "a stylesheet", it waits. If the answer is "a data migration across every user's records" or "changing every caller of a shared component", it ships now, even when nothing uses it yet.

So an MVP can look primitive. Plain text, no icons, no hover cards. Its foundations can't be. The data model carries every field the vision needs, the history that can't be reconstructed is recorded from the first write, and the contracts other code builds on are shaped for where they're going, not only where they start.

This principle has a limit. A foundation earns its place by a planned, near-term use. Building ahead for a future nobody has committed to is just a slower way to guess.
