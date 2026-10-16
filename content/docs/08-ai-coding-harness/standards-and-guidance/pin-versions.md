---
publish: false
id: harness.standards-and-guidance.pin-versions
created: 2026-10-15
updated: 2026-10-15
---

# Pin every version

Everything that builds, tests, or runs Sidekick has a pinned version. Nothing resolves to "latest" at install or run time. A version changes only through a commit, so a behavior change always has a diff to explain it.

How strictly to pin depends on whether something already records the exact version:

| What | Pin | Where |
| --- | --- | --- |
| npm dependencies | Semver range in `package.json`; the exact version comes from the lockfile | `pnpm-lock.yaml`, installed with `--frozen-lockfile` in CI |
| Package manager | Exact version and hash | `packageManager` in `package.json` (Corepack) |
| Runtimes and system tools without a lockfile (Node, PostgreSQL) | Major version; minor and patch float | CI workflow, scripts (e.g. `PG_MAJOR` in `tests/with-test-db.sh`) |
| CI machine image | Exact image, never `-latest` | `runs-on: ubuntu-24.04` |
| GitHub Actions | First-party `actions/*`: major tag (`@v7`). Third-party: full commit SHA | Workflow files |

**Why runtimes pin only the major version:** minor and patch releases of Node and PostgreSQL are bug and security fixes. Production platforms apply them automatically — Supabase updates PostgreSQL 17.x without asking — so pinning an exact patch locally would make development and CI drift away from production and delay security fixes. Major versions change behavior and need a deliberate upgrade.

**Why third-party actions pin a commit SHA:** a tag can be moved to different code after you adopt it. A SHA cannot, so a compromised third-party action cannot change what CI runs.

## Rules

1. **Match production.** Where a production platform decides the version, local and CI pin to that major. Supabase runs PostgreSQL 17, so tests use 17 — not whatever the machine happens to have.
2. **Fail loudly on a mismatch.** Scripts check the major version and stop with an install hint instead of quietly running with another version.
3. **Upgrade deliberately.** Changing a pinned version is its own commit, reviewed like code.
