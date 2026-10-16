// Verifies, after `next build`, that every endpoint Next.js will serve enters
// through an App Router route handler — the only files the
// sidekick/require-api-guard lint rule checks for withApiGuard.
//
// Lint rules check what we wrote; this checks what Next.js built, so it also
// catches entry points nobody anticipated. It fails the build on:
//   - any Server Action (each is a public POST endpoint outside withApiGuard)
//   - any Pages Router entry beyond Next.js's built-in error pages
//   - any App Router route with no route.* source file (e.g. a code-generated
//     metadata route such as sitemap.ts). Static files such as favicon.ico
//     are allowed: they serve a file and run no code.
import console from 'node:console';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import process from 'node:process';

const appDir = process.cwd();
const serverDir = join(appDir, '.next', 'server');
const sourceRoot = [join(appDir, 'src', 'app'), join(appDir, 'app')].find((dir) => existsSync(dir));

const BUILT_IN_PAGES = new Set(['/404', '/500', '/_app', '/_document', '/_error']);
const ROUTE_SOURCES = ['route.ts', 'route.tsx', 'route.js', 'route.jsx'];
const CODE_FILE = /\.(ts|tsx|js|jsx|mjs|cjs)$/;

function readManifest(name) {
  return JSON.parse(readFileSync(join(serverDir, name), 'utf8'));
}

function isStaticFile(path) {
  return existsSync(path) && statSync(path).isFile() && !CODE_FILE.test(path);
}

const problems = [];

const actions = readManifest('server-reference-manifest.json');
const actionCount = Object.keys(actions.node ?? {}).length + Object.keys(actions.edge ?? {}).length;
if (actionCount > 0) {
  problems.push(`${actionCount} Server Action(s) found. Server Actions are not allowed.`);
}

for (const route of Object.keys(readManifest('pages-manifest.json'))) {
  if (!BUILT_IN_PAGES.has(route)) {
    problems.push(`Pages Router entry "${route}". The Pages Router is not used.`);
  }
}

for (const [route, output] of Object.entries(readManifest('app-paths-manifest.json'))) {
  if (!route.endsWith('/route')) continue; // pages render HTML; not API entry points

  const segmentPath = output.replace(/^app\/?/, '').replace(/\/?route\.js$/, '');
  const source = join(sourceRoot, segmentPath);
  const hasRouteFile = ROUTE_SOURCES.some((file) => existsSync(join(source, file)));

  if (!hasRouteFile && !isStaticFile(source)) {
    problems.push(
      `"${route}" is served but has no route.* source file, so withApiGuard is not lint-checked.`,
    );
  }
}

if (problems.length > 0) {
  console.error('verify-endpoints: unguarded entry points in the build:');
  for (const problem of problems) console.error(`  - ${problem}`);
  process.exit(1);
}

console.log('verify-endpoints: every served endpoint is a lint-checked route handler.');
