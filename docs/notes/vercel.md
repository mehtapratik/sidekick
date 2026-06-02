---
title: Vercel
---

# Vercel — Hosting and Observability

This document covers what Vercel provides out of the box and where its built-in capabilities are sufficient vs. where a dedicated tool (like Sentry) becomes necessary.

---

## What Vercel Is

Vercel is a cloud platform optimised for deploying frontend and full-stack JavaScript applications. It handles:

- **Build** — runs `next build` on every push (or on demand) and produces deployable artifacts
- **CDN** — serves static assets (JS, CSS, images) from edge nodes close to users worldwide
- **Serverless functions** — each Next.js Route Handler and Server Component renders as a serverless function in a specific region
- **Edge runtime** — `proxy.ts` runs in Vercel's Edge Network, a lightweight V8 runtime that executes before your serverless functions

Vercel's model for Next.js is: static assets go to the CDN, dynamic pages and API routes become serverless functions. You never manage servers.

---

## Vercel's Built-In Logging

### Runtime logs from `console.*`

Every `console.log`, `console.warn`, `console.error`, and `console.info` call that runs during a serverless function execution is captured by Vercel and surfaced in the project dashboard under **Logs**.

This includes:
- Server Component rendering
- Route Handler execution
- `proxy.ts` Edge function execution

Logs from browser-side code (Client Components) are **not** captured by Vercel — those only appear in the user's browser DevTools.

### What this gives you

Without any additional setup, you can:
- See what happened during a failing request
- See unhandled exceptions with their stack traces (Next.js serialises these to `console.error` automatically)
- Filter logs by deployment, function name, status code, and time range
- Tail live logs in real time from the dashboard

### The limitation

Vercel's log retention is short (hours to a day on the free plan; configurable on paid plans). Logs are not queryable — you cannot write `SELECT * FROM logs WHERE user_id = '...'`. There is no alerting, no aggregation, no error grouping, no release tracking.

### Vercel as primitive instrumentation

During early development, Vercel's logging is sufficient. Strategic `console.error` calls on caught exceptions give you enough signal to diagnose production issues:

```ts
try {
  await db.insert(profiles).values({ id: user.id, email: user.email! })
} catch (err) {
  console.error('[profiles] insert failed', { userId: user.id, err })
  throw err
}
```

This is not a permanent solution — it is a deliberate deferral. Once the product stabilises, a structured observability layer (Sentry, Datadog, etc.) replaces these `console.error` calls with proper error tracking, session replay, and alerting. The advantage of deferring: you do not spend time configuring Sentry for an app that is still changing shape every week.

---

## Environment Variables on Vercel

Vercel provides a first-class UI for managing environment variables per environment (Production, Preview, Development). Variables are injected into the build process and serverless function runtime.

### Two kinds of variables

**Build-time (`NEXT_PUBLIC_*`):** Baked into the JavaScript bundle at build time. Available in browser code. You must redeploy to change them.

**Runtime (non-`NEXT_PUBLIC_*`):** Injected as `process.env` into serverless functions at request time. Changes take effect on the next deploy (or, for some Vercel plans, without a redeploy).

### The `.env.local` vs Vercel dashboard split

Locally, all variables live in `.env.local` at the repo root — loaded by `dotenv-cli` before scripts run.

On Vercel, variables are set in the dashboard. The `.env.local` file is gitignored and never deployed — Vercel has no access to it. This is the intended separation: local secrets stay local, production secrets stay in Vercel's encrypted store.

### Why the build command on Vercel is `next build` not `dotenv -e ../../.env.local -- next build`

The `dotenv -e ../../.env.local --` prefix in `apps/web/package.json`'s build script exists for local development only — to load the root `.env.local` into `next build` when running locally. On Vercel, the variables are already in the environment before the build runs, so `dotenv-cli` would fail (no `.env.local` file exists) and adds no value. The build command is overridden in the Vercel dashboard to just `next build`.

---

## Deployment Flow

1. Push to `main` (or open a PR) → Vercel starts a build
2. Vercel clones the repo, installs dependencies with `pnpm`, runs the build command
3. Output is uploaded to Vercel's infrastructure: static files to CDN, serverless function code to the target region
4. The deployment goes live at your domain (or a preview URL for PRs)

**Preview deployments:** Every PR gets a unique URL. This is one of Vercel's most useful features for collaborative review — you can share a working link before merging.

**Production deployments:** Only the `main` branch deploys to the production domain. All other branches get preview URLs.

---

## When to Move Beyond Vercel's Built-In Logging

Add a structured observability tool when:
- You need to track errors across user sessions (who was affected, how many users)
- You need to set up alerts (e.g. "email me when error rate exceeds 1%")
- You need to search and filter historical logs (more than a day old)
- You need to correlate frontend errors with backend errors
- You need performance monitoring (slow queries, slow renders)

The planned tool for Sidekick is **Sentry** — deferred to post-MVP. Until then, `console.error` on all caught exceptions in Route Handlers and Server Components provides basic visibility through Vercel's log viewer.
