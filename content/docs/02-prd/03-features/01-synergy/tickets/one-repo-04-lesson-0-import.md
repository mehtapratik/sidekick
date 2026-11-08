---
publish: true
id: prd.synergy.one-repo.ticket-04
title: "Lesson 0: the Import"
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

What exactly does Lesson 0 do, in what order, and what does Pratik learn from each step? It covers rewriting Arkive's history with `git filter-repo` (`sources/docs` to `content/docs`, `sources/writings` to `content/writings`, the rest to `apps/www`), merging it into Sidekick with unrelated histories, and the root config commits that keep CI green: lockfile, `.prettierignore`, the `AGENTS.md` symlink, removing `setup-docs`, and rewriting the written `docs/` paths. It also turns the site into a workspace app (`@sidekick/www`, pnpm instead of npm, Turbo) and runs the privacy and datum gates in CI. It also renames `apps/web` to `apps/app` (about 10 references in Sidekick's code and README, 55 vault pages, the Turbo package name and Vercel's Root Directory), and may make `content/` a workspace package so Vercel skips content-only commits ([Vercel Skips Content-Only Commits](one-repo-03-vercel-skips-content-commits.md)). Which of these belong in Lesson 0, and which wait for a later lesson? What check ends the lesson?

## Resolution

Grilled with Pratik on 2026-11-04 and 2026-11-05. Lesson 0 is five PRs and a hosting step (PR 5 and the hosting step added on 2026-11-05 by [Pages or Workers for the Site](one-repo-11-pages-or-workers.md)). Pratik types every change; the coach explains each step and writes the lesson's docs PR at the end, as for any lesson.

### Before the first PR: freeze Arkive

Set the `mehtapratik/arkive` description to "Moved to mehtapratik/sidekick", then archive the repo so nothing can land by mistake. Archiving is read-only and can be undone; old PR links keep working. The old Cloudflare Pages project keeps serving its last deployment, so arkive.blog stays up until the hosting step.

### PR 1: the Import (the one merge commit)

History plus only what CI needs to go green. Merged as a merge commit (merge commits switched on for this PR, then off again).

