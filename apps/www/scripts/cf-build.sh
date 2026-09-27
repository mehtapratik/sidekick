#!/bin/bash
# Cloudflare build. Content is ingested locally and committed (src/content,
# the src/lib manifests, public/vault-assets): ingest reads `updated` dates
# from git history, which a shallow CI clone doesn't have. Everything here
# is derived from committed files only.
set -e

node scripts/generate-og.mjs
node_modules/.bin/astro build
node_modules/.bin/pagefind --site dist
node scripts/check-privacy-gate.mjs
