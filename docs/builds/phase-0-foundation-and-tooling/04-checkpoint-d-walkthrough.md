---
title: Checkpoint D
---

# Checkpoint D — Step-by-Step Walkthrough

> **Goal:** Add the environment variable template, push the repo to GitHub, and link it to Vercel so `apps/web` can be deployed.
>
> **Prerequisite:** Checkpoint C completed — `pnpm turbo build` and `pnpm turbo dev` pass cleanly.

---

## Step 1 — Create `.env.example`

Create `.env.example` at the repo root. This file is safe to commit — it contains no real values, only variable names and documentation.

```bash
# =============================================================================
# SIDEKICK — Environment Variables Template
# =============================================================================
# Copy this file to .env.local and fill in real values.
#
#   cp .env.example .env.local
#
# .env.local is gitignored and must never be committed.
# Variables marked [Phase N] are needed when that phase begins.
# =============================================================================


# -----------------------------------------------------------------------------
# Supabase [Phase 1]
# -----------------------------------------------------------------------------
# Found in: Supabase Dashboard → Project Settings → API

NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
DATABASE_URL=


# -----------------------------------------------------------------------------
# AI Providers [Phase 6]
# -----------------------------------------------------------------------------

ANTHROPIC_API_KEY=
OPENAI_API_KEY=


# -----------------------------------------------------------------------------
# Billing — Stripe [Phase 11]
# -----------------------------------------------------------------------------

STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=


# -----------------------------------------------------------------------------
# App [Phase 1]
# -----------------------------------------------------------------------------
# Set to http://localhost:3000 for local development.
# Set to your Vercel deployment URL in production.

NEXT_PUBLIC_APP_URL=
```

**Why commit this file?** `.env.example` serves as living documentation — it tells any developer (or your future self) exactly which environment variables the app needs, what they're for, and when they're needed. The real values live in `.env.local` which is gitignored.

**`NEXT_PUBLIC_` prefix:** Variables prefixed with `NEXT_PUBLIC_` are embedded into the browser bundle at build time. They are visible to end users. Never put secrets in `NEXT_PUBLIC_` variables.

Variables without this prefix are server-only — they exist in the Node.js process and are never sent to the browser.

---

## Step 2 — Make the initial commit

Check what will be committed:

```bash
git status
```

Stage everything:

```bash
git add .
```

Review what's staged:

```bash
git diff --staged --stat
```

Create the initial commit:

```bash
git commit -m "chore: Phase 0 — monorepo foundation and tooling"
```

---

## Step 3 — Create a GitHub repository

1. Go to [github.com/new](https://github.com/new)
2. Name it `sidekick`
3. Set visibility to **Private**
4. Do **not** initialize with README, `.gitignore`, or license — the repo already has these
5. Click **Create repository**

GitHub will show you the commands to push an existing repo. Follow the "push an existing repository" section:

```bash
git remote add origin git@github.com:<your-username>/sidekick.git
git branch -M main
git push -u origin main
```

---

## Step 4 — Link to Vercel

### 4.1 — Import the repository

1. Go to [vercel.com/new](https://vercel.com/new)
2. Click **Import Git Repository**
3. Select `sidekick`

### 4.2 — Configure monorepo settings

Vercel needs to know this is a monorepo and which app to deploy:

| Setting | Value |
|---|---|
| Framework Preset | Next.js (auto-detected) |
| Root Directory | `apps/web` |
| Install Command | `pnpm install` |
| Build Command | Leave as default — Vercel detects Turborepo and uses `turbo run build` automatically |

### 4.3 — Add environment variables

In the Vercel dashboard under **Environment Variables**, add all variables from `.env.example`. Use placeholder values for variables not needed yet (Phases 1+). Leave `NEXT_PUBLIC_APP_URL` empty for now — you'll get the stable URL after the first deploy.

### 4.4 — First deploy

Click **Deploy**. The first build will succeed but may show a warning:

```
Warning - the following environment variables are set on your Vercel project,
but missing from "turbo.json". These variables WILL NOT be available to your
application and may cause your build to fail.
```

This is expected — fix it in Step 5.

### 4.5 — Declare environment variables in `turbo.json`

Add an `env` array to the `build` task in `turbo.json`:

```json
"build": {
  "dependsOn": ["^build"],
  "outputs": ["dist/**", ".next/**"],
  "env": [
    "NEXT_PUBLIC_SUPABASE_URL",
    "NEXT_PUBLIC_SUPABASE_ANON_KEY",
    "SUPABASE_SERVICE_ROLE_KEY",
    "DATABASE_URL",
    "ANTHROPIC_API_KEY",
    "OPENAI_API_KEY",
    "STRIPE_SECRET_KEY",
    "STRIPE_WEBHOOK_SECRET",
    "NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY",
    "NEXT_PUBLIC_APP_URL"
  ]
}
```

Commit and push:

```bash
git add turbo.json
git commit -m "chore: declare env vars in turbo.json build task"
git push origin main
```

### 4.6 — Set `NEXT_PUBLIC_APP_URL`

After the first deploy, Vercel assigns a stable production URL to your project. Find it in **Settings → Domains** — it looks like `your-project-name.vercel.app`. This URL never changes between deployments.

Update `NEXT_PUBLIC_APP_URL` in Vercel's environment variables to:
```
https://your-project-name.vercel.app
```

This triggers a new deploy automatically.

> **Stable URL vs per-deployment URL:** Every Vercel deployment also gets a unique immutable URL (e.g. `sidekick-i6nvee84m-....vercel.app`). This is useful for rollbacks but is not the right value for `NEXT_PUBLIC_APP_URL`. Always use the stable project URL.

### 4.7 — The 403 in the Vercel deployment preview

The deployment details page in Vercel shows a preview of your app in an iframe. You may see a `403 Forbidden` error in this preview pane. This is **not a real error** — it's Vercel's own iframe being blocked by the app's security headers (`X-Frame-Options`). Click **Visit** to open the real URL and confirm the app loads correctly.

---

## Checkpoint D Exit Criteria

- [ ] `.env.example` committed to the repo
- [ ] Repo pushed to GitHub
- [ ] `turbo.json` declares all env vars in the `build.env` array
- [ ] Vercel project linked and `apps/web` builds without warnings
- [ ] `NEXT_PUBLIC_APP_URL` set to the stable Vercel production URL
- [ ] Visiting the production URL loads the app correctly

---

## What's Next

Phase 0 is complete. Phase 1 begins with Supabase project creation, database setup, authentication, and the login/signup UI.
