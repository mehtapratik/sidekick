---
title: Model selection strategy
description: >-  Which model to use for which kind of session based on the type of task, teaching value, and complexity
created: '2026-08-24'
updated: '2026-08-24'
version: 1.0.0
tags:
  - sidekick
  - project
  - technical
  - ai
section: notes
type: note
sourcePath: notes/model-heuristics.md
readingMinutes: 5
author: Pratik Mehta
license: CC BY-NC 4.0
audience: Software Engineers
status: active
---

# Model selection strategy

## The one-line principle

I'm using the agent as a **teacher**, not a bot. In teaching mode *I* write the code, so sessions are light on tokens and explanation quality matters more than cost. The moment a phase has no teaching value for me, I switch to **auto-pilot** (agent writes it) — and that's where cheap/fast models earn their place.

## Model roster

| Model | Where | Cost (in / out per 1M) | Role |
| ----- | ----- | ---------------------- | ---- |
| **Composer 2.5** | Cursor (included pool) | ~free on plan ($0.5 / $2.5 metered) | Auto-pilot implementer for low-teaching-value work |
| **GPT-5.6 Terra** | Cursor (Other Models) | $2 / $12 | Daily teaching driver |
| **GPT-5.6 Sol** | Cursor (Other Models) | $4 / $20 | Hard 🔴 backend/security/RAG lessons |
| **Opus 5** | Cursor (Other Models) | $5 / $25 | Final call on high-stakes architecture; deep debugging |
| **Fable 5** | Cursor (Other Models) | $10 / $50 | Rare, phase-reshaping architecture decisions only |
| **Gemini 3 Pro** | Gemini app / AI Studio (FREE, outside Cursor) | free tier | Brainstorming + architecture debate + PRD drafting |

## Core rules

1. **Teaching sessions → Terra by default, Sol for the 🔴 tasks.** A wrong explanation on security-critical work teaches me a bad mental model, so pay for reasoning where correctness compounds.
2. **Auto-pilot sessions → Composer 2.5.** It's a strong, near-free implementer. Use it only where I've judged there's nothing to learn.
3. **Brainstorm & debate architecture in FREE Gemini, outside Cursor.** These sessions are conversational, not in-editor — so they cost $0 and never touch the $20 pool. Then bring the plan to Opus for the final high-stakes call.
4. **Reserve Opus for the rare closer; Fable only for decisions I'll live with for months.**
5. **Privacy hard rule: never feed Core Drive or Alter Ego personal data to any free tier** (free Gemini may train on inputs). Public-repo coding chat is fine; my principles/private affairs are not. Use the paid API or keep them out.
6. **Effort level:** medium on Terra for routine teaching; bump to high on Sol for 🔴 concepts. Standard thinking on free Gemini for brainstorming; extended only when a design genuinely needs it (it burns the free quota faster).

## Planning layer (before every phase)

Phases 4, 5, 6, and 7 require a per-feature PRD first. Draft and debate that PRD in **free Gemini 3 Pro** (it holds the whole architecture doc + living plan in one context window), then have **Opus 5** pressure-test the final design. Keeps all planning off the $20.

## Phase-by-phase model map

Legend — Teaching value: ⭐ low (I know this) · ⭐⭐ medium · ⭐⭐⭐ high (why I'm doing this project)

| Phase | Teaching value | Teaching session | Auto-pilot session | Notes |
| ----- | -------------- | ---------------- | ------------------ | ----- |
| 0 — Foundation & tooling ✅ | ⭐⭐ | — | — | Done |
| 1 — Supabase & auth shell ✅ | ⭐⭐⭐ | — | — | Done |
| 1.1 — DB-level RLS ✅ | ⭐⭐⭐ | — | — | Done |
| 2 — API guard & feature system | ⭐⭐⭐ | **Sol** | — | Security backbone — teach every line; don't auto-pilot |
| 3 — Graph store & metadata | ⭐⭐⭐ | **Sol** (recursive CTEs) → **Opus** for the design | — | New backend modeling; core learning |
| 4 — Taxila v1 | ⭐⭐⭐ backend / ⭐ palette UI | **Terra**, **Sol** for RLS+repo | **Composer** for the command-palette UI | Split the phase: learn the schema→migration→API→repo loop, auto-pilot the frontend |
| 5 — Zinsser v1 (Tiptap editor) | ⭐ | Terra (only if I want Tiptap internals) | **Composer** | Frontend — I already know this; auto-pilot most of it |
| 6 — Core Drive + AI layer + Alter Ego | ⭐⭐⭐ | **Sol** (pgvector/HNSW/chunking) → **Opus** for Context Assembler design | — | The RAG phase I'm here for — never auto-pilot. Privacy rule applies to Core Drive/Alter Ego data |
| 7 — War Room & Factory | ⭐⭐ | **Terra** | **Composer** once the pattern repeats | Established patterns; teach once, then auto-pilot |
| 8 — PWA & iOS shell | ⭐⭐ | **Terra** (service workers, Capacitor are new) | **Composer** for config/boilerplate | Mostly config |
| 9 — API keys & CLI | ⭐⭐⭐ security / ⭐⭐ CLI | **Sol** for key crypto, **Terra** for CLI | Composer for CLI scaffolding | Key generation/hashing is get-it-right-first-time |
| 10 — Observability & hardening | ⭐⭐ | **Terra**, **Sol** for the pen-test pass | **Composer** for logging boilerplate | Teach the security audit, auto-pilot the plumbing |
| 11 — Dogfooding (optional) | ⭐⭐ | **Terra** | **Composer** | Invite flow + admin on known patterns |
| 12 — Billing & Stripe (optional) | ⭐⭐⭐ if I care about Stripe | **Sol** (webhooks) / **Terra** | **Composer** for UI | Webhook state sync is the tricky bit |
| Post-MVP | exploratory | **Gemini (free)** to explore → **Terra/Sol** to build | Composer | Low stakes; experiment cheaply |

## Quick decision flow

1. **New phase?** → Brainstorm PRD in free Gemini → finalize with Opus.
2. **Does this concept have teaching value for me?**
   - Yes, and it's 🔴 → **Sol** (teach mode)
   - Yes, routine → **Terra** (teach mode)
   - No → **Composer** (auto-pilot)
3. **Stuck on a nasty bug across many files?** → one **Opus** call.
4. **Architecture-defining fork I'll live with for months?** → one **Fable** call.

## Budget reality check

Because teaching sessions don't burn agentic tokens and brainstorming lives in free Gemini, **$20 Pro should hold up fine**. Revisit Pro+ ($60 = $70 of third-party usage) only if auto-pilot phases start dominating and Composer isn't enough.