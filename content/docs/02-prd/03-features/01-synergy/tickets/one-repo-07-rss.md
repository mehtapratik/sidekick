---
publish: true
id: prd.synergy.one-repo.ticket-07
title: RSS on the New Site
created: 2026-11-03
kind: plan
type: grilling
blocked_by: []
status: deprecated
assignee: claude
updated: 2026-11-05
tags:
   - prd
   - synergy
   - one-repo
   - wayfinder
---

> **Retired 2026-11-05.** The outcome lives in the [[02-prd/03-features/01-synergy/09.prd.features.synergy.one-repo|One Repo PRD]] and the [[02-prd/03-features/01-synergy/spec#One Repo|spec's One Repo section]]. This page stays as the record of how it was decided.

## Question

arkive.blog publishes `/rss.xml` with the newest 50 entries across writings and docs. The handover keeps the route but notes RSS was never discussed. Does the feed stay, and if so, does it carry writings only, docs too, or one feed each? Existing subscribers follow the arkive.blog 301.

## Resolution

Grilled with Pratik on 2026-11-05. **The feed stays at `/rss.xml` and carries Writings only.** There is no docs feed.

### What today's feed carries

A build of arkive.blog on 2026-11-05 put 50 items in `dist/rss.xml`, all of them Docs: none of the four Writings made it in. The feed takes the newest 50 listed entries by As of, so working notes push the essays out; that day the top five items were wayfinder tickets.

### The rule

- **Route:** `/rss.xml`, unchanged, so subscribers who follow the arkive.blog 301 land on it, and the `<link rel="alternate">` in the page head keeps pointing at it.
- **Items:** every listed Writing (retired entries stay out, as `getListedEntries` already does), newest first by frontmatter `created`, at most 50.
- **Date:** each item's `pubDate` is `created`, not As of, so editing an old essay does not push it back to the top as if it were new.
- **Description:** the entry's summary, as today. No full text, which would mean rendering prose and plates into the feed.
- **Title and description of the feed:** the site's name and blurb, which become Sidekick's when the site is renamed.

### Why Writings only

- **Writings are what readers subscribe for.** They are finished essays written for readers. Docs are working notes (tickets, plans, lesson notes) that churn several times a day while work runs, and anyone who wants them can browse the site.
- **No docs feed for now.** A `/docs/rss.xml` has no reader yet, and Sidekick does not build foundations without a near-term use. It can be added later if someone asks.
- **The cost:** anyone subscribed today stops getting doc updates, and the feed goes quiet between essays.
