#!/bin/bash
# Cloudflare build entry point. Everything is derived from committed files:
# `npm run build` runs astro build, then the privacy gate (scripts/check-privacy.mjs).
set -e

npm run build
