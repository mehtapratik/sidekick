---
publish: true
id: prd.synergy.ticket-03
title: "What makes two tags the same"
created: 2026-10-25
kind: plan
type: grilling
blocked_by: []
status: deprecated
assignee: mehtapratik
tags:
   - prd
   - synergy
   - wayfinder
---

> **Retired 2026-10-29.** The outcome lives in the [[02-prd/03-features/01-synergy/00.prd.features.synergy.overview|Synergy PRD]] and [[02-prd/03-features/01-synergy/spec|spec]]. This page stays as the record of how it was decided.

## Question

How tags are identified: whether case matters, how a tag is renamed or merged into another, and whether `key:value` keys nest (`domain:finance:spending`).

## Resolution

Decided 2026-10-27.

- **Spelling:** a tag is lowercase ASCII letters, digits and dashes, plus one `:` between key and value (`domain:spending`). Input is lowercased automatically; any other character is rejected with a hint, never silently converted. The stored form is the only form, so there is no separate display spelling.
- **What a tag is:** a record of its own, per user (id, name, optional description). It isn't an entity in the index: no versions, no lifecycle.
- **Rename:** changes the tag everywhere at once, because entities point at its id.
- **Deprecate:** existing uses stay, new uses are refused (decided with ticket 04).
- **Merge:** moves every application of one tag to another and keeps the old name as an alias that suggests the new one.
- **Nesting:** none. One key, one value. Hierarchy stays in the fog.
- **Keys:** free, with autocomplete from keys already in use. Sidekick ships the keys its own modules rely on (`domain`, `situation`, Core Drive's applicability keys).
- **AI tags:** wait as suggestions for the user's approval by default; a setting lets the user auto-accept them.
