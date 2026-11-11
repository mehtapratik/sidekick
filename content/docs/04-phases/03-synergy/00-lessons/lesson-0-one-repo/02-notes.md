---
publish: false
id: notes.phase-3.lesson-0
title: "Synergy Lesson 0 Notes: One Repo"
created: 2026-11-11
updated: 2026-11-11
kind: notes
version: 1.0.0
tags:
   - phase-3
   - monorepo
   - one-repo
   - git
   - cloudflare
status: completed
applies_to:
   - "[[04-phases/03-synergy/00-lessons/lesson-0-one-repo/00-brief]]"
---

These notes record what lesson 0 taught: the mental models, the surprises and the corrections worth remembering. The steps to reproduce it are in [[04-phases/03-synergy/00-lessons/lesson-0-one-repo/01-walkthrough|the walkthrough]].

The thread running through the lesson: **configuration that a tool applied silently becomes a file someone reviews.** Pages added security headers nobody asked for, npm hoisted a plugin nobody declared, Vite leaked Node's types into a package that never asked for them, and a dashboard held the site's build settings. Each one surfaced only when something moved.

---

## How the lesson ran

Run over Remote Control from 2026-11-08 to 2026-11-11 and recorded. The coach gave the exact change for each step with the reasoning below it; Pratik typed code and config, and from step 7 handed copy work (vault pages, the README, glossary pages, agent notes) to the coach, who showed the diff. Pratik merged fast, sometimes before a branch's last commit was pushed (#38 merged without the guard, which became #39), so the coach checked PR state before every push.

---

## Git

- **A commit is a snapshot plus its parent's hash.** Rewriting anything (moving a file in the past, amending, rebasing) gives that commit and every later one a new hash. filter-repo rewrote all 143 Arkive commits. Their messages, authors and dates survived; their hashes didn't. Docs that quote an Arkive hash still resolve on the archived repo, not in Sidekick: `c91121d` is `28ec684` here, found by its message.
- **filter-repo works only on a fresh clone and removes `origin`.** Both guards exist so a rewrite can't be pushed over the real repo.
- **Rewrite first, then merge.** Copying files loses history. Merging Arkive as it was and then `git mv`-ing would have collided at the root (`package.json`, `.gitignore`, `.prettierrc`) and left every old commit showing Arkive at Sidekick's root. `git subtree add` puts a repo under one prefix and can't split docs from the site.
- **Unrelated histories** have no merge base; `--allow-unrelated-histories` merges against an empty tree. A merge commit has two parents, so `git log` reaches both lines and `git log --first-parent` shows only Sidekick's.
- **Squash, rebase and merge commits.** A squash writes one new commit with one parent. GitHub's rebase merge also writes new commits with new hashes. Only a merge commit keeps the branch's commits and hashes, which is why the import was the one merge commit on `main` and why its format commit's hash could go into `.git-blame-ignore-revs` before merging. For #25 (squashed) the hash needed a follow-up commit.
- **The squash accident.** #34 was squash-merged by mistake. Merging the branch again on top would not have helped: when a merge's parents have identical files, history simplification follows the first parent, so `log --follow` and `blame` would still stop at the squash. The fix was to rebuild the same merge commit on the squash's parent and force-push once with `--force-with-lease=main:<squash>`, ruleset off for a minute. Squash-only is enforced twice (the repo's merge buttons and the ruleset's allowed methods), so a merge commit needs both opened and both closed again.
- **`HTTP 400` on a big push** over HTTPS: the pack (2.4 MB) was bigger than `http.postBuffer` (1 MiB), so Git streamed it with chunked encoding, which the server rejected. The final `Everything up-to-date` came from a ref check after the connection had dropped. `git ls-remote` showed the truth.
- **`--amend` replaces only the newest commit.** Earlier commits, the format commit included, keep their hashes.
- **Symlinks store a path.** `readlink` prints that path; `head` follows it and proves it resolves. The old `AGENTS.md` pointed through `docs → ../arkive/sources/docs`, which a fresh clone didn't have; that's what `setup-docs.mjs` existed for.
- **`git rm --cached`** stops tracking a file and leaves it on disk, but a *pull* that removes a tracked file deletes it from the other machine's working tree. Back up first.

## pnpm and Prettier

- **Prettier finds the config near the file, but loads plugins from where it runs.** The error named a made-up `noop.js` at the repo root as the import base. lint-staged runs at the root, so `prettier-plugin-astro` had to be a root dependency.
- **pnpm doesn't hoist.** Each package sees only what it declares. Under Arkive's npm layout the plugin would have been hoisted and worked by accident.
- **Nearest config wins, no merging (Prettier); every file adds (Git).** `.prettierignore` counts only in the folder Prettier runs from.
- **Content got formatted before it was ignored.** Until `content/` was in `.prettierignore`, staging a writing let lint-staged strip its trailing blank lines (D216). The commit was amended with `--no-verify`, the one place that flag was right.
- **An editor plugin isn't a repo rule.** Pratik's import sorter moved header comments below imports. Sidekick's ESLint has `import-x/first`, not `import-x/order`, so nothing in CI checks import order.
- **`minimumReleaseAge`:** `pnpm add wrangler` installed 4.159.0 because 4.160.0 was 17 hours old. pnpm skips releases younger than a day by default.
- **`.npmrc` settings are dead.** `save-exact=true` didn't stop pnpm writing `^4.159.0`. pnpm 11 and later read settings from `pnpm-workspace.yaml`; `.npmrc` is for registry and auth only. It was deleted in #47.
- **Peers resolve from the package's own dependencies.** `@astrojs/check` needs TypeScript as a peer, so the site declares `typescript` itself. And `astro check` passed *without* `@types/node`: Astro's types pull in Vite's, Vite's `index.d.ts` says `/// <reference types="node" />`, and pnpm satisfied Vite's optional `@types/node` peer with the App's copy. The brief's "two errors" came from Arkive, where that chain didn't exist. The site declares `@types/node` anyway, because it imports `node:fs` itself.

