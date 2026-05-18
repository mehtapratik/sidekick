#!/usr/bin/env bash
# Cloudflare Pages build — clones latest sidekick docs then builds ARKIVE.
set -euo pipefail

SIDEKICK_REPO="${SIDEKICK_REPO:-https://github.com/mehtapratik/sidekick.git}"
SIDEKICK_BRANCH="${SIDEKICK_BRANCH:-main}"

if [[ -z "${DOCS_ROOT:-}" ]]; then
  echo "Cloning sidekick (${SIDEKICK_BRANCH})…"
  rm -rf /tmp/sidekick
  git clone --depth 1 --branch "${SIDEKICK_BRANCH}" "${SIDEKICK_REPO}" /tmp/sidekick
  export DOCS_ROOT=/tmp/sidekick/docs
fi

echo "Using DOCS_ROOT=${DOCS_ROOT}"
npm ci
npm run build
