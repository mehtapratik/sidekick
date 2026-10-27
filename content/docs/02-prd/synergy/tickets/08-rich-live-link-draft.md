---
publish: true
id: prd.synergy.ticket-08
title: "Rich Live Link draft"
created: 2026-10-25
kind: plan
type: prototype
blocked_by: [05]
status: closed
assignee: mehtapratik
tags:
   - prd
   - synergy
   - wayfinder
---

## Question

A rough Rich Live Link with its three display types (inline, card, live preview): what each shows, what it asks a resolver for, and how a stale, deprecated or superseded target looks in each.

## Prototype

Throwaway page, kept outside this repo as a private Artifact (https://claude.ai/artifact/HvJ3qPJcpcmhuCfu9UCN3E). One relationship (04 → 07, "Am I lying to myself?") rendered inline, as a card and as a live preview, across eight target states: fresh, edited, changed, deprecated, superseded, deleted, locked, redacted. It shows what core decides from the index alone and what it asks the module's resolver for.

## Round 1 answers (2026-10-27)

- Inline, MVP: `{type} - {title} [status]`, a plain link with no hover popup. The format will change as we learn.
- The author picks the display type per link, default inline. Readers can't change it.
- Only the source's author acts on a stale link (still holds, point to the new entry, unlink). Readers see the mark and the change note. Post-MVP, readers can report a broken or obsolete source to its owner (and maybe a moderator; undecided).
- A changed target's live preview shows current content with a note. "As linked" views come later, with diffs.
- Previews don't nest: links inside a preview render inline (depth 1).
- An entity has exactly one status. Edits and changes are not statuses; they show as a superscript mark after the title: `*` = edited since linked (revision moved), `#` = changed since linked (version moved).
- Inline needs no resolver call: type, title and status all come from the index. Card and live preview call the resolver.

## Resolution (2026-10-27)

- A link's label is optional. The author who made the link decides.
- **Labeled link:** always inline, showing only the label: `{type} - {label} [{status}]{*|#}`. No card or preview.
- **Unlabeled link:** the author picks inline (default), card or live preview. Inline reads `{type} - {title} [{status}]{*|#}`.
- One status per entity. The dirty mark follows the status: `*` = edited since linked (revision moved), `#` = changed since linked (version moved).
- MVP has no hover popups. Inline needs no resolver call, because type, title and status all come from the index. Card and live preview call the module's resolver. Core never calls the resolver for deleted, locked or redacted targets.
- Only the source's author acts on a stale link. Post-MVP, readers can report a broken or obsolete source to its owner (and maybe a moderator).
- A changed target's live preview shows current content with the change note. Previews don't nest (depth 1).

**Amended by ticket 11 (2026-10-27):** a labeled link is a fourth display type, **minimal**. It shows only the author's label: no type, no status, no `*`/`#`. A superscript dot marks a state that needs attention. Hovering to see the details is post-MVP. Unlabeled inline keeps `{type} - {title} [{status}]{*|#}`.
