---
publish: true
id: decision.technical.lexicon-highlighting
created: 2026-10-30
kind: decision
version: 1.0.0
tags:
   - decision
   - technical
   - architecture-decision
   - synergy
   - taxila
status: accepted
applies_to:
   - "[[02-prd/03-features/01-synergy/01.prd.features.synergy.entities]]"
   - "[[03-system-design/non-functional/monorepo/dependency-flow]]"
---

## What

Lexicon highlighting (any feature's editor spots the first use of a term or alias and suggests a `defined-by` link) splits data from mechanism:

- **Data in Taxila.** Taxila owns terms and serves a dictionary through its public API: each term's id, title, aliases and abbreviations.
- **Mechanism in `packages/ui`.** A pure matcher function and a Tiptap extension that, given a dictionary and text, find the first use of each term and show it as a suggestion with ProseMirror decorations. Decorations draw over the text without changing it, so nothing is saved until the user accepts.
- **Accepting** calls the Synergy API: it creates the `defined-by` link and turns the word into an alias mention.
- **The app wires them together** by fetching the dictionary and passing it to the editor. A bot can run the same matcher on the server.

Whether the Lexicon ships in the MVP or after it is decided when Taxila is scoped (Pratik, 2026-10-30). Phase 3 builds nothing for it.

## Why

- Inside Taxila, other features couldn't use it without importing a feature.
- Synergy holds no aliases or definitions, and a platform package can't import a feature to read them.
- A new platform package would own no data or rules of its own. Highlighting given phrases is domain-free mechanism, which is foundation by the [[03-system-design/non-functional/monorepo/dependency-flow|layer rule]].
