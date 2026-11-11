---
publish: true
id: plan.phase-3.lesson-0-one-repo
title: "Synergy Lesson 0: One Repo"
created: 2026-11-05
updated: 2026-11-11
kind: plan
version: 1.2.0
tags:
   - plan
   - phase-3
   - task
   - monorepo
   - one-repo
   - git
   - cloudflare
status: completed
---

> **Completed 2026-11-11** ([[04-phases/03-synergy/00-lessons/lesson-0-one-repo/01-walkthrough|walkthrough]], [[04-phases/03-synergy/00-lessons/lesson-0-one-repo/02-notes|notes]]): sidekick#34, #35, #38, #39, #43, #44 and #45; arkive.blog and `www.arkive.blog` are served by `sidekick-www`. Two plans below changed in the doing: PR 1's Turbo input is `$TURBO_ROOT$/content/**`, and PR 4's two type errors didn't appear in Sidekick (Node's types reached the site through Vite; see the notes).

> **Lesson 0 of Phase 3a, before lesson 1.** Before this: [[04-phases/02-gatekeeper/lessons/lesson-8-close-out/00-brief|Phase 2 close-out]]. Next: [[04-phases/03-synergy/00-lessons/lesson-1-layer-folders/00-brief|lesson 1]]. The coach follows the plan's [[04-phases/03-synergy/00-plan#How we build|how we build]].

**What gets built:** Arkive's docs, writings and site move into the Sidekick repo with their full history. The vault becomes `content/docs/`, the writings `content/writings/`, the site the workspace app `apps/www` (`@sidekick/www`), and `apps/web` becomes `apps/app`. arkive.blog then serves the current site from a Cloudflare Worker built from Sidekick's `main`. The site looks the same; the redesign is the site lessons after Checkpoint 3a.

