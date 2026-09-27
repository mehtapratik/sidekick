---
id: plan.phase-5-zinsser-v1-writing-editor-first
created: 2026-09-19
kind: plan
version: 1.0.0
tags:
   - plan
   - living-plan
   - phase-5
   - taxila
   - zinsser
   - api
   - mantine
   - ai
   - embeddings
status: planned
depends_on:
   - "[[04-plans/phase-4-taxila-v1-knowledge-management]]"
---

> **Milestone:** A proper writing experience with Tiptap. Taxila and Zinsser share the editor component. This is where the app starts feeling real.
> **Learning payoff:** Tiptap configuration, rich text as JSON storage, markdown export, editor extensions.
> **Prerequisite:** Write the Zinsser PRD in `docs/02-prd/` before starting.
> **Scope note:** This phase is the editor only. Zinsser's AI-coach layer (style profile trained on your writing, point-by-point feedback, repeated-mistake tracking) depends on the AI layer and is sequenced after Phase 6 — see Backlogged item B2.

| #    | Task                                                                                        | Complexity | Learning |
| ---- | ------------------------------------------------------------------------------------------- | ---------- | -------- |
| 5.1  | Install Tiptap dependencies in `packages/ui`                                                | 🟢         | ✍️       |
| 5.2  | Build a `<RichTextEditor>` component in `packages/ui` using `@mantine/tiptap`               | 🟡         | ✍️ 🎨    |
| 5.3  | Configure extensions: Bold, Italic, Heading, BulletList, OrderedList, Code, Link, Image     | 🟡         | ✍️       |
| 5.4  | Implement JSON storage — editor outputs `editor.getJSON()` for storage                      | 🔴         | ✍️       |
| 5.5  | Implement markdown export — `editor.storage.markdown.getMarkdown()` for embedding pipeline  | 🔴         | ✍️       |
| 5.6  | Make editor mobile-friendly (touch targets, mobile toolbar)                                 | 🟡         | ✍️ 📱    |
| 5.7  | Swap plain textarea in Taxila notes editor for `<RichTextEditor>`                           | 🟢         |          |
| 5.8  | Create `packages/feature-zinsser` with its own schema                                       | 🟡         | 📦 🗄️    |
| 5.9  | Define `documents` table — similar shape to `notes` but with `type` (essay, journal, draft) | 🟡         | 🗄️       |
| 5.10 | Implement full API routes for Zinsser (same pattern as Taxila)                              | 🟡         | 🧩       |
| 5.11 | Register `zinsser` feature + `document` entity type in feature registry                     | 🟢         |          |
| 5.12 | Make Zinsser reachable via the command palette (`/writing`)                                 | 🟡         | 🧩 🎨    |

**Phase 5 Exit Criteria:** The rich text editor is shared, reusable, stores JSON, exports markdown. Taxila and Zinsser both use it.

---
