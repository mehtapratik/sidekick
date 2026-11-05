---
publish: true
id: prd.synergy.one-repo.map
title: "One Repo: Wayfinder Map"
created: 2026-11-03
kind: plan
version: 0.8.0
status: draft
updated: 2026-11-05
tags:
   - prd
   - synergy
   - one-repo
   - wayfinder
---

## Destination

This map ends in a PRD for one repo and one domain: a new page, `prd.features.synergy.one-repo.md`, and a one-repo section in [[02-prd/03-features/01-synergy/spec|the Synergy spec]]. The PRD says what moves and why: Arkive's docs, writings and site move into the `mehtapratik/sidekick` repo, and the site is rebuilt as the Sidekick public site at ossidekick.com. The Phase 3 plan also gains **Lesson 0: One repo** and the lessons that build the new site. This map only plans; nothing gets built while it is open.

## Notes

Today Sidekick's code and its docs live in two repos, joined by a `docs` symlink and an install script that clones Arkive. Every change that touches code and the docs that describe it takes two PRs. One repo puts docs, writings, the AI harness, source code and other artifacts side by side, and one domain gives the project one public face.

- **Who builds:** Pratik types every change, in `content/` and `apps/www/` as much as in the root config, so he knows what Sidekick's configuration gained. The coach explains and never edits the implementation.
- **The new site:** the design handover for the Sidekick public site is a throwaway prototype, never committed. Read it from the project's shared files (`one-repo/design/HANDOVER.md`, `tokens.css`, `plates.mjs`, `reference/`). Where it and this map disagree, this map wins. **Revised handover (Pratik, 2026-11-04):** only the typefaces changed. The site keeps arkive.blog's three faces, which already ship in `public/fonts/`: General Sans for headings and interface text, Sentient for reading text and the wordmark, IBM Plex Mono for code, dates and versions. Reading text is weight 400. SN Pro and LXGW WenKai Mono are dropped, so no new fonts and no font subsetting. Colours, layout and `plates.mjs` are unchanged. Its vocabulary (Sidekick, App, Public site, Entry, Writing, Doc, About) is in `CONTEXT.md` at the repo root until Lesson 0 folds it into `07-glossary/`.
- **Workflow:** `wayfinder`, then `grill-with-docs`, then `to-spec`, as for [[02-prd/03-features/01-synergy/map|the Synergy map]]. Grilling tickets consult the `grilling` and `domain-modeling` skills; research tickets use `research`. Tickets live in `tickets/` as `one-repo-NN-<slug>.md` with `type`, `blocked_by`, `status` and `assignee` in frontmatter. A session claims a ticket by setting `assignee` before any work. Once the PRD and spec absorb the outcome, this map and its tickets are retired.

## Decisions so far

Settled while charting (Pratik, 2026-11-03):

