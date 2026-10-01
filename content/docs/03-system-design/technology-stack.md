---
publish: true
id: system-design.technology-stack
created: 2026-09-19
kind: spec
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
