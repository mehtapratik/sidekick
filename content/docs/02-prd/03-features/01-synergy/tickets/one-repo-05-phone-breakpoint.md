---
publish: true
id: prd.synergy.one-repo.ticket-05
title: The Phone Breakpoint
created: 2026-11-03
kind: plan
type: grilling
blocked_by: []
status: open
assignee:
tags:
   - prd
   - synergy
   - one-repo
   - wayfinder
---

## Question

The new header hides the nav and theme control behind a menu on phones, and the docs tree becomes a Contents slide-over. That needs one width query, which breaks the house rule "no media queries for layout". Should the rule allow a single `@media (max-width: 40rem)`, a container query on the header, or should the design change so no query is needed?