## Turbo

- **The cache key** is a hash of the package's git-tracked files (`$TURBO_DEFAULT$`), declared env vars, lockfile entries and the hashes of the tasks it depends on. A match replays logs and outputs without running anything, which would also skip the gates inside a build script.
- **`$TURBO_ROOT$`** anchors an input glob at the repo root (Turbo 2.5); `../../content/**` works but depends on folder depth.
- **A `package#task` entry replaces the generic task**, so repeat `dependsOn` and `outputs`.
- **Folder input vs declared dependency.** PR 1's `inputs` line was a fact only Turbo knew. PR 3's `"@sidekick/content": "workspace:*"` lives in the package graph that pnpm, Turbo and Vercel all read. A package with no `build` script is a *transit node*: nothing runs, but its file hash still feeds dependents.
- **Since PR 3 the site uses the shared `build` task,** so its cache key includes the App's env vars. A key rotation rebuilds the site too. Harmless.

## Content, guards and CI

- **The guard checks shape, not code.** ESLint and Prettier never look at `content/`, so an allowlist script does: Markdown and images under `docs/` and `writings/`, `LICENSE`, and a four-key `package.json`. It reads git's index (`ls-files -z`, `show :path`) so it sees what's being committed, not `.obsidian/` on disk. It lives at the repo root: inside `content/` it would fail its own check, and a content-only PR could loosen it.
- **Prove the pass case first.** Pratik's first version crashed (`.forEach` returns `undefined`), and a crash also exits 1, so a failure-only test would have looked green.
- **The labeler:** `all-globs-to-all-files` matches only when *every* changed file is under `content/`. `pull_request` (not `_target`) lets the workflow run on the PR that adds it. Creating the label by hand keeps the job to `pull-requests: write`.
- **Vercel's skip** works on the package graph: the App never depends on `@sidekick/content`. The **first push of a new branch still built**; the second content-only push showed "Skipped - Not affected". Vercel's docs don't spell this out; it's observed.
- **CI still runs on content PRs, on purpose.** Content is what the privacy and datum gates and `check:content` exist for, and a required check that a path filter stops from running blocks the PR forever. What's wasted is building everything else; `turbo --affected` is backlog B10.
- **No split pipelines, no ban on mixed PRs** (Pratik asked, 2026-11-11). Two pipelines would mean two required checks that each block the other's PRs, and banning mixed PRs would undo D229, the reason for one repo.

## Hosting

- **A Worker with static assets** serves a folder with no code: no `main` in `wrangler.jsonc`. `_redirects` and `_headers` in `dist/` work as on Pages. `not_found_handling: "404-page"` returns `404.html` with status 404, and `auto-trailing-slash` answers `/foo` with a 307 (Pages used 308).
- **`previews: {}` is required.** Previews take only what that block declares (compatibility settings and `assets` stay top level). Branch URLs are `<branch>-sidekick-www.<subdomain>.workers.dev` (D233).
- **Workers Builds runs at the repo root** so pnpm sees the workspace; the commands aim at the site with `--filter` and `-C apps/www`. Watch paths decide whether a commit builds at all. No `NODE_VERSION` or `PNPM_VERSION`: one source of truth each.
- **Compare response headers, not just pages.** The sitemap diff was empty and every path returned 200, yet the Worker was missing `nosniff` and the referrer policy that Pages added by default. `_headers` (#45) keeps them. `nosniff` stops type sniffing (a file only runs as script if it's served as script); `strict-origin-when-cross-origin` sends other sites the origin, not the path. Pages' `Access-Control-Allow-Origin: *` was dropped on purpose.
- **A hostname belongs to one thing,** so the move was release → delete the CNAMEs → attach, with a few minutes' gap. `www.arkive.blog` was a second custom domain and had to move too. The Workers Domains list has no "Active" badge; `curl` is the check. The Worker is recognisable by `text/html` without a charset and the 307.

## Decisions Pratik made

- Keep squash merges as the default; a rebase merge only for a PR whose separate commits should stay on `main`.
- `.vscode/` stays off GitHub: untracked and ignored (#41), since #37 and #38 had committed it.
- A coding standard: camelCase for variables and functions, as for CSS class names; SCREAMING_SNAKE_CASE only for configuration constants (rule 7 in [[08-ai-coding-harness/coding-standards|coding standards]]).
- `apps/app/src/app` has too many `app`s; revisit later (backlog B12). Next.js fixes the `app` folder name.
