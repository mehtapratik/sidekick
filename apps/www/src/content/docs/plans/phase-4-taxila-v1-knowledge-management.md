---
title: Phase 4 Taxila v1 knowledge management
deck: ''
created: '2026-09-19'
updated: '2026-09-27'
kind: plan
status: approved
version: 1.0.0
tags:
  - plan
  - living-plan
  - phase-4
  - taxila
  - api-guard
  - rls
  - drizzle
  - api
  - authentication
appliesTo: []
isSection: false
docId: plan.phase-4-taxila-v1-knowledge-management
sourcePath: sources/docs/04-plans/phase-4-taxila-v1-knowledge-management.md
wordCount: 532
readingMinutes: 3
author: Pratik Mehta
license: CC BY-NC 4.0
description: ''
---

> **Milestone:** The first product module, end-to-end: atomic notes and knowledge sources you can create, enrich with metadata, link, and browse — reached through the command-palette shell. Every future module follows this pattern.
> **Learning payoff:** The complete feature loop: PRD → schema → migration → API → repository → UI. Polymorphic content design. Command-palette UX.
> **Prerequisite:** Write the Taxila PRD in `docs/02-prd/` before starting (new convention).

| #    | Task                                                                                                                                                                             | Complexity | Learning |
| ---- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- | -------- |
| 4.1  | Write Taxila PRD in `docs/02-prd/` — source types, note anatomy, metadata model, MVP cut                                                                                            | 🟡         |          |
| 4.2  | Create `packages/feature-taxila` with its own `package.json`, tsconfig, and Drizzle config                                                                                       | 🟡         | 📦 🗄️    |
| 4.3  | Define `notes` table schema — `id` (client UUID), `userId`, `title`, `content`, `createdAt`, `updatedAt`, `deletedAt`, `embeddingStatus`                                         | 🔴         | 🗄️       |
| 4.4  | Define `knowledge_sources` table — `sourceType: 'link' \| 'captured' \| 'markdown'`, `url`, `content`, same syncable + `embeddingStatus` columns (a bookmark is a `link` source) | 🔴         | 🗄️       |
| 4.5  | Migration: RLS combined pattern + trigger bindings on both tables (template established in Phase 3)                                                                              | 🔴         | 🔐 🗄️    |
| 4.6  | Register `taxila` feature + its entity types (`note`, `knowledge_source`) in `ALL_FEATURES`                                                                                      | 🟢         | 📦       |
| 4.7  | Implement `TaxilaRepository` — `list()`, `getById()`, `create()`, `update()`, `softDelete()` for both entities                                                                   | 🔴         | 🗄️       |
| 4.8  | API routes `/api/taxila/notes` and `/api/taxila/sources` (CRUD, soft-delete only) using `withApiGuard` + `taxila:read`/`taxila:write` scopes                                     | 🔴         | 🧩 🔐    |
| 4.9  | Wire metadata enrichment: tag notes/sources and link related concepts via the Phase 3 graph service                                                                              | 🟡         | 🗄️ 🧩    |
| 4.10 | Build the **command-palette shell** — a single centered command box (Cmd+P style) for navigation and actions; replaces the placeholder sidebar dashboard as the primary surface  | 🔴         | 🧩 🎨    |
| 4.11 | Build Taxila list + detail/edit pages, reachable via the palette                                                                                                                 | 🟡         | 🧩 🎨    |
| 4.12 | "New note" / "new source" flows with client-generated UUIDs; soft-delete with confirmation                                                                                       | 🟡         | 🧩 🎨    |
| 4.13 | Enable the `taxila` feature for your own account via seed script                                                                                                                 | 🟢         |          |
| 4.14 | Manually test the full loop via both palette-driven UI and direct API calls (curl/Postman)                                                                                       | 🟢         |          |

**Phase 4 Exit Criteria:** Notes and knowledge sources can be created, enriched with tags/links, edited, listed, and soft-deleted through the command-palette-driven UI. The API layer enforces auth and feature entitlement. All queries filter `where(isNull(table.deletedAt))`.

**RLS template for all feature tables** (combined pattern from Phase 1.1; bind the shared trigger functions from migration `0003`):

```sql
-- RLS (combined pattern)
ALTER TABLE notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE notes FORCE ROW LEVEL SECURITY;
CREATE POLICY "users_own_rows" ON notes FOR ALL
  USING (user_id::text = current_setting('app.current_user_id', true) AND deleted_at IS NULL)
  WITH CHECK (user_id::text = current_setting('app.current_user_id', true));

-- Trigger bindings (functions already exist from migration 0003)
CREATE TRIGGER no_hard_delete_notes
  BEFORE DELETE ON notes FOR EACH ROW EXECUTE FUNCTION enforce_soft_delete();
CREATE TRIGGER no_update_deleted_notes
  BEFORE UPDATE ON notes FOR EACH ROW EXECUTE FUNCTION block_update_on_deleted();
```

---
