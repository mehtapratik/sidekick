---
publish: true
id: build.phase-3.lesson-0
title: "Synergy Lesson 0 Walkthrough: One Repo"
created: 2026-11-11
updated: 2026-11-11
kind: guidance
version: 1.0.0
tags:
   - build
   - walkthrough
   - phase-3
   - monorepo
   - one-repo
   - git
   - cloudflare
status: completed
applies_to:
   - "[[04-phases/03-synergy/00-lessons/lesson-0-one-repo/00-brief]]"
---

# Synergy Lesson 0 Walkthrough — One Repo

This guide reproduces [[04-phases/03-synergy/00-lessons/lesson-0-one-repo/00-brief|lesson 0]] of [[04-phases/03-synergy/00-plan|Phase 3]] step by step. Arkive's docs, writings and site move into the Sidekick repo with their full history, `apps/web` becomes `apps/app`, and arkive.blog is served by a Cloudflare Worker built from Sidekick's `main`. It implements the [[02-prd/03-features/01-synergy/09.prd.features.synergy.one-repo|One Repo]] PRD (D213 to D217, D220, D221, D226) and the [[02-prd/03-features/01-synergy/spec#One Repo|spec's One Repo section]].

It shipped as [sidekick#34](https://github.com/mehtapratik/sidekick/pull/34) (the import, a merge commit), [#35](https://github.com/mehtapratik/sidekick/pull/35) (the rename), [#38](https://github.com/mehtapratik/sidekick/pull/38) and [#39](https://github.com/mehtapratik/sidekick/pull/39) (the content package and its guard), [#43](https://github.com/mehtapratik/sidekick/pull/43) (the site's type check), [#44](https://github.com/mehtapratik/sidekick/pull/44) (the Worker config) and [#45](https://github.com/mehtapratik/sidekick/pull/45) (security headers), then a hosting step in the Cloudflare dashboard. What was learned along the way is in [[04-phases/03-synergy/00-lessons/lesson-0-one-repo/02-notes|the notes]].

Every step explains what you are doing and why. Run everything from the Sidekick repo root unless a step says otherwise.

---

## Step 0 — Freeze Arkive

> **What and why:** Nothing may land in Arkive once its history has been copied, or the copy goes stale. Archiving makes the repo read-only, keeps every URL (old PR links included) and can be undone.

1. Merge or close any open Arkive PR first. An archived repo can't merge anything, and only what's on `main` gets imported.
2. Set the description before archiving, because an archived repo's settings are read-only too:

```bash
gh repo edit mehtapratik/arkive --description "Moved to mehtapratik/sidekick"
```

```bash
gh repo archive mehtapratik/arkive --yes
```

3. Install the history-rewriting tool (it needs Git 2.36 or later):

```bash
brew install git-filter-repo
```

The old Cloudflare Pages project keeps serving its last deployment, so arkive.blog stays up until the hosting step.

---

## PR 1 — The Import (the one merge commit)

### Step 1 — Rewrite a throwaway clone

> **What and why:** A commit is a snapshot of the whole tree plus its parent's hash, so moving files *in the past* means writing new commits with new hashes. That is done on a fresh clone, never on GitHub: the archived Arkive keeps its original hashes forever.

```bash
cd ~/Projects && git clone https://github.com/mehtapratik/arkive.git arkive-rewrite && cd arkive-rewrite
```

```bash
git filter-repo --to-subdirectory-filter apps/www --path-rename apps/www/sources/docs/:content/docs/ --path-rename apps/www/sources/writings/:content/writings/
```

`--to-subdirectory-filter apps/www` moves the root into `apps/www/`. The two `--path-rename`s then run in order on those new paths. Files that only exist in old commits (`design/`, `.idea/`) stay under `apps/www/` in history. filter-repo refuses to run on a clone that isn't fresh and removes the `origin` remote, so the rewrite can't be pushed over the real repo by accident.

Check it:

```bash
git ls-tree -d --name-only HEAD apps content
```

```bash
git log --oneline --follow -- content/docs/04-phases/living-plan.md
```

### Step 2 — Merge the unrelated histories

> **What and why:** The two repos share no commit, so there is no merge base. `--allow-unrelated-histories` merges against an empty tree. Step 1 made sure no path exists on both sides, so nothing conflicts. The merge commit has two parents, which keeps all of Arkive's commits reachable from `main`; a squash would flatten them into one.

```bash
cd ~/Projects/sidekick && git switch main && git pull && git switch -c chore/one-repo-import
```

```bash
git remote add arkive ../arkive-rewrite && git fetch arkive
```

```bash
git merge --allow-unrelated-histories --no-ff arkive/main
```

Message: `chore: import Arkive's docs, writings and site with full history`.

```bash
git remote remove arkive && git log --oneline --graph -4
```

Husky only has a `pre-commit` hook, and a merge without conflicts runs `pre-merge-commit`, so Prettier doesn't touch the 400 imported files here. The reformat gets its own commit in step 6.

### Step 3 — Make the site a workspace package

> **What and why:** `pnpm-workspace.yaml` already globs `apps/*`. The site needs Sidekick's package shape: one lockfile for the whole workspace, the `@sidekick/` scope, Node `24.x` like every package (`engineStrict` checks every `engines` field), and caret ranges that Renovate keeps current with no new rules.

```bash
git rm apps/www/package-lock.json
```

In `apps/www/package.json`: `"name": "@sidekick/www"`, `"engines": { "node": "24.x" }`, `"@astrojs/rss": "^4.0.19"` and `"unist-util-visit": "^5.1.0"`.

Then add the Astro Prettier plugin **at the root**:

```bash
pnpm add -D -w prettier-plugin-astro@^0.14.1 && pnpm install
```

Prettier 3 finds the nearest *config* by walking up from each file, but it loads the *plugins* that config names from the directory it runs in. lint-staged runs from the root, and pnpm installs a package only where it's declared, so a plugin installed only in `apps/www` makes every commit fail with `Cannot find package 'prettier-plugin-astro'`.

```bash
pnpm ls -r --depth -1
```

Commit: `chore(www): make the site the @sidekick/www workspace package`.

### Step 4 — Point the site at `content/`

> **What and why:** The site reads Markdown from the repo root now. Turbo hashes only files inside a package, so without an extra input a content edit would replay a stale build and skip the privacy and datum gates.

`apps/www/src/lib/vault.mjs`:

```js
// pnpm, Turbo and Workers Builds run the site's scripts from apps/www, so the repo root is two levels up.
const REPO_ROOT = path.resolve(process.cwd(), '../..');
export const WRITINGS_DIR = path.join(REPO_ROOT, 'content/writings');
export const DOCS_DIR = path.join(REPO_ROOT, 'content/docs');
```

`apps/www/src/lib/tree.ts`: Astro stores each entry's `filePath` relative to the Astro project root, so it's now `../../content/docs/…`:

```ts
const rel = e.source.filePath?.replace(
   /^\.\.\/\.\.\/content\/docs\/[^/]+\//,
   '',
);
```

`turbo.json` gets a task of its own for the site (PR 3 replaces it):

```json
"@sidekick/www#build": {
   "dependsOn": ["^build"],
   "inputs": ["$TURBO_DEFAULT$", "$TURBO_ROOT$/content/**"],
   "outputs": ["dist/**"]
},
```

A `package#task` entry replaces the generic `build` entry for that package, so `dependsOn` and `outputs` are repeated.

Prove the cache, then the URLs:

```bash
pnpm turbo run build --filter=@sidekick/www --force && pnpm turbo run build --filter=@sidekick/www
```

The second run is `FULL TURBO`.

```bash
diff <(curl -s https://arkive.blog/sitemap.xml | grep -o '<loc>[^<]*' | sed 's|<loc>https://arkive.blog||' | sort) <(grep -o '<loc>[^<]*' apps/www/dist/sitemap.xml | sed 's|<loc>https://arkive.blog||' | sort)
```

It prints nothing. Commit: `chore(www): read content from content/ and hash it into the site's build`. Check the diff before committing: an editor's import sorter can move a file's header comment below an import, and staged files under `content/` would still be reformatted by Prettier until step 5.

### Step 5 — Inherit the root config

> **What and why:** Git merges every `.gitignore` from the root down; Prettier uses only the nearest config and never merges. While `apps/www/.prettierrc` existed, the root config never applied to the site.

```bash
git rm apps/www/.gitignore apps/www/.prettierrc && pnpm remove --filter @sidekick/www prettier prettier-plugin-astro
```

Root `.gitignore`:

```
# astro, obsidian and local agent settings
.astro/
.obsidian/
.claude/settings.local.json
```

Root `.prettierrc.json` gains:

```json
"plugins": ["prettier-plugin-astro"],
"overrides": [{ "files": "*.astro", "options": { "parser": "astro" } }]
```

Root `.prettierignore` gains:

```
# Obsidian writes the vault (D216)
content/

# The site ships these as given
apps/www/public/arkive.css
apps/www/public/arkive.js
apps/www/public/fonts/
apps/www/public/icons/
apps/www/src/shiki-themes.mjs
```

Commit: `chore(www): inherit the root Prettier and Git config`.

### Step 6 — One format commit, skipped in blame

```bash
pnpm prettier --write apps/www && pnpm turbo run build --filter=@sidekick/www
```

Commit: `style(www): format the site with the root Prettier config`. Then add its hash to `.git-blame-ignore-revs` in a second commit (a commit can't contain its own hash), and point local blame at the file:

```
# style(www): format the site with the root Prettier config
<git rev-parse HEAD of the format commit>
```

```bash
git config blame.ignoreRevsFile .git-blame-ignore-revs
```

Because PR 1 is merged with a merge commit, the format commit keeps this hash on `main`. Don't amend or rebase it afterwards.

### Step 7 — Agent notes, the symlink and the glossary

```bash
git mv apps/www/CLAUDE.md apps/www/AGENTS.md && git rm apps/www/.claude/launch.json
```

Update `apps/www/AGENTS.md` for pnpm (`pnpm --filter @sidekick/www dev`, `pnpm turbo run build --filter=@sidekick/www`, `pnpm --filter @sidekick/www preview`), `content/` paths and Node 24. Arkive hashes it quotes no longer exist in Sidekick: find the same commit by its message (`c91121d` became `28ec684`).

```bash
ln -sfn content/docs/08-ai-coding-harness/agent-guide.md AGENTS.md && git rm docs scripts/setup-docs.mjs
```

Delete the `docs:setup` and `postinstall` scripts from the root `package.json`, then check the link resolves:

```bash
readlink AGENTS.md && head -3 AGENTS.md && pnpm install
```

Fold `apps/www/CONTEXT.md` into seven glossary pages in `content/docs/07-glossary/` (`sidekick`, `app`, `public-site`, `entry`, `writing`, `doc`, `about`), each `kind: glossary`, `id: glossary.<slug>`, tags `glossary` and `site`, ending with its _Avoid_ line, and `publish: false` so the sitemap stays unchanged. Delete `CONTEXT.md` and add D226 to the agent guide's "Always true".

### Step 8 — Two licences

```bash
curl -fsSL https://creativecommons.org/licenses/by-nc/4.0/legalcode.txt -o content/LICENSE
```

The README gains a Licence section: code under MIT (`LICENSE`), writings and docs under CC BY-NC 4.0 (`content/LICENSE`), fonts under their own licences beside the files.

### Step 9 — Fix the live docs the import made false

The README (no clone script, `apps/www` and `content/` in the tree), the agent guide (`content/docs/` paths, the same-PR rule), "docs PR" instead of "arkive PR" in the Synergy plan and the lesson 1 brief, `content/docs/02-prd/` in the four later phase plans, and `apps/www/AGENTS.md` in Violations and exceptions. The Front Door hardening walkthrough gets a post note that `setup-docs` is gone. Finished walkthroughs keep their text.

### Merge PR 1 with a merge commit

1. Push. A push this size can fail over HTTPS with `HTTP 400`; raise the buffer for the repo and push again:

```bash
git config http.postBuffer 52428800 && git push -u origin chore/one-repo-import
```

2. Turn merge commits on in **both** places, because `main` is squash-only in both: **Settings → General → Pull Requests → Allow merge commits**, and the "Prevent Direct Changes In Default Branch" ruleset's **Allowed merge methods**.
3. Merge with a merge commit and a Conventional subject, then turn both settings back to squash only:

```bash
gh pr merge --merge --subject "chore: import Arkive's docs, writings and site with full history (#34)"
```

4. Check: `git log --oneline --graph -3` shows two parents, and `git log --oneline --follow -- content/docs/04-phases/living-plan.md` reaches Arkive's commits.

> **Post note (2026-11-08):** #34 was squash-merged by mistake, which left one parent and no Arkive history on `main`. The tree was identical, so it was repaired by rebuilding the same merge commit on the squash's parent (`git reset --hard f94c5ad`, `git merge --no-ff chore/one-repo-import`), checking `git diff 5846ebc HEAD` was empty, and force-pushing once with `--force-with-lease=main:5846ebc` while the ruleset was disabled for a minute. `main` is now `8825103`. Merging the branch again on top of the squash would not have worked: Git's history simplification follows the first parent whose files match, so `log --follow` and `blame` would still have stopped at the squash.

**Done when:** CI is green, `git log --follow` on a doc shows its Arkive commits, and the sitemap diff prints nothing.

---

## PR 2 — Rename `apps/web` to `apps/app`

```bash
git switch -c refactor/rename-web-to-app && git mv apps/web apps/app
```

- `apps/app/package.json`: `"name": "@sidekick/app"`.
- `eslint.config.js`: the `apps/web/**` globs and `rootDir: 'apps/web'` become `apps/app`. If one is missed, the Next.js and React Hooks rules silently stop applying while lint still passes.
- `.prettierignore`, the `no-barrel-exports` comment and the README.
- `pnpm install` (the lockfile keys packages by folder), then `pnpm turbo run lint typecheck build test --force`.
- Live vault pages that name `apps/web` (a separate copy commit). Plans and walkthroughs of finished phases keep it.
- **Vercel → Settings → Build and Deployment → Root Directory: `apps/app`**, before merging, then redeploy the PR's preview. The setting applies to every deployment.

**Done when:** CI and the Vercel preview are green and `pnpm --filter @sidekick/app dev` opens the App.

---

## PR 3 — Content-only commits

### `content/` becomes `@sidekick/content`

`content/package.json` holds only four keys (D259):

```json
{
   "name": "@sidekick/content",
   "version": "0.0.0",
   "private": true,
   "license": "CC-BY-NC-4.0"
}
```

`pnpm-workspace.yaml` lists `'content'`, `apps/www/package.json` depends on `"@sidekick/content": "workspace:*"`, and the `@sidekick/www#build` entry leaves `turbo.json`. `content` has no `build` script, so Turbo makes it a *transit node*: it runs nothing, but its file hash feeds the site's build hash through `^build`. Prove it without building:

```bash
echo >> content/writings/writings.margins.md && pnpm turbo run build --filter=@sidekick/www --dry | grep -A4 '^@sidekick/www#build'; git checkout content/writings/writings.margins.md
```

It shows `Cached (Local) = false`.

### Label content-only PRs

```bash
gh label create content --color 0E8A16 --description "Every changed file is under content/"
```

`.github/labeler.yml`:

```yaml
# A PR whose every changed file is under content/ is a content-only PR (D215)
content:
   - changed-files:
        - all-globs-to-all-files: 'content/**'
```

`.github/workflows/labeler.yml`:

```yaml
name: Labeler

on:
   pull_request:

# Labelling writes to the PR, so unlike CI this job needs a write scope
permissions:
   contents: read
   pull-requests: write

jobs:
   label:
      runs-on: ubuntu-26.04
      timeout-minutes: 5
      steps:
         # Removes the label again when a later push adds a file outside content/
         - uses: actions/labeler@v7
           with:
              sync-labels: true
```

Creating the label by hand keeps the job to one scope: creating a missing label would also need `issues: write`.

### Guard the folder's shape

`scripts/check-content.mjs`, at the repo root (inside `content/` it would fail its own check):

```js
// content/ holds content only (D259): Markdown and images under docs/ and
// writings/, plus LICENSE and a package.json with no code keys. It reads git's
// index, so the pre-commit hook checks exactly what is about to be committed.
import console from 'node:console';
import { execFileSync } from 'node:child_process';
import process from 'node:process';

const ROOT_FILES = new Set(['content/LICENSE', 'content/package.json']);
const CONTENT_FILE =
   /^content\/(docs|writings)\/.+\.(md|svg|png|jpe?g|gif|webp)$/;
const PACKAGE_KEYS = new Set(['name', 'version', 'private', 'license']);

const git = (...args) => execFileSync('git', args, { encoding: 'utf-8' });

const files = git('ls-files', '-z', 'content').split('\0').filter(Boolean);

const problems = (function () {
   const invalidFiles = files
      .filter((file) => !ROOT_FILES.has(file) && !CONTENT_FILE.test(file))
      .map((file) => `${file}: only Markdown and images belong in content/`);

   // `:path` is the staged copy, the same version as the file list above
   const manifest = JSON.parse(git('show', ':content/package.json'));
   const invalidKeys = Object.keys(manifest)
      .filter((key) => !PACKAGE_KEYS.has(key))
      .map((key) => `content/package.json: "${key}" is not allowed`);
   return [...invalidFiles, ...invalidKeys];
})();

if (problems.length > 0) {
   console.error(`check:content failed:\n  ${problems.join('\n  ')}`);
   process.exit(1);
}
console.log(`check:content ok: ${files.length} files.`);
```

Root `package.json`: `"check:content": "node scripts/check-content.mjs"`. CI runs `pnpm check:content` after `prettier:check`, and `.husky/pre-commit` runs it after lint-staged. Prove the pass case first, then the failures:

```bash
pnpm check:content
```

```bash
echo "export {}" > content/index.ts && git add content/index.ts && pnpm check:content; git rm -q --cached content/index.ts && rm content/index.ts
```

### Vercel skips content-only commits

**Vercel → the App's project → Settings → Build and Deployment → Root Directory → "Skip deployments when there are no changes to the root directory or its dependencies".** Vercel reads the same package graph: `apps/app` never depends on `@sidekick/content`.

**Done when:** a throwaway content-only PR gets the `content` label and Vercel reports "Skipped - Not affected", and a staged `content/index.ts` fails `check:content`. The first push of a new branch still builds; check a second content-only push on the same branch.

---

## PR 4 — Type-check the site

```bash
pnpm add -D --filter @sidekick/www @astrojs/check typescript@^6.0.3 @types/node@^24.19.2
```

`apps/www/package.json` scripts: `"typecheck": "astro check"`. The root `pnpm typecheck` runs `turbo typecheck`, so CI picks the site up with no workflow change. TypeScript is declared in the site because `@astrojs/check` needs it as a peer, and pnpm resolves peers from the package's own dependencies. `@types/node` is declared because the site imports `node:fs` and `node:path` itself.

```bash
pnpm --filter @sidekick/www typecheck && pnpm turbo run typecheck --force
```

**Done when:** CI's typecheck step shows `@sidekick/www:typecheck` with 0 errors.

---

## PR 5 — Deploy the site on Workers

```bash
pnpm add -D --filter @sidekick/www wrangler
```

`pnpm-workspace.yaml` → `allowBuilds:` gains `workerd: true`. `apps/www/wrangler.jsonc`:

```jsonc
{
   "$schema": "node_modules/wrangler/config-schema.json",
   // The public site: static files only, no Worker script (D220)
   "name": "sidekick-www",
   "compatibility_date": "2026-11-10",
   "assets": {
      // What `astro build` writes; Workers Builds runs the build before deploying
      "directory": "./dist",
      // An unknown path gets dist/404.html with status 404
      "not_found_handling": "404-page",
   },
   // Each branch's Preview takes only what this block declares;
   // a static site needs nothing more, but the block must exist
   "previews": {},
}
```

```bash
git rm apps/www/scripts/cf-build.sh
```

The root `.gitignore` gains `.wrangler/`, and the site's `AGENTS.md` names the Workers Builds commands. Prove the config without deploying:

```bash
pnpm turbo run build --filter=@sidekick/www && pnpm -C apps/www exec wrangler deploy --dry-run
```

### Keep the headers Pages added ([#45](https://github.com/mehtapratik/sidekick/pull/45))

Pages added two security headers by default; a Worker adds none. `apps/www/public/_headers` (a file, copied to `dist/`):

```
/*
  X-Content-Type-Options: nosniff
  Referrer-Policy: strict-origin-when-cross-origin
```

Pages' third default, `Access-Control-Allow-Origin: *`, is left out on purpose: nothing reads the site's files from another origin.

---

## Hosting — arkive.blog builds from Sidekick

### Step 1 — Create the Worker from the repo

**Workers & Pages → Create → Workers → Import a repository → `mehtapratik/sidekick`:**

| Setting                       | Value                                                                                                   |
| ----------------------------- | ------------------------------------------------------------------------------------------------------- |
| Project name                  | `sidekick-www` (must match `wrangler.jsonc`)                                                            |
| Root directory                | `/`                                                                                                     |
| Build command                 | `pnpm turbo run build --filter=@sidekick/www`                                                           |
| Deploy command                | `pnpm -C apps/www exec wrangler deploy`                                                                 |
| Non-production branch deploys | on, with `pnpm -C apps/www exec wrangler preview` (replace the pre-filled `npx wrangler preview`)      |
| Build watch paths (include)   | `apps/www/*`, `content/*`, `pnpm-lock.yaml`, `package.json`, `pnpm-workspace.yaml`, `turbo.json`        |
| Environment variables         | none (Node comes from `.nvmrc`, pnpm from `packageManager`)                                              |

The first build deploys `main` to `https://sidekick-www.<subdomain>.workers.dev`; branches get `<branch>-sidekick-www.<subdomain>.workers.dev`.

### Step 2 — Check the Worker before it gets the domain

Save arkive.blog's sitemap paths as the baseline, then compare the Worker:

```bash
W=https://sidekick-www.<subdomain>.workers.dev
diff <(curl -s https://arkive.blog/sitemap.xml | grep -o '<loc>[^<]*' | sed 's|<loc>https://arkive.blog||' | sort) <(curl -s $W/sitemap.xml | grep -o '<loc>[^<]*' | sed 's|<loc>https://arkive.blog||' | sort)
```

```bash
curl -s -o /dev/null -w "%{http_code}\n" $W/no-such-page/
```

The diff prints nothing, every sitemap path returns 200, the made-up path returns 404, and `curl -sI $W/` shows the two headers from `_headers`. Also compare the response headers with arkive.blog's: that's how the missing Pages defaults were found.

### Step 3 — Move the domains

1. The old `arkive` Pages project → **Custom domains** → remove `arkive.blog` and `www.arkive.blog`. Downtime starts.
2. The `arkive.blog` zone → **DNS** → delete any CNAMEs for those names that point to `arkive.pages.dev`.
3. `sidekick-www` → **Settings → Domains & Routes → Add → Custom domain**: `arkive.blog`, then `www.arkive.blog`. Cloudflare creates the records and certificates. The Domains list shows no status badge; check with `curl` instead.
4. The old project → **Settings → Build → Automatic deployments: Disabled**. Keep the project as the rollback until the cutover.

**Exit check:** arkive.blog and `www.arkive.blog` answer from the Worker (no charset on `text/html`, 307 for a missing trailing slash where Pages sent 308, the two `_headers` lines), the sitemap diff against the saved baseline is empty, all 242 paths return 200, and a made-up path returns 404.

---

## After the lesson

- Point Obsidian at `~/Projects/sidekick/content/docs`, then delete `~/Projects/arkive` (after moving its untracked `design/` handover to the project's shared files if it isn't there) and `~/Projects/arkive-rewrite`.
- Follow-ups are in [[04-phases/backlogged-unplanned|the backlog]] (B10, B12). Three more were cleared right after the lesson in [#47](https://github.com/mehtapratik/sidekick/pull/47): `.npmrc` deleted, the General Sans and Sentient licences added, `apps/www/.node-version` deleted.
