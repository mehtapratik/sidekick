---
title: Checkpoint C
---

# Checkpoint C — Step-by-Step Walkthrough

> **Goal:** Verify `pnpm turbo build` and `pnpm turbo dev` work end-to-end from the monorepo root. Fix any build warnings. Add the root `README.md`.
>
> **Prerequisite:** Checkpoint B completed — lint and typecheck pipelines pass across all packages.

---

## Step 1 — Run `pnpm build` and check for warnings

```bash
pnpm build
```

If you see a warning like:

```
⚠ Warning: Next.js inferred your workspace root, but it may not be correct.
We detected multiple lockfiles and selected the directory of /Users/<you>/package-lock.json as the root directory.
Detected additional lockfiles:
  * /path/to/sidekick/apps/web/pnpm-workspace.yaml
  * /path/to/sidekick/pnpm-workspace.yaml
```

There are two causes to fix.

---

## Step 2 — Remove stray lockfiles

**Cause 1: `apps/web/pnpm-workspace.yaml`**

The Next.js scaffolder (`pnpm create next-app`) sometimes creates a `pnpm-workspace.yaml` inside `apps/web`. This file should not exist — the workspace is defined at the repo root only.

Check if it exists and delete it:

```bash
ls apps/web/pnpm-workspace.yaml  # if this prints a path, delete it
```

**Cause 2: stray `package-lock.json` higher up the directory tree**

If there's an npm `package-lock.json` in your home directory or a parent folder (created by accidentally running `npm install` somewhere), Next.js can pick it up. This is outside the repo so we can't remove it from here — but it can be addressed by fixing `next.config.ts` (Step 3).

---

## Step 3 — Set `turbopack.root` in `apps/web/next.config.ts`

Tell Next.js exactly where the monorepo root is so it stops guessing based on lockfile locations.

Update `apps/web/next.config.ts`:

```typescript
import type { NextConfig } from "next"
import path from "node:path"

const nextConfig: NextConfig = {
  turbopack: {
    root: path.resolve(__dirname, "../.."),
  },
}

export default nextConfig
```

**What `path.resolve(__dirname, "../..")` does:** `__dirname` is the directory of `next.config.ts` (i.e. `apps/web`). Going up two levels (`../..`) reaches the monorepo root. This gives Next.js an absolute path to the workspace root.

---

## Step 4 — Run `pnpm build` again

```bash
pnpm build
```

Expected output — no warnings, all 5 packages successful, with 4 coming from cache:

```
Tasks:    5 successful, 5 total
Cached:    4 cached, 5 total
```

The 4 cached packages are `packages/core`, `packages/ui`, `packages/cli`, and `packages/features-registry` — nothing changed in them, so Turbo replays their cached results. Only `apps/web` rebuilds because `next.config.ts` changed.

---

## Step 5 — Run `pnpm dev` and verify

```bash
pnpm dev
```

Open `http://localhost:3000` in your browser. The default Next.js page should load. Then press `Ctrl+C` to stop the server.

---

## Step 6 — Create `README.md`

Create `README.md` at the repo root covering:
- What Sidekick is (1–2 paragraph product description)
- Tech stack table
- Install, dev, build, lint, typecheck, format commands
- Workspace structure diagram
- Dependency rules (the `packages/*` → `apps/*` prohibition)
- How to add a new package
- How to add a new feature package
- Environment variables reference

---

## Checkpoint C Exit Criteria

- [ ] `pnpm turbo build` — 5 packages, clean, no warnings
- [ ] `pnpm turbo dev` — `apps/web` starts at `localhost:3000`
- [ ] `apps/web/next.config.ts` sets `turbopack.root`
- [ ] Root `README.md` exists

---

## What's Next

Checkpoint D adds the `.env.example` template, pushes to GitHub, and links the repo to Vercel.
