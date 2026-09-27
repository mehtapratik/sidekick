---
title: Phase 6 core drive AI layer alter ego
deck: ''
created: '2026-09-19'
updated: '2026-09-27'
kind: plan
status: approved
version: 1.0.0
tags:
  - plan
  - living-plan
  - phase-6
  - taxila
  - zinsser
  - alter-ego
  - war-room
  - factory
  - core-drive
appliesTo: []
isSection: false
docId: plan.phase-6-core-drive-ai-layer-alter-ego
sourcePath: sources/docs/04-plans/phase-6-core-drive-ai-layer-alter-ego.md
wordCount: 898
readingMinutes: 5
author: Pratik Mehta
license: CC BY-NC 4.0
description: ''
---

> **Milestone:** Sidekick gets its mind. Core Drive holds your principles, values, and mental models; your content is semantically searchable; and Alter Ego — grounded in Core Drive + Taxila — answers as the version of you who sees clearly.
> **Learning payoff:** pgvector, HNSW indexes, semantic chunking, provider-agnostic AI routing, streaming structured responses, RAG pipeline design.
> **Prerequisites:** Write the Core Drive and Alter Ego PRDs in `docs/02-prd/`. The Alter Ego PRD must specify the source-attribution contract (internal vs. web source classes, color coding, footnotes — architecture §5.6).

### 6A — Core Drive (context layer)

| #    | Task                                                                                                                                                                                                                                                         | Complexity | Learning |
| ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------- | -------- |
| 6A.1 | Create `packages/feature-core-drive`; define entry schema with the anatomy from architecture §5.2.2 — `category` (identity/principle/mental-model/heuristic/tool/preference), `directive` (compact injectable form), `weight`, `kernel` flag, `lastLoadedAt` | 🔴         | 📦 🗄️    |
| 6A.2 | Migration, RLS, trigger bindings, feature registry entry + entity type                                                                                                                                                                                       | 🟡         | 🔐 🗄️    |
| 6A.3 | Apply applicability metadata via the global tag service (`#principle`, `#domain:spending`, `#situation:planning`, …)                                                                                                                                         | 🟡         | 🗄️       |
| 6A.4 | Repository + API routes + minimal palette-reachable UI for authoring entries (full prose + directive form)                                                                                                                                                   | 🟡         | 🧩 🎨    |
| 6A.5 | Seed Core Drive from `docs/core-drive/` content — mark universal principles as `kernel`                                                                                                                                                                      | 🟢         |          |

> [!note]
> Core Drive is a separate feature for now and may fold into Taxila later — see architecture §5.2 for the rationale and revisit criteria. Context is loaded via the **tiered model** (§5.2.1): kernel entries injected wholesale under a hard token budget; the rest retrieved by applicability tags. **Domain knowledge belongs in Taxila** — Core Drive entries link to it through the graph service, never store it. Hard boundary: _Core Drive never stores state; War Room/Factory never store values._

### 6B — Provider-agnostic AI foundation

| #     | Task                                                                                                                                                                                                                                                                           | Complexity | Learning |
| ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------- | -------- |
| 6B.1  | Implement the static model router in `packages/core/ai` — config map of task types → provider/model via AI SDK `createProviderRegistry()`                                                                                                                                      | 🔴         | 🤖       |
| 6B.2  | Features request capabilities (`chat`, `classify`, `coach`), never concrete models — enforce via the router's public interface                                                                                                                                                 | 🟡         | 🤖 📦    |
| 6B.2a | Define the AI request contract with `effortLevel` as a first-class parameter — v1: tunes retrieval depth (k); router may later resolve higher effort to more capable models                                                                                                    | 🟡         | 🤖       |
| 6B.2b | Implement **Context Assembler v1** in `packages/core/ai` — input `(feature, taskType, effortLevel)`, output context bundle: kernel entries + top-k Tier 1 by applicability tags/similarity, within token budget. The ONLY way features obtain AI context (architecture §5.2.3) | 🔴         | 🤖 📦    |
| 6B.3  | Enable `pgvector` extension in Supabase                                                                                                                                                                                                                                        | 🟢         | 🤖       |
| 6B.4  | Add `embedding` vector column to `notes`, `knowledge_sources`, `documents`, and Core Drive entries                                                                                                                                                                             | 🟡         | 🤖 🗄️    |
| 6B.5  | Create HNSW indexes on each embedding column                                                                                                                                                                                                                                   | 🔴         | 🤖 🗄️    |
| 6B.6  | Implement `generateEmbedding(text)` in `packages/core/ai/embed.ts` (default: OpenAI `text-embedding-3-small`, routed like any other model)                                                                                                                                     | 🟡         | 🤖       |
| 6B.7  | Implement semantic chunking strategy — split Tiptap JSON → markdown → chunks with overlap                                                                                                                                                                                      | 🔴         | 🤖 ✍️    |
| 6B.8  | Implement async background embedding job with retry (2 retries, exponential backoff) using `waitUntil()`                                                                                                                                                                       | 🔴         | 🤖 🧩    |
| 6B.9  | Wire embedding generation into Taxila/Zinsser create/update routes — non-blocking, sets `embeddingStatus`                                                                                                                                                                      | 🔴         | 🤖 🔐    |
| 6B.10 | Implement `match_content()` PostgreSQL function for vector similarity search                                                                                                                                                                                                   | 🔴         | 🤖 🗄️    |

### 6C — Alter Ego

| #    | Task                                                                                                                                                                            | Complexity | Learning |
| ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- | -------- |
| 6C.1 | Create `packages/feature-alter-ego` with its own schema (`chat_sessions`, `chat_messages`)                                                                                      | 🟡         | 📦 🗄️    |
| 6C.2 | Migration, RLS, feature registry entry                                                                                                                                          | 🟡         |          |
| 6C.3 | Design the **structured response contract** — segments carrying source class (internal vs. web) + footnote citations, streamed                                                  | 🔴         | 🤖 🧩    |
| 6C.4 | Implement `POST /api/alter-ego/chat` streaming route — context via the Context Assembler, model via the router                                                                  | 🔴         | 🤖 🧩    |
| 6C.5 | Implement RAG context retrieval — top-k relevant chunks from Taxila (+ tagged Core Drive expansions) before calling the LLM                                                     | 🔴         | 🤖       |
| 6C.6 | Build Alter Ego chat UI — streaming display honoring the response contract (source color coding + footnotes; web retrieval may ship later, but the UI renders the contract now) | 🔴         | 🎨 🧩    |
| 6C.7 | Add `/chat` to the command palette                                                                                                                                              | 🟢         |          |
| 6C.8 | Implement `embeddingStatus` monitoring — a simple admin view showing failed embeddings                                                                                          | 🟡         | 🤖       |
| 6C.9 | Add retry trigger API endpoint for failed embeddings                                                                                                                            | 🟡         | 🤖       |

**Phase 6 Exit Criteria:** You can ask Alter Ego a question; the Context Assembler loads your kernel principles plus applicable Core Drive entries, RAG retrieves relevant knowledge chunks, and the answer streams as a structured, source-attributed response. `effortLevel` is honored end-to-end (contract → assembler → router). Models are resolved via the router config — switching providers is a config change. Failed embeddings are visible and retriable.

---
