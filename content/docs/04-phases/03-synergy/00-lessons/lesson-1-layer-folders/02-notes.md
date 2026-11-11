---
publish: false
id: notes.phase-3.lesson-1
title: "Synergy Lesson 1 Notes: Layer Folders and Lint"
created: 2026-11-11
updated: 2026-11-11
kind: notes
version: 1.0.0
tags:
   - phase-3
   - monorepo
   - eslint
status: completed
applies_to:
   - "[[04-phases/03-synergy/00-lessons/lesson-1-layer-folders/00-brief]]"
---

These notes record what lesson 1 taught: the mental models, the surprises and the corrections worth remembering. The steps to reproduce it are in [[04-phases/03-synergy/00-lessons/lesson-1-layer-folders/01-walkthrough|the walkthrough]].

## Mental models

- **The folder is the layer.** Before this lesson, boundaries decided a package's layer from a list of names, and anything else under `packages/*` fell through to foundation. Now the folder decides, a policy names only types, and a new package in a layer folder needs no config. The test for whether a group of packages deserves a folder: do they all follow one policy? Foundation, platform and features do. The registry, tooling and ops each follow their own, so they stay singletons at the root of `packages/`.
- **Why the registry isn't platform** (Pratik's question). The direction is apps → registry → features → platform → foundation. The registry imports every feature, and platform sits below features, so in `packages/platform/` the registry would be classified as platform and every feature import in it would fail.
- **Why not `packages/dev/` for tooling and ops** (Pratik's question). Their policies are opposite (tooling imports nothing; ops imports three layers and nothing imports it), so one folder would still need a pattern per package. And `ops` isn't dev-only: it holds provisioning and break-glass scripts that run against production.
- **Three tools find packages three ways.** pnpm reads `pnpm-workspace.yaml` (folder + `package.json`); the ESLint import resolver reads the `tsProjects` tsconfigs to turn an import into a file path; boundaries matches that file path against its `elements` patterns. A package missing from any one of them fails in a different way.
- **`git mv` is a staging shortcut, not a Git feature.** Git stores snapshots and works out renames afterwards by comparing content. A pure move is 100% similar, so detection is certain; a file edited past 50% in the same commit shows up as delete + add. 60 files moved, 60 renames detected.
- **The lockfile is keyed by folder, not by name.** Moving a package renames its `importers:` key and every `link:` path to it, and nothing else.
- **Default disallow means the policy is what you don't write.** Six `allow` policies and one `disallow` describe the whole graph: "nothing imports the site", "platform packages don't import each other" and "foundation imports nothing" are all absences.

## Surprises

- **The brief's step order didn't work.** It reinstalled in step 1 but added the workspace globs in step 3. `packages/*` matches one level only, so the reinstall would have dropped `core`, `ui` and `copy` from the workspace. The foundation glob moved into step 1.
- **D258 contradicted itself.** "The site may import only foundation, so it can never reach `core`" — but `core` is foundation. The policy faithfully copied the contradiction and let the site import `core`. A stdin probe (`eslint --stdin --stdin-filename src/pages/probe.astro`) showed it without writing a file; a registry import from the same probe failed, which proved the probe itself worked. The fix captures the folder name (`capture: ['package']`) and denies `core` by name. Read a policy against the reason in its decision, not just its wording.
- **A one-character typo turns a policy off.** `type: 'platform '` (trailing space) matched no element, so platform could import nothing. It fails safe, which is exactly why a refused probe can't catch it; only the allowed probe (synergy → core) would have.
- **`boundaries/no-unknown-files` reaches further than packages.** It flagged repo-root files in the editor (`eslint.config.js` itself) and Astro's generated `.astro/` files, which sit in a dot-folder that boundaries' patterns skip. Root files got an exemption block, `.astro/` a global ignore.
- **In flat config, `*.js` means root only.** Patterns are relative to the config file, and a pattern without a slash doesn't descend, so `files: ['*.{js,mjs,cjs,ts}']` exempts only repo-root files. Checked with `eslint --print-config`.
- **The Next.js rules were already scoped.** The brief expected them to need `ignores: ['apps/www/**']`; they target `apps/app/**`. The Pages Router ban was the one that leaked, because Astro also routes from `src/pages/`.
- **An empty module needs `export {}`.** A file with no import or export is a global script, which `verbatimModuleSyntax` (it implies `isolatedModules`) refuses.
- **`vitest run` fails on no tests.** An empty package needs `--passWithNoTests`, or CI's `test` job fails.
- **Turbo refuses a cyclic workspace graph.** The probes made `core` and `synergy` depend on each other, so they ran with `pnpm lint` per package, which also matches how CI's lint really runs.
- **The editor sorted imports.** Pratik's VS Code extension re-sorted `eslint.config.js`'s import block alphabetically, which put an unrelated diff in a pure-move PR. Pratik kept it; enforcing the order in lint and on commit is [[backlogged-unplanned|B15]], the next engineering-health PR.

## Corrections during the lesson

- Two new JSON files were pasted with an extra leading space on every line, and two rewrapped comment lines ended in a trailing space; `prettier --write` fixed both. The pre-commit hook would have too, but starting each step from formatted files keeps reviews readable.
- `index.ts` landed at the package root instead of `src/`. `exports` and the tsconfig's `include` both point at `src/`, so the package resolved to nothing until it moved.

## Checks that proved it

- Four probes from inside each package, each with a real `package.json` dependency: platform → foundation passes; foundation → platform, a package in no layer, and site → `core` fail with the expected messages.
- `pnpm turbo run build lint typecheck test --force` (29/29, 0 cached), `pnpm test:integration`, `pnpm db:migrate` against dev (nothing pending; proves the `.env.local` path), `pnpm prettier:check`.
