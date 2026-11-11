// `content/` holds content only (D259): Markdown and images under `docs/` and
// `writings/`, plus `LICENSE` and a `package.json` with no code keys. It reads git's
// index, so the pre-commit hook checks exactly what is about to be committed.
import { execFileSync } from 'node:child_process';
import console from 'node:console';
import process from 'node:process';

const ROOT_FILES = new Set(['content/LICENSE', 'content/package.json']);
const CONTENT_FILE =
   /^content\/(docs|writings)\/.+\.(md|svg|png|jpe?g|gif|webp)$/;

const PACKAGE_KEYS = new Set(['name', 'version', 'private', 'license']);

const git = (...args) => execFileSync('git', args, { encoding: 'utf-8' });

const files = git('ls-files', '-z', 'content').split('\0').filter(Boolean);

const problems = (function () {
   const invalidFiles = files
      .filter((file) => !ROOT_FILES.has(file) && !CONTENT_FILE.test(file))
      .map((file) => `${file}: only Markdown and images belong in content/`);

   // `:path` is the staged copy, the same version as the file list above
   const manifest = JSON.parse(git('show', ':content/package.json'));
   const invalidKeys = Object.keys(manifest)
      .filter((key) => !PACKAGE_KEYS.has(key))
      .map((key) => `content/package.json: "${key}" is not allowed`);
   return [...invalidFiles, ...invalidKeys];
})();

if (problems.length > 0) {
   console.error(`check:content failed:\n  ${problems.join('\n  ')}`);
   process.exit(1);
}
console.log(`check:content ok: ${files.length} files.`);
