# Cloudflare Pages deployment

Complete these steps in the [Cloudflare dashboard](https://dash.cloudflare.com/) → **Workers & Pages** → your **arkive** project.

## Source & build

| Setting | Value |
|--------|--------|
| Git repository | `mehtapratik/arkive` |
| Production branch | `main` |
| Framework preset | None |
| Build command | `bash scripts/cf-build.sh` |
| Build output directory | `dist` |
| Root directory | `/` |

## Environment variables (Production)

| Name | Value |
|------|--------|
| `NODE_VERSION` | `22.12.0` |
| `SIDEKICK_BRANCH` | `main` |

Do **not** set `NODE_ENV=production` (build needs `sharp` from devDependencies).

## Deploy hook (sidekick → ARKIVE rebuild)

1. **Settings → Builds & deployments → Deploy hooks** → Create hook `sidekick-docs-rebuild` (branch `main`).
2. Copy the hook URL.
3. In **mehtapratik/sidekick** → **Settings → Secrets → Actions**, add secret `CF_PAGES_DEPLOY_HOOK` with that URL.

The workflow [trigger-arkive-deploy.yml](https://github.com/mehtapratik/sidekick/blob/main/.github/workflows/trigger-arkive-deploy.yml) POSTs to this hook when `docs/**` changes on `main`.

## Verify production

After the first successful deploy:

- https://arkive.blog/ — hero post (kickoff), ARKIVE wordmark
- https://arkive.blog/essays/kickoff/
- https://arkive.blog/rss.xml
- https://arkive.blog/llms.txt
- Search (⌘K) — Pagefind under `/pagefind/`

Build log checkpoints: clone sidekick → `Ingested N posts` → `astro build` → `pagefind`.
