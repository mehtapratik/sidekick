---
publish: true
id: prd.synergy.ticket-05
title: "Where the resolver contract lives"
created: 2026-10-25
kind: plan
type: research
blocked_by: []
status: closed
assignee: claude
tags:
   - prd
   - synergy
   - wayfinder
---

## Question

Each module registers a resolver that supplies render data for its entity types. `packages/core` can't import `packages/features-registry` today, and core must stay feature-agnostic. Where does the contract live, who calls it, and what does the dependency direction become? Survey the current package boundaries and how comparable systems (Notion, Obsidian plugins, Backstage) register resolvers.

## Resolution

Facts gathered in [[02-prd/03-features/01-synergy/research/05-resolver-contract-home|research 05]]. The decision it feeds stays open for the grilling tickets that depend on it.
