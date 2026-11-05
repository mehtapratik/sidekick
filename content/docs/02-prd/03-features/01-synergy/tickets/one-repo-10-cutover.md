---
publish: true
id: prd.synergy.one-repo.ticket-10
title: The Cutover to ossidekick.com
created: 2026-11-03
kind: plan
type: grilling
blocked_by:
   - one-repo-01-cloudflare-pages-for-a-monorepo
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

Once the redesign ships, how does the site move from arkive.blog to ossidekick.com with no broken link? This covers the Cloudflare project and custom domain, `www` to the apex, the arkive.blog 301 rule (path and query kept), `site` in the Astro config (canonical links, sitemap, RSS), how long arkive.blog keeps redirecting, and what is checked before and after. The same day, the App gains `app.ossidekick.com` ([Where the App Lives](one-repo-08-where-the-app-lives.md)).

## Resolution

Grilled with Pratik on 2026-11-05. The cutover runs once, after the redesign ships, with **no downtime**: a Worker can hold several custom domains, so ossidekick.com is added beside arkive.blog before arkive.blog becomes a redirect. arkive.blog then **redirects for one year and lapses**, and a visitor who arrives through the redirect sees a small banner saying so.

### Order on the day

1. **Add ossidekick.com** as a second Custom Domain on the `sidekick-www` Worker ([Pages or Workers for the Site](one-repo-11-pages-or-workers.md)). arkive.blog keeps serving the same build.
2. **Merge the host PR:** `site: "https://ossidekick.com"` in the Astro config, so canonical links, `sitemap.xml` and `rss.xml` name the new host; the retired-site banner (below); and the feed's `guid` set to each entry's `id` with `isPermaLink="false"`, so a later host change does not show every item as new. Workers Builds deploys it to both domains.
3. **Check ossidekick.com** before touching arkive.blog: the paths in its `sitemap.xml` diff empty against arkive.blog's (only the host differs), and a made-up path shows the 404 page.
4. **Turn arkive.blog into a redirect:** remove arkive.blog from the Worker, add proxied placeholder DNS records for `arkive.blog` and `www.arkive.blog` (an `AAAA` to `100::`), and add the redirect rules below on the arkive.blog zone.
5. **www to the apex:** a proxied placeholder record for `www.ossidekick.com` and a Single Redirect rule on the ossidekick.com zone: `www.ossidekick.com/*` to `https://ossidekick.com` with the same path and query, 301. The apex is the canonical address.
6. **The App:** `app.ossidekick.com`, as in [Where the App Lives](one-repo-08-where-the-app-lives.md).
7. **Tidy up:** set the `mehtapratik/sidekick` GitHub homepage field to `https://ossidekick.com`, and delete the old `arkive` Pages project, which Lesson 0 kept as a rollback.

### The arkive.blog redirect rules

Two Single Redirect rules on the arkive.blog zone, both 301, matching `arkive.blog` and `www.arkive.blog`. Each adds `from=arkive.blog` to the query so the site can tell the visitor came through the redirect, and keeps any query the visitor already had:

- **No query** (`http.request.uri.query eq ""`): target `concat("https://ossidekick.com", http.request.uri.path, "?from=arkive.blog")`, preserve query string off.
- **With a query:** target `concat("https://ossidekick.com", http.request.uri.path, "?", http.request.uri.query, "&from=arkive.blog")`, preserve query string off.

The tag goes in the query, not a `#fragment`, because a `Location` fragment would replace the visitor's own (datum anchors such as `#D12`). Retired URLs take two hops (arkive.blog, then ossidekick.com's `_redirects`), which is fine. Check the rules' expressions in the dashboard's preview before saving.

### The retired-site banner

A static page cannot tell it was reached through a redirect: a 301 keeps the original referrer, so `document.referrer` never names arkive.blog. The query tag is the signal.

- **Markup:** one hidden line at the top of the layout: "arkive.blog is retired. Sidekick now lives at ossidekick.com."
- **Script:** the site script shows it only when the URL has `from=arkive.blog`, then removes the tag with `history.replaceState`, so a copied or bookmarked URL is clean and a reload does not show it again. The canonical link is always the clean URL. Without JS there is no banner. This adds one item to the site's JS budget for the year.
- **Ends with the redirect:** the banner, its script and both redirect rules are removed when arkive.blog lapses.

### Checked after

A small script reads the old `sitemap.xml` and, for every path, requests it on arkive.blog and expects a 301 to the same path on ossidekick.com with `from=arkive.blog`, then a 200 there. It also checks one URL with a query (the query is kept), `www.arkive.blog` and `www.ossidekick.com` (both 301 to the apex), and `app.ossidekick.com`.

### How long arkive.blog redirects

**One year from the cutover, then the domain lapses.** A year gives search engines and feed readers time to follow the 301s. At the lapse, remove the redirect rules and the banner code in the same change. The coach sets a reminder a month before the renewal date when the cutover happens.
