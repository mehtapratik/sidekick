---
publish: true
id: system-design.technology-stack
title: Technology Stack
created: 2026-09-19
updated: 2026-11-06
kind: spec
version: 1.1.0
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

| Layer        | Choice                                                        |
| ------------ | ------------------------------------------------------------- |
| Frontend     | Next.js 16 App Router                                         |
| Language     | TypeScript Strict                                             |
| DB           | Supabase PostgreSQL                                           |
| ORM          | Drizzle ORM                                                   |
| Styling      | CSS modules and `ui` on native HTML (Mantine until lesson M1) |
| i18n         | next-intl (from lesson I1)                                    |
| Editor       | Tiptap                                                        |
| AI SDK       | Vercel AI SDK                                                 |
| LLM          | Provider-agnostic router (default: Anthropic Claude)          |
| Embeddings   | OpenAI text-embedding-3-small                                 |
| Monorepo     | Turborepo + pnpm                                              |
| Hosting      | Vercel (App), Cloudflare Workers (public site)                |
| Public site  | Astro, static, temporary                                      |
| Native Shell | Capacitor                                                     |
