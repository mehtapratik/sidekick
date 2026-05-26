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
  export SIDEKICK_GIT_ROOT=/tmp/sidekick
fi

echo "Using DOCS_ROOT=${DOCS_ROOT}"
if [[ -n "${SIDEKICK_GIT_ROOT:-}" ]]; then
  echo "Using SIDEKICK_GIT_ROOT=${SIDEKICK_GIT_ROOT}"
fi
npm ci
npm run build