- **Surviving repo:** `mehtapratik/sidekick`. Arkive's full history (123 commits) comes with it, and `mehtapratik/arkive` is archived, not deleted, so its PR links keep working.
- **History onto `main`:** the import PR merges as a one-off merge commit, because a squash would flatten Arkive's history. Merge commits are switched on for that PR only.
- **Layout:** `content/docs/` (the vault), `content/writings/`, and the site at `apps/www/`. `AGENTS.md` points into `content/docs/`. Site URLs do not change.
- **App folders** (2026-11-04): the public site is `apps/www` and the App's `apps/web` is renamed `apps/app`, so each folder is named for the address it serves (ossidekick.com and app.ossidekick.com). `apps/` and `packages/` stay as the parent folders.
- **One import PR:** the import commits and Pratik's root config commits (lockfile, `.prettierignore`, the symlink, removing `setup-docs`) share one branch, because the import alone breaks Sidekick's CI. The rename to `apps/app`, `content/` as a package, `astro check` and the Worker config follow as their own squash PRs.
- **When:** Lesson 0 runs at the start of 3a, before lesson 1, so lesson 1's `git mv` work and the live recordings happen in the merged repo. Lessons 1 to 13 keep their numbers.
- **Domain:** ossidekick.com (registered on Cloudflare) serves the public site at the apex. Lesson 0 ends with arkive.blog serving the current site from a new Cloudflare project built from Sidekick (revised 2026-11-04, so the site never goes stale); arkive.blog moves to ossidekick.com once, after the redesign ships, with every path kept.
- **Name:** Arkive is retired. The site is the Sidekick public site from the design handover.
- **Formatting:** `content/` stays out of Prettier (142 of 288 vault files fail Sidekick's config today); `apps/www/` keeps its own Prettier config.
- **Local work first:** the work on Pratik's Mac landed in arkive #37 (principles subfolders with redirects, three value propositions, `CONTEXT.md`); the local CSS edits were discarded.

Resolved tickets:

- [Cloudflare Pages for a Monorepo](tickets/one-repo-01-cloudflare-pages-for-a-monorepo.md): a new Cloudflare project is needed (no repo switch); Node must move to 24; Cloudflare now steers new projects to Workers, which opened a ticket.
- [The App Under the Same Domain](tickets/one-repo-02-app-under-the-same-domain.md): `app.ossidekick.com` is simplest and what Vercel recommends; `/app` works through a Cloudflare Worker proxy at the cost of Vercel's CDN features and careful redirect handling.
- [Vercel Skips Content-Only Commits](tickets/one-repo-03-vercel-skips-content-commits.md): Vercel's built-in skip, with `content/` as a workspace package; `turbo query affected` as the fallback.
- [Lesson 0: the Import](tickets/one-repo-04-lesson-0-import.md): five PRs (the import as the one merge commit, the `apps/app` rename, `content/` as a package with a `content` PR label, `astro check`, the Worker config) and a hosting step that moves arkive.blog to the new Worker; Arkive is archived before the rewrite; done when the sitemap matches the old site's.
- [Pages or Workers for the Site](tickets/one-repo-11-pages-or-workers.md): a Worker with static assets (`sidekick-www`), built by Workers Builds from the repo root, with branch previews from day one; its `wrangler.jsonc` lives in `apps/www`. Every app takes the `@sidekick/` scope (`@sidekick/app` after the rename). A later `/app` route can be a script on the same Worker.
- [The Phone Breakpoint](tickets/one-repo-05-phone-breakpoint.md): the house rule allows one width breakpoint, `@media (width < 58rem)`, only to swap chrome (header nav and theme into the Menu, the docs tree into a full-viewport Contents view, the `/` hint hidden). The docs sidebar stops fitting beside the article at 920px (57.5rem), rounded up; the handover's 40rem would stack the tree above the article on tablets. The theme control becomes one cycling button. The rule changes in the redesign lesson that builds the chrome.
- [Milestone Tiles From the Phases Folder](tickets/one-repo-06-milestone-tiles.md): one tile per phase, from each `04-phases/NN-name/00-plan.md`: order and label from `NN`, title from `title`, status from `status` (`completed` done, `deferred` deferred, the first other phase up next). Sub-plans get no tile and appear indented in the "All phases" list. Today: 3 of 13 complete, Synergy up next.
- [RSS on the New Site](tickets/one-repo-07-rss.md): `/rss.xml` stays and carries Writings only, newest first by `created`, with the summary as the description; no docs feed. Today's mixed feed held 50 docs and none of the four writings.
- [Where the App Lives](tickets/one-repo-08-where-the-app-lives.md): `app.ossidekick.com` (DNS-only CNAME to Vercel), attached at the cutover; until then the App stays at `sidekick-six-bay.vercel.app`. The public site shows no App link until Open House, because the App is single-user; Pratik turns off Supabase sign-up.
- [A Home for the Site Vocabulary](tickets/one-repo-09-site-vocabulary-home.md): `CONTEXT.md` folds into seven `07-glossary/` pages (with their _Avoid_ lines) in Lesson 0's PR 1 and is deleted; the agent guide tells skills that ask for `CONTEXT.md` to write the glossary page instead.

## Not yet specified

- How the redesign's pieces (chrome, generated folder pages, search, theme, plates, fonts) split into lessons, and what Pratik learns in each. The tickets it waited on (phone breakpoint, milestone tiles, RSS) are settled, so the split can be planned now.
- The repo's licence story for content (MIT code, CC BY-NC 4.0 writings and docs) in one tree.
- Updating the GitHub homepage field. (Archiving the arkive repo, the old Pages project, lesson-start prompts, project memory and the Obsidian vault path are settled in Lesson 0.)
- Whether Renovate needs rules for the site's dependencies (Astro majors) beyond the defaults.

## Out of scope

- App features and any change to `apps/web` beyond what serving it at its final address needs.
- Changing any published URL.
