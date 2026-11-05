---
publish: true
id: prd.synergy.one-repo.ticket-11
title: Pages or Workers for the Site
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

The site needs a new Cloudflare project either way ([Cloudflare Pages for a Monorepo](one-repo-01-cloudflare-pages-for-a-monorepo.md)). Does it stay on Pages (known setup, `_redirects` as today, but pnpm 12 and Node 24 set by env vars) or move to a Worker with static assets (Cloudflare's advice for new projects, Node 24 and Corepack in the image, a `wrangler.jsonc` to learn and maintain)? How do redirects, preview URLs per branch and watch paths work on each, and does the choice change how a later `/app` route could be added?

Lesson 0's hosting step waits on this ticket: arkive.blog moves to the new project during Lesson 0, not at the cutover ([Lesson 0: the Import](one-repo-04-lesson-0-import.md)).
