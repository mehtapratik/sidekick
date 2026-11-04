---
publish: true
id: prd.synergy.one-repo.ticket-03
title: Vercel Skips Content-Only Commits
created: 2026-11-03
kind: plan
type: research
blocked_by: []
status: closed
assignee: claude
tags:
   - prd
   - synergy
   - one-repo
   - wayfinder
---

## Question

Once docs live beside the code, most commits touch only `content/`. How does Vercel skip building `apps/web` for them (Ignored Build Step, `turbo-ignore`, or project settings), and does it still build when a shared package the app depends on changes?

## Resolution

Researched 2026-11-03; full findings with sources in the project files at `one-repo/research/03-vercel-skip-content-commits.md`.

- **Use Vercel's built-in "Skip deployment"** for the `apps/web` project (Settings, Build and Deployment, Root Directory). A skipped deployment takes no build slot and no deployment quota; a build cancelled by an Ignored Build Step takes both.
- **It needs `content/` to be a workspace package.** Vercel counts a change outside the workspace as global and deploys every app, so a bare `content/` folder would still build `web`. `apps/www/` is already inside `apps/*`. This means `content` joins `pnpm-workspace.yaml` with its own `package.json`, and `apps/www` depends on it. That is now a step for [Lesson 0: the Import](one-repo-04-lesson-0-import.md) to decide.
- **Not `turbo-ignore`:** it is deprecated, and its `--fallback=HEAD^1` can skip wrongly when the last deploy is outside Vercel's 10-commit clone.
- **Fallback** if `content/` stays outside the workspace: Ignored Build Step `npx -y turbo@2.11.10 query affected --base=$VERCEL_GIT_PREVIOUS_SHA --packages web --exit-code`, tested locally (skips `content/`, `apps/www` and README changes; builds on `packages/core` or `apps/web`; builds on a branch's first deploy).
- **Still to confirm on Vercel:** whether the existing project already has the switch on (default only for projects created after Feb 2025), and that one content-only push skips `web`.
