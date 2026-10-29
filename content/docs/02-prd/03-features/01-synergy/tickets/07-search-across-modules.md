---
publish: true
id: prd.synergy.ticket-07
title: "Search across modules"
created: 2026-10-25
kind: plan
type: research
blocked_by: []
status: deprecated
assignee: claude
tags:
   - prd
   - synergy
   - wayfinder
---

> **Retired 2026-10-29.** The outcome lives in the [[02-prd/03-features/01-synergy/00.prd.features.synergy.overview|Synergy PRD]] and [[02-prd/03-features/01-synergy/spec|spec]]. This page stays as the record of how it was decided.

## Question

What search Synergy offers in the MVP: Postgres full text over index titles and tags, trigram matching, or both, and how it hands over to embeddings when Phase 6 adds them. Gather the facts on Postgres full-text and `pg_trgm` on Supabase that the decision needs.

## Resolution

Facts gathered in [[02-prd/03-features/01-synergy/research/07-search-across-modules|research 07]]. The decision it feeds stays open for the grilling tickets that depend on it.
