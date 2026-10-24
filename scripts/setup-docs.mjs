// Makes docs/ — and AGENTS.md, which links into it — resolve in a fresh clone.
//
// docs/ is a symlink to ../arkive/sources/docs: Sidekick's canonical docs live
// in the public Arkive repo. On a fresh machine or in a cloud agent
// environment that sibling checkout is missing, so agents would start without
// AGENTS.md or the plans. This script clones Arkive next to this repo,
// downloading only sources/docs.
//
// Runs on `pnpm install` (root postinstall); also: `pnpm docs:setup`.
// - Does nothing when docs/ already resolves.
// - Skipped in CI and on Vercel (nothing there reads docs/), or when
//   SIDEKICK_SKIP_DOCS is set.
// - Never fails the install: problems are reported as warnings.
import { spawnSync } from 'node:child_process';
import console from 'node:console';
import { existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const ARKIVE_REPO = 'https://github.com/mehtapratik/arkive.git';
const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const arkiveDir = resolve(repoRoot, '..', 'arkive');
const vault = join(arkiveDir, 'sources', 'docs');

function done(message) {
   console.log(`setup-docs: ${message}`);
   process.exit(0);
}

function warn(message) {
   console.warn(`setup-docs: ${message}`);
   process.exit(0);
}

if (process.env.CI || process.env.VERCEL)
   done('skipped in CI (nothing there reads docs/).');
if (process.env.SIDEKICK_SKIP_DOCS)
   done('skipped (SIDEKICK_SKIP_DOCS is set).');
if (existsSync(vault)) done(`docs/ resolves to ${vault}.`);
if (existsSync(arkiveDir)) {
   warn(
      `${arkiveDir} exists but has no sources/docs; left untouched, so docs/ will not resolve.`,
   );
}

console.log(`setup-docs: cloning Arkive (sources/docs only) into ${arkiveDir}`);
const git = (args) => spawnSync('git', args, { stdio: 'inherit' }).status === 0;
const cloned =
   git(['clone', '--filter=blob:none', '--sparse', ARKIVE_REPO, arkiveDir]) &&
   git(['-C', arkiveDir, 'sparse-checkout', 'set', 'sources/docs']);

if (!cloned || !existsSync(vault)) {
   warn(
      `could not fetch the docs; the install itself succeeded. Run \`pnpm docs:setup\` later, or clone ${ARKIVE_REPO} next to this repo.`,
   );
}

done('docs/ and AGENTS.md now resolve.');