**Implements:** [[02-prd/03-features/01-synergy/09.prd.features.synergy.one-repo|One Repo]] (D213 to D217, D220, D221, D226) and the [[02-prd/03-features/01-synergy/spec#One Repo|spec's One Repo section]].

**Learning payoff:** what a commit is and what rewriting history does (`git filter-repo`); merging unrelated histories; one lockfile and `engineStrict` across a workspace; Turbo's cache key, task inputs and declared dependencies; how Prettier and Git find the nearest config; keeping a bulk reformat out of `git blame`; a workflow that needs `pull-requests: write`; what a Worker with static assets is, and keeping hosting config in the repo.

**Coach reads first:** the One Repo PRD and spec section; in Arkive, `CLAUDE.md`, `package.json`, `astro.config.mjs`, `src/lib/vault.mjs`, `scripts/` and `CONTEXT.md`; in Sidekick, the root `package.json`, `pnpm-workspace.yaml`, `turbo.json`, `.prettierrc`, `.prettierignore`, `.gitignore`, `renovate.json`, `.github/workflows/`, `scripts/setup-docs.mjs` and the README. Pratik types every change, in `content/` and `apps/www/` as much as in the root config.

## Before the first PR: freeze Arkive

Set the `mehtapratik/arkive` description to "Moved to mehtapratik/sidekick", then archive the repo so nothing can land by mistake. Archiving is read-only and can be undone; old PR links keep working. The old Cloudflare Pages project keeps serving its last deployment, so arkive.blog stays up until the hosting step.

## PR 1: the Import (the one merge commit)

History plus only what CI needs to go green. Merged as a merge commit: Pratik switches merge commits on for this PR, then off again.

1. **Rewrite a throwaway clone of Arkive** with `git filter-repo` (`brew install git-filter-repo`): move everything into `apps/www/`, then rename `apps/www/sources/docs/` to `content/docs/` and `apps/www/sources/writings/` to `content/writings/`. Nothing else is special-cased; files that only exist in old commits (`design/`, `.idea/`, `.vscode/`) land under `apps/www/` in history. _Learns:_ commits are snapshots, rewriting gives every commit a new hash, and why it happens on a clone, never on GitHub.
2. **Merge it into Sidekick** on a branch: add the clone as a remote, fetch, `git merge --allow-unrelated-histories`. _Learns:_ unrelated histories, a merge commit's two parents, and why a squash would flatten Arkive's history.
3. **Make the site a workspace package.** `pnpm-workspace.yaml` already globs `apps/*`. Name it `@sidekick/www`, delete `package-lock.json`, set `engines` to `24.x` and `.node-version` to 24, change its exact dependency pins to `^major.minor.patch` (Sidekick's convention, which Renovate keeps current with no new rules), and run `pnpm install` to update `pnpm-lock.yaml`. _Learns:_ one lockfile per workspace, and how `engineStrict` checks every package.
4. **Point the site at `content/`.** `src/lib/vault.mjs` resolves `content/docs` and `content/writings` from the repo root. In `turbo.json`, `@sidekick/www#build` gets `inputs: ["$TURBO_DEFAULT$", "../../content/**"]`, because Turbo only hashes files inside the package and would otherwise replay a stale build, and skip the gates, after a content edit. _Learns:_ Turbo's cache key and task inputs. The site's build script already runs the privacy and datum gates, so `pnpm build` in CI runs them.
5. **Inherit the root config.** Delete `apps/www/.gitignore` and `apps/www/.prettierrc`. The root `.gitignore` gains `.astro/`, `.obsidian/` and `.claude/settings.local.json`. The root gains `prettier-plugin-astro` and an `*.astro` override. `.prettierignore` gains `content/` and the ship-as-given files (`apps/www/public/arkive.css`, `arkive.js`, `fonts/`, `icons/`, `apps/www/src/shiki-themes.mjs`). _Learns:_ how Prettier and Git find the nearest config file.
6. **One format commit.** `pnpm format` on `apps/www` only (the root config switches the site to single quotes), and that commit's hash goes into `.git-blame-ignore-revs`. _Learns:_ keeping a bulk reformat out of `git blame`.
7. **Agent notes and vocabulary.** `apps/www/CLAUDE.md` becomes `apps/www/AGENTS.md`, updated for pnpm and `content/` paths. Delete `apps/www/.claude/launch.json`. Repoint the root `AGENTS.md` symlink at `content/docs/08-ai-coding-harness/agent-guide.md`. Remove the `docs` symlink, `scripts/setup-docs.mjs` and the `docs:setup` and `postinstall` scripts. Fold `apps/www/CONTEXT.md` into seven glossary pages (`sidekick.md`, `app.md`, `public-site.md`, `entry.md`, `writing.md`, `doc.md`, `about.md` in `content/docs/07-glossary/`, each `kind: glossary`, `id: glossary.<slug>`, tags `glossary` and `site`, ending with its _Avoid_ line), delete `CONTEXT.md`, and add D226's line to the agent guide.
8. **Licence.** Add `content/LICENSE` with the CC BY-NC 4.0 legal code, and a Licence section to the README: code under MIT (the root `LICENSE`), writings and docs under CC BY-NC 4.0 (`content/LICENSE`), fonts under their own licences beside the files. The footer line stays as it is.
9. **Fix the live docs the import makes false:** Sidekick's README, the agent guide's `docs/…` paths, "one arkive PR" and `npm run build` in the Synergy plan and the lesson 1 brief, and `docs/02-prd/` in the Taxila, Zinsser, Alter Ego and War Room plans, and the arkive repo's `CLAUDE.md` and `src/lib/datums.mjs` in [[03-system-design/functional-design/04-synergy/violations-and-exceptions|Violations and exceptions]] (now `apps/www/AGENTS.md` and `apps/www/src/lib/datums.mjs`). Add a post note to the Front Door hardening walkthrough saying `setup-docs` was removed in Lesson 0. Past walkthroughs and notes keep their historical text.

**Done when:** CI is green (Prettier, lint, typecheck, build with the site's gates, tests); `git log --follow` on a doc shows its Arkive commits; and the paths in the new build's `sitemap.xml` match arkive.blog's live sitemap exactly (`diff` prints nothing).

## PR 2: rename `apps/web` to `apps/app` (squash)

`git mv`, the package and Turbo name (`web` becomes `@sidekick/app`), about 10 references in code, ESLint config and README, the vault pages that name `apps/web` (D54 in the Vercel decision among them), and Vercel's Root Directory. **Done when:** CI is green, `pnpm dev` opens the App, and Vercel's preview builds from `apps/app`.

## PR 3: content-only commits (squash)

`content/` becomes a workspace package (`@sidekick/content`, `pnpm-workspace.yaml` lists `content`), and Vercel's Skip deployment setting is checked on the App's project. The site declares `"@sidekick/content": "workspace:*"`, which replaces PR 1's Turbo `inputs` line with a real dependency. A small `actions/labeler` workflow adds a `content` label to any PR whose files are all under `content/`. `content/package.json` gets no `main`, `exports` or `types`, and `scripts/check-content.mjs` (`pnpm check:content`) fails on a file outside the allowlist or an extra `package.json` key; CI runs it as a step and husky's pre-commit runs it too ([[D259]]). _Learns:_ folder input versus declared dependency in Turbo, a workflow that needs `pull-requests: write` (CI today is read-only), and a structural guard where lint can't reach. **Done when:** a throwaway content-only PR gets the label and Vercel skips it, and a throwaway `content/index.ts` fails `check:content`.

## PR 4: type-check the site (squash)

Add `@astrojs/check` and `@types/node` as dev dependencies and a `typecheck: astro check` script, so `pnpm typecheck` covers the site. On 2026-11-05 `astro check` reported only two errors, both `node:fs` and `node:path` types in `src/pages/vault-assets/[...path].ts`, which `@types/node` fixes. **Done when:** CI's typecheck step runs `astro check` green.

## PR 5: deploy the site on Workers (squash)

Add `apps/www/wrangler.jsonc` (`name: "sidekick-www"`, `compatibility_date`, `assets.directory: "./dist"`, `assets.not_found_handling: "404-page"`, a `previews` block) and Wrangler 4.135 or later as a dev dependency, delete `scripts/cf-build.sh`, and name the new build and deploy commands in the site's `AGENTS.md`. _Learns:_ what a Worker with static assets is, and hosting config reviewed in a PR. **Done when:** CI is green.

## Hosting step: arkive.blog builds from Sidekick

1. In the Cloudflare dashboard, **Workers → Import a repository** on `mehtapratik/sidekick`, with the settings in the [[02-prd/03-features/01-synergy/spec#One Repo|spec]] (root directory the repo root, the build, deploy and preview commands, the watch paths) and preview builds on. The first build deploys `main` to `sidekick-www.<subdomain>.workers.dev`.
2. Check that URL: the sitemap paths diff empty against arkive.blog's, and a made-up path shows the 404 page.
3. Move the domain: remove arkive.blog from the old `arkive` Pages project and delete its CNAME, then add arkive.blog as a Custom Domain on the Worker. Expect a few minutes of downtime.
4. Pause the old project's automatic deployments, and keep it as a rollback (re-add the domain) until the cutover deletes it.

**Exit check:** arkive.blog serves from the `sidekick-www` Worker built from Sidekick's `main`, and the sitemap diff against the old site is still empty.

## After the lesson

- **Docs PR (coach), now in Sidekick:** walkthrough, notes, the lesson marked ✅, and the handover in lesson 1's brief.
- **Outside the repo:** Pratik points Obsidian at `~/Projects/sidekick/content/docs` and deletes `~/Projects/arkive`; the coach updates project memory and the lesson-start prompts.

**Out of scope:** the redesign and ossidekick.com (the site lessons), `app.ossidekick.com` (the cutover), any App change beyond the rename.
