---
title: Technology stack
deck: ''
created: '2026-09-19'
updated: '2026-09-27'
kind: spec
status: draft
version: 1.0.0
tags:
  - system-design
  - supabase
  - drizzle
  - postgresql
  - nextjs
  - typescript
  - turborepo
  - pnpm
  - vercel
appliesTo: []
isSection: false
docId: system-design.technology-stack
sourcePath: sources/docs/03-system-design/technology-stack.md
wordCount: 87
readingMinutes: 1
author: Pratik Mehta
license: CC BY-NC 4.0
description: ''
---

| Layer        | Choice                                               |
| ------------ | ---------------------------------------------------- |
| Frontend     | Next.js 16 App Router                                |
| Language     | TypeScript Strict                                    |
| DB           | Supabase PostgreSQL                                  |
| ORM          | Drizzle ORM                                          |
| Styling      | Mantine                                              |
| Editor       | Tiptap                                               |
| AI SDK       | Vercel AI SDK                                        |
| LLM          | Provider-agnostic router (default: Anthropic Claude) |
| Embeddings   | OpenAI text-embedding-3-small                        |
| Monorepo     | Turborepo + pnpm                                     |
| Hosting      | Vercel                                               |
| Native Shell | Capacitor                                            |
