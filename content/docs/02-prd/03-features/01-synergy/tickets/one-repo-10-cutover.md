---
publish: true
id: prd.synergy.one-repo.ticket-10
title: The Cutover to ossidekick.com
created: 2026-11-03
kind: plan
type: grilling
blocked_by:
   - one-repo-01-cloudflare-pages-for-a-monorepo
status: open
assignee:
tags:
   - prd
   - synergy
   - one-repo
   - wayfinder
---

## Question

Once the redesign ships, how does the site move from arkive.blog to ossidekick.com with no broken link? This covers the Cloudflare project and custom domain, `www` to the apex, the arkive.blog 301 rule (path and query kept), `site` in the Astro config (canonical links, sitemap, RSS), how long arkive.blog keeps redirecting, and what is checked before and after. The same day, the App gains `app.ossidekick.com` ([Where the App Lives](one-repo-08-where-the-app-lives.md)).