1. **Rewrite a throwaway clone of Arkive** with `git filter-repo` (`brew install git-filter-repo`): move everything into `apps/www/`, then rename `apps/www/sources/docs/` to `content/docs/` and `apps/www/sources/writings/` to `content/writings/`. Nothing else is special-cased; files that only exist in old commits (`design/`, `.idea/`, `.vscode/`) land under `apps/www/` in history. *Learns:* commits are snapshots, rewriting history gives every commit a new hash, and why this happens on a clone, never on GitHub.
2. **Merge it into Sidekick** on a branch: add the clone as a remote, fetch, `git merge --allow-unrelated-histories`. *Learns:* unrelated histories, merge commits with two parents, and why a squash would flatten Arkive's 126 commits.
3. **Make the site a workspace package.** It already is one, because `pnpm-workspace.yaml` globs `apps/*`. Name it `@sidekick/www`, delete `package-lock.json`, set `engines` to `24.x` and `.node-version` to 24, and run `pnpm install` to update `pnpm-lock.yaml`. *Learns:* one lockfile per workspace, and how `engineStrict` checks every package.
4. **Point the site at `content/`.** `src/lib/vault.mjs` resolves `content/docs` and `content/writings` from the repo root instead of `sources/` under the working directory. In `turbo.json`, `@sidekick/www#build` gets `inputs: ["$TURBO_DEFAULT$", "../../content/**"]`, because Turbo only hashes files inside the package and would otherwise replay a stale build (and skip the gates) after a content edit. *Learns:* Turbo's cache key and task inputs. The site's build script already runs the privacy and datum gates, so `pnpm build` in CI runs them.
5. **Inherit the root config.** Delete `apps/www/.gitignore` and `apps/www/.prettierrc`. The root `.gitignore` gains `.astro/`, `.obsidian/` and `.claude/settings.local.json`. The root gains `prettier-plugin-astro` and an `*.astro` override. `.prettierignore` gains `content/` and the ship-as-given files (`apps/www/public/arkive.css`, `arkive.js`, `fonts/`, `icons/`, `apps/www/src/shiki-themes.mjs`). *Learns:* how Prettier and Git find the nearest config file.
6. **One format commit.** `pnpm format` on `apps/www` only (the root config switches the site to single quotes), and that commit's hash goes into `.git-blame-ignore-revs`. *Learns:* keeping a bulk reformat out of `git blame`.
7. **Agent notes.** `apps/www/CLAUDE.md` becomes `apps/www/AGENTS.md`, updated for pnpm and `content/` paths. Delete `apps/www/.claude/launch.json` (the Claude app's dev-server preview config; nothing else reads it). Repoint the root `AGENTS.md` symlink at `content/docs/08-ai-coding-harness/agent-guide.md`. Remove the `docs` symlink, `scripts/setup-docs.mjs` and the `docs:setup` and `postinstall` scripts. Fold `apps/www/CONTEXT.md` into seven pages in `content/docs/07-glossary/`, delete it, and add the vocabulary rule to the agent guide ([A Home for the Site Vocabulary](one-repo-09-site-vocabulary-home.md)).
8. **Fix the live docs the import makes false:** Sidekick's README, the agent guide's `docs/…` paths, "one arkive PR" in the Synergy plan and the lesson 1 brief, and `docs/02-prd/` in the Taxila, Zinsser, Alter Ego and War Room plans. Add a post note to the Front Door hardening walkthrough saying `setup-docs` was removed in Lesson 0. Past walkthroughs and notes keep their historical text.

**Done when:** CI is green (Prettier, lint, typecheck, build with the site's gates, tests); `git log --follow` on a doc shows its Arkive commits; and the paths in the new build's `sitemap.xml` match arkive.blog's live sitemap exactly (`diff` prints nothing). That diff is the "no URL changes" promise as a test.

### PR 2: rename `apps/web` to `apps/app` (squash)

`git mv`, the package and Turbo name (plain `web` becomes `@sidekick/app`, so every app has the `@sidekick/` scope), about 10 references in code, ESLint config and README, the 56 vault pages that name `apps/web`, and Vercel's Root Directory. **Done when:** CI is green, `pnpm dev` opens the App, and Vercel's preview builds from `apps/app`.

### PR 3: content-only commits (squash)

`content/` becomes a workspace package (`@sidekick/content`) so Vercel's Skip deployment setting skips commits that touch only content ([Vercel Skips Content-Only Commits](one-repo-03-vercel-skips-content-commits.md)). The site declares `"@sidekick/content": "workspace:*"`, which replaces PR 1's Turbo `inputs` line with a real dependency. A small `actions/labeler` workflow adds a `content` label to any PR whose files are all under `content/`; content PRs also use `docs(<area>):` titles, so `label:content` filters them. *Learns:* folder input versus declared dependency in Turbo, and a workflow that needs `pull-requests: write` (CI today is read-only). **Done when:** a throwaway content-only PR gets the label and Vercel skips it.

### PR 4: type-check the site (squash)

Add `@astrojs/check` and `@types/node` as dev dependencies and a `typecheck: astro check` script, so `pnpm typecheck` covers the site. On 2026-11-05 `astro check` reported only two errors, both `node:fs` and `node:path` types in `src/pages/vault-assets/[...path].ts`, which `@types/node` fixes. `@astrojs/check` accepts TypeScript 5 or 6 only, so a TypeScript 7 bump waits on it. **Done when:** CI's typecheck step runs `astro check` green.

### PR 5: deploy the site on Workers (squash)

The site runs on a Worker with static assets, not Pages ([Pages or Workers for the Site](one-repo-11-pages-or-workers.md)). Add `apps/www/wrangler.jsonc` (`name: "sidekick-www"`, `assets.directory: "./dist"`, `not_found_handling: "404-page"`, a `previews` block) and Wrangler 4.135 or later as a dev dependency, delete `scripts/cf-build.sh`, and name the new build and deploy commands in the site's `AGENTS.md`. *Learns:* what a Worker with static assets is, and keeping hosting config in the repo instead of a dashboard. **Done when:** CI is green.

### Hosting step: arkive.blog builds from Sidekick

1. In the Cloudflare dashboard, **Workers → Import a repository** on `mehtapratik/sidekick`: root directory the repo root; build `pnpm turbo run build --filter=@sidekick/www`; deploy `pnpm -C apps/www exec wrangler deploy`; preview `pnpm -C apps/www exec wrangler preview`, with preview builds on; watch paths `apps/www/*`, `content/*`, `pnpm-lock.yaml`, `package.json`, `pnpm-workspace.yaml`, `turbo.json`. No `NODE_VERSION` or `PNPM_VERSION`: the image defaults to Node 24 and reads pnpm from `packageManager`. The first build deploys `main` to `sidekick-www.<subdomain>.workers.dev`.
2. Check that URL: the sitemap paths diff empty against arkive.blog's, and a made-up path shows the 404 page.
3. Move the domain: remove arkive.blog from the old `arkive` Pages project and delete its CNAME, then add arkive.blog as a Custom Domain on the Worker. Expect a few minutes of downtime.
4. Pause the old project's automatic deployments, but keep it as a rollback (re-add the domain) until the ossidekick.com cutover deletes it ([The Cutover to ossidekick.com](one-repo-10-cutover.md)). ossidekick.com still waits for the redesign, which is later Phase 3 lessons.

**Lesson 0 is done when** arkive.blog serves from the `sidekick-www` Worker built from Sidekick's `main`, and the sitemap diff against the old site is still empty.

### After the lesson

- **Lessons end as before, in one repo:** Pratik's code PRs, then one coach docs PR (walkthrough, notes, plan ✅), now in Sidekick. A code PR that makes a doc false fixes that doc in the same PR.
- **Outside the repo:** Pratik points Obsidian at `~/Projects/sidekick/content/docs` and deletes `~/Projects/arkive`; the coach updates project memory and the lesson-start prompts.
- **Settled since (2026-11-05):** `CONTEXT.md` folds into `content/docs/07-glossary/` in PR 1, step 7 ([A Home for the Site Vocabulary](one-repo-09-site-vocabulary-home.md)).

