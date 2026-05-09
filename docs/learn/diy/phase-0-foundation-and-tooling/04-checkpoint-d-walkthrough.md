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
| Framework Preset | Next.js |
| Root Directory | `apps/web` |
| Build Command | `cd ../.. && pnpm build --filter=web` |
| Output Directory | (leave as default — Next.js handles this) |
| Install Command | `pnpm install` |

### 4.3 — Add environment variables

In the Vercel dashboard under **Environment Variables**, add all variables from `.env.example`. Use placeholder values for variables not needed yet (Phases 1+). Only `NEXT_PUBLIC_APP_URL` is meaningful now — set it to your Vercel deployment URL once it's assigned.

### 4.4 — Deploy

Click **Deploy**. Vercel will:
1. Clone the repo
2. Run `pnpm install` from `apps/web`
3. Run `next build`
4. Deploy the static output to its CDN

---

## Checkpoint D Exit Criteria

- [ ] `.env.example` committed to the repo
- [ ] Repo pushed to GitHub
- [ ] Vercel project linked and `apps/web` builds successfully in Vercel CI

---

## What's Next

Phase 0 is complete. Phase 1 begins with Supabase project creation, database setup, authentication, and the login/signup UI.
