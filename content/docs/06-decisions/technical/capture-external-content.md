---
publish: true
id: decision.technical.capture-external-content
created: 2026-10-30
kind: decision
updated: 2026-10-31
version: 1.1.0
tags:
   - decision
   - technical
   - architecture-decision
   - synergy
   - taxila
status: accepted
applies_to:
   - "[[02-prd/03-features/01-synergy/04.prd.features.synergy.keeping-links-true]]"
   - "[[06-decisions/technical/platform-layer]]"
---

## What

Synergy versions only content that Sidekick holds. A provider of external content (a tweet, a blog post, a news article, a PDF, a Word document) captures a copy into its own tables or file storage when the user saves it. From then on the item is an ordinary entity, and every Synergy rule applies to it unchanged.

- **One row per saved item.** The provider's table (for example `taxila.external_items`) shares the entity's id with the entity index, one to one. A unique key on (user, source, external id), partial on live rows (`WHERE deleted_at IS NULL`), stops the same item being saved twice and still lets it be saved again after a delete. Linking it from many documents adds relationships, not rows.
- **The index stays thin.** The URL and external id live in the provider's table, not on the index row; nothing that crosses modules needs them. Identity differs by source (tweet id, DOI, ISBN, URL), so the provider models it. A cross-module lookup by URL can be added later as a nullable column backfilled from the providers' tables.
- **Change detection compares captured text.** Pages change for reasons that aren't content (ads, timestamps), so the provider compares extracted text, not raw bytes. A file the user uploaded has no remote source and is never refreshed.
- **Refresh and Detect are user actions.** A link to external content carries Refresh (fetch the source and compare) and, from the AI layer in Phase 6, Detect (AI advice on whether the new content still says what the user relied on). The user decides: keep the old copy, accept the new text as a revision, or accept it as a new version with a change note. A hash can't tell a revision from a version, so no resolver ever decides.
- **Deleted at source.** The copy stays and the entity stays active. The provider marks it gone at source, and the card says so. The user may deprecate it.

## Why

- A link must keep showing what its source relied on. Live content can change or vanish without Sidekick knowing, and nothing would record what was cited.
- Watching the source on read would make reads write to the index, call the source on every render, and still miss inline links, search and staleness queries, which read only the index.
- A source deletion would otherwise contradict the rule that a referenced entity can't be deleted.

## Consequences

- No special statuses or columns in Synergy for external content. Phase 3 builds nothing for it.
- The provider (Taxila, from Phase 4) owns capture, extraction, file storage and the Refresh action. Detect arrives with the AI layer.
