---
publish: false
id: prd.synergy.research-05
title: "Research: where the resolver contract lives"
created: 2026-10-25
kind: research
tags:
   - prd
   - synergy
   - wayfinder
---

Research for ticket 05 ([[02-prd/synergy/tickets/05-resolver-contract-home|Where the resolver contract lives]]). It lists facts and trade-offs only. The decision belongs to Pratik.

Sources: the Sidekick repo at commit `80b61cc` (`eslint.config.js`, `pnpm-workspace.yaml`, each `package.json`, `packages/core`, `packages/features-registry`), the Arkive vault notes it points to, and the first-party docs linked below.

## 1. Today's dependency graph and boundaries rules

### Declared workspace dependencies

| Package                           | Element type (boundaries) | Depends on (`@sidekick/*`)               |
| --------------------------------- | ------------------------- | ---------------------------------------- |
| `apps/web`                        | `app`                     | `core`, `copy`, `eslint-plugin-sidekick` |
| `apps/cli`                        | `app`                     | none                                     |
| `packages/features-registry`      | `registry`                | none (no feature packages exist yet)     |
| `packages/ops`                    | `ops`                     | `core`, `features-registry`              |
| `packages/core`                   | `foundation`              | none                                     |
| `packages/ui`, `packages/copy`    | `foundation`              | none                                     |
| `packages/eslint-plugin-sidekick` | `tooling`                 | none                                     |

`pnpm-workspace.yaml` lists only `apps/*` and `packages/*`. `AGENTS.md` says the `packages/features/*` glob is added with the first feature package. `apps/web` does not yet depend on `features-registry`; the only importer of the registry is `packages/ops/src/scripts/entitlements-grant.ts` (`ALL_FEATURES`).

### Element classification (`eslint.config.js`)

```js
// A file belongs to the first element whose pattern matches, so specific
// patterns come before the catch-all `packages/*`.
'boundaries/elements': [
   { type: 'app', pattern: 'apps/*' },
   { type: 'feature', pattern: 'packages/features/*' },
   { type: 'registry', pattern: 'packages/features-registry' },
   { type: 'tooling', pattern: 'packages/eslint-plugin-sidekick' },
   // Privileged scripts (dev seeds, provisioning, break-glass); nothing imports them
   { type: 'ops', pattern: 'packages/ops' },
   // core, ui, copy
   { type: 'foundation', pattern: 'packages/*' },
],
```

Consequence: any new package directly under `packages/` is classified `foundation` unless a more specific pattern is added above the catch-all.

### Policies

```js
'boundaries/no-unknown-dependencies': 'error',
// Dependency direction: apps → registry → features → foundation.
// Everything not allowed here is disallowed. Imports within one package
// are never checked. Foundation packages (core, ui, copy) and tooling
// import no other workspace package; loosen deliberately with a new rule.
'boundaries/dependencies': ['error', {
   default: 'disallow',
   policies: [
      { from: { element: { type: 'app' } },
        allow: { to: { element: { type: ['feature', 'registry', 'foundation'] } } } },
      { from: { element: { type: 'registry' } },
        allow: { to: { element: { type: ['feature', 'foundation'] } } } },
      { from: { element: { type: 'feature' } },
        allow: { to: { element: { type: 'foundation' } } } },
      { from: { element: { type: 'ops' } },
        allow: { to: { element: { type: ['foundation', 'registry'] } } } },
   ],
}],
```

Who may import whom:

| From \ To  | app | registry | feature                                  | foundation                                             | ops | tooling |
| ---------- | --- | -------- | ---------------------------------------- | ------------------------------------------------------ | --- | ------- |
| app        | —   | yes      | yes                                      | yes                                                    | no  | no      |
| registry   | no  | (self)   | yes                                      | yes                                                    | no  | no      |
| feature    | no  | **no**   | **no** (each feature is its own element) | yes                                                    | no  | no      |
| foundation | no  | **no**   | **no**                                   | **no** (core cannot import ui or copy, and vice versa) | no  | no      |
| ops        | no  | yes      | no                                       | yes                                                    | —   | no      |

Other relevant rules in the same file:

- `import-x/no-cycle: 'error'` across all TS/JS files. A registry → feature → registry loop would be reported even if boundaries allowed it.
- `@typescript-eslint/consistent-type-imports` forces `import type`. eslint-plugin-boundaries policies can match type-only imports separately (`dependency: { kind: "type" }`, [jsboundaries.dev/docs/policies](https://www.jsboundaries.dev/docs/policies/)). Today's policies make no such distinction, so a type-only import counts like any other.
- `AGENTS.md` notes boundaries enforced nothing until `boundaries/root-path` was set; a new rule has to be proven through `pnpm lint` (per-package cwd), not a root probe.

### What the docs say

- [[03-system-design/non-functional/monorepo/dependency-flow|Dependency flow]] (v1.1.0): "Feature packages … may import only foundation packages. They never import each other or the registry." "If `core` imported the registry, it would depend on every feature, and every feature already depends on `core`: a cycle with no valid build order."
- [[03-system-design/functional-design/00-feature-system/core|core]]: "`packages/core` must ALWAYS remain feature agnostic."
- [[03-system-design/functional-design/00-feature-system/registry|Feature registry]] (v1.1.0): the registry "will host feature manifests, metadata and registration information"; today it is "only a catalog" of `FeatureManifest` (`key`, `name`, `description`) and "changes only with a deploy".

### Existing precedent for the pattern

`withApiGuard` (`packages/core/src/api/guard.ts`) already takes a feature key as a plain string (`GuardOptions.feature`) and checks it against `user_feature_entitlements`. Core works with feature identity as data, never as an import of the registry. The app's route handler is where the feature key is supplied.

## 2. Options for the contract and the registration

Terms: the **contract** is the TypeScript interface a resolver implements (for example `resolve(entityId, displayType) → render data`). **Registration** is the place where the map `entity type → resolver implementation` is assembled. **Dispatch** is the code that reads the entity index row, picks the resolver by `type` and calls it.

### A. Contract in core; implementations in features; map assembled in the registry; dispatch injected

- Core exports the interface (and possibly a `dispatch(resolvers, row)` helper that takes the map as an argument).
- Each feature package imports the interface from core and exports its resolvers.
- `features-registry` imports every feature and exports the map beside `ALL_FEATURES` (for example `ALL_RESOLVERS`, or a `resolvers` field on `FeatureManifest`).
- The app (route handler or server component) imports the map from the registry and passes it to core's dispatch, or dispatches itself.
- **Config change:** none. feature → foundation, registry → feature, app → registry and app → foundation are all allowed today. `apps/web` would add `@sidekick/features-registry` to its `package.json`.
- **Trade-offs:** matches the documented direction and the registry's planned role as the entity-type ledger. Core stays feature-agnostic because it holds only the shape. The registry must import feature runtime code, not only metadata, which grows what `packages/ops` pulls in when it imports `ALL_FEATURES` (ops imports the registry). If the registry is also the entity-type ledger, the "one entity type has exactly one owning feature" check can live in the registry's existing manifest test (`index.test.ts`).

### B. Contract in core; map assembled in `apps/web` (composition root)

- Same as A, but `apps/web` imports each feature's resolvers directly and builds the map, the way Backstage's app composes `EntityPage.tsx` (see section 3).
- **Config change:** none (app → feature is allowed).
- **Trade-offs:** no new responsibility for the registry; but `apps/cli`, bots and jobs need the same map, so each app builds its own or a shared one is extracted later, which is option A. Two lists to keep in sync (manifests in the registry, resolvers in the app).

### C. Contract in `features-registry`

- Features would import the interface from the registry; the registry imports features to build the map.
- **Config change:** a new policy `feature → registry`, contradicting the dependency-flow note ("never import … the registry"). It also makes the `package.json` graph cyclic (registry depends on each feature, each feature on the registry), which `turbo.json`'s `dependsOn: ["^build"]` / `["^typecheck"]` cannot put in order. `import-x/no-cycle` works on files: it reports only if the imported file reaches back to a feature, so it passes when features import a contract file that imports nothing from features (not `./src/index.ts`, which would export the resolver map). A type-only allowance (`dependency: { kind: "type" }`) is possible in boundaries 7 but does not fix the package cycle or the documented direction.
- **Trade-offs:** puts the ledger and the contract in one place, at the cost of the only rule that keeps the registry at the top.

### D. New contract package (for example `packages/synergy-contract` or `packages/entities`)

- Holds the interface and maybe the dispatcher; features import it; registry or app assembles the map.
- **Config change:** by default it falls into `foundation` via the `packages/*` catch-all. Then features may import it, but **core may not** (foundation → foundation is disallowed), and the package may not import core's entity-index types either. To let either direction work, add a new element type above the catch-all (for example `{ type: 'contract', pattern: 'packages/synergy-contract' }`) and policies such as `feature → contract`, `registry → contract`, `app → contract`, and either `contract → foundation` or `foundation → contract`, not both (that would be a cycle).
- **Trade-offs:** the contract has an owner separate from core's database code, which is Backstage's split (section 3). Costs a package, a new element type and new policies. Core still has to hold the entity index and relationships, so the contract package would either depend on core's row type or duplicate it.

### E. Dependency injection at the route layer, no shared dispatcher

- Core exposes only the entity index (row lookup by id). The route handler (`withApiGuard`-wrapped, in `apps/web`) reads the row, looks up the feature's resolver (from the registry map or a direct feature import), and calls it. The contract type can still live in core (as in A) so every feature implements the same shape.
- **Config change:** none.
- **Trade-offs:** fits the API-first rule (mutations and data access already go through the API layer). The entitlement check fits naturally here: the guard already knows `opts.feature`, so a link into a disabled module (ticket 06) is decided where the resolver is called. Each consumer (web, cli, jobs) must go through the API or repeat the lookup.

### Cross-cutting facts that apply to every option

- **Rich Live Link in other features.** A feature rendering a Rich Live Link to another module's entity cannot import that module (feature → feature is disallowed). It can only get render data through an injected function, a prop from the app, or an HTTP call to the app's API. Where the component's draft lives (core, `ui`, or a feature) is a separate question: `packages/ui` is foundation and cannot import core today.
- **Server vs client.** Core's `db` and `api` modules import `server-only`. A resolver that reads a module's tables runs on the server; a client component gets its output as props or through a fetch.
- **Static vs runtime registration.** Today's registry is a static array checked in tests and changed only by deploy. Obsidian and WordPress register at runtime (section 3). A static map can be validated at build/test time (unique types, one owner per type); a runtime registry needs an ordering guarantee that registration happens before the first dispatch.
- **Typing per entity type.** TypeScript module augmentation lets each package add keys to an interface declared elsewhere ([TypeScript handbook: Module Augmentation](https://www.typescriptlang.org/docs/handbook/declaration-merging.html#module-augmentation)), so a core-declared `EntityTypes` map could gain one entry per feature without core importing features. It is a type-level technique only and still needs a runtime map from one of the options above.

### Config changes at a glance

| Option | Contract in | Map assembled in | `eslint.config.js` change                                                                 |
| ------ | ----------- | ---------------- | ----------------------------------------------------------------------------------------- |
| A      | core        | registry         | none                                                                                      |
| B      | core        | apps/web         | none                                                                                      |
| C      | registry    | registry         | add `feature → registry`; conflicts with `import-x/no-cycle` and the dependency-flow note |
| D      | new package | registry or app  | new element type above `packages/*` plus 3–4 policies                                     |
| E      | core (type) | route handler    | none                                                                                      |

## 3. How comparable systems register per-type resolvers and renderers

### Backstage (software catalog)

- **Contract lives in a separate "node" package, not in the catalog backend.** `EntityProvider` and `CatalogProcessor` are imported from `@backstage/plugin-catalog-node`; the processing loop lives in `@backstage/plugin-catalog-backend`. A module depends on the `-node` package and never on the backend implementation. ([Entity providers](https://backstage.io/docs/features/software-catalog/external-integrations/entity-providers), [Processors](https://backstage.io/docs/features/software-catalog/external-integrations/processors))
- **Registration through an extension point, composed by the app.** A module declares `catalogProcessingExtensionPoint` as a dependency and calls `processing.addEntityProvider(...)` or `catalog.addProcessor(...)` in `init`; the backend composes it with `backend.add(import('./plugins/catalog-backend-module-…'))` next to `backend.add(import('@backstage/plugin-catalog-backend'))`. ([CatalogProcessingExtensionPoint API](https://backstage.io/api/stable/interfaces/_backstage_plugin-catalog-node.index.CatalogProcessingExtensionPoint.html))
- **Provider identity.** `getProviderName()` "must be unique across all providers and stable over time." Providers push entities with `connection.applyMutation({ type: 'full', entities })`.
- **Two kinds of extension.** "An entity provider sits at the edge of the catalog as an original source of entities"; "A processor runs inside the catalog's processing loop" to enrich, validate or emit child entities. ([External integrations](https://backstage.io/docs/features/software-catalog/external-integrations/))
- **Per-kind rendering is composed by the app.** In the old frontend system the app's `packages/app/src/components/Catalog/EntityPage.tsx` uses `EntitySwitch.Case if={isKind('component')}` to pick a layout per kind; plugins export components that read the current entity with `useEntity` from `@backstage/plugin-catalog-react`. In the new frontend system plugins contribute `EntityCardBlueprint` / `EntityContentBlueprint` extensions from `@backstage/plugin-catalog-react/alpha` that attach to the catalog's entity page. ([Integrating a plugin into the catalog](https://backstage.io/docs/next/plugins/integrating-plugin-into-software-catalog), [Common extension blueprints](https://backstage.io/docs/next/frontend-system/building-plugins/common-extension-blueprints))
- **Mapping to Sidekick:** the `-node` package corresponds to option D; app composition corresponds to options A/B.

### Obsidian plugin API

- **Host owns the contract.** Plugins import types and the `Plugin` base class from the `obsidian` package; they never depend on each other.
- **Imperative registration at load time.** Inside `onload()`, a plugin calls `this.registerMarkdownPostProcessor((element, context) => …)`, which runs "after Markdown has been converted to HTML" in Reading view, or `this.registerMarkdownCodeBlockProcessor('csv', (source, el, ctx) => …)`, keyed by the fenced block's language. ([Markdown post processing](https://docs.obsidian.md/Plugins/Editor/Markdown+post+processing), [Plugin reference](https://docs.obsidian.md/Reference/TypeScript+API/Plugin))
- **Keyed registries.** Other register methods are keyed by a string: `registerView(type, viewCreator)`, `registerExtensions(extensions, viewType)`, `registerObsidianProtocolHandler(action, handler)`, `registerBasesView(viewId, registration)`; `registerCliHandler` IDs "must be globally unique, and duplicates throw an Error." ([Plugin reference](https://docs.obsidian.md/Reference/TypeScript+API/Plugin))
- **Hover previews.** `registerHoverLinkSource(id, info)` registers a view "with the Page preview core plugin as a source of `hover-link` events"; `HoverLinkSource` has only `display` (settings label) and `defaultMod` (whether Mod is required). The host's Page preview plugin renders the preview; the source only announces events. ([HoverLinkSource](https://docs.obsidian.md/Reference/TypeScript+API/HoverLinkSource))
- **Embeds of custom types** (`app.embedRegistry`) are not a public API; plugins reach it through unofficial typings, and a feature request asks for an official one. ([Forum FR](https://forum.obsidian.md/t/fr-new-api-this-app-embedregistry-registerextension-to-allow-embedding-custom-files-inside-our-notes/115280))
- **Lifecycle.** `Component.register*` callbacks are detached on unload ([Plugin reference](https://docs.obsidian.md/Reference/TypeScript+API/Plugin)).

### Notion

- **Link Previews are out-of-process providers.** "Notion detects supported URLs based on the Link Preview connection settings for that service"; the connection uses OAuth 2.0. "The source service also detects any changes to the data embedded in the Link Preview and alerts Notion when the Link Preview needs to be updated," and "Notion alerts the source service when a Link Preview is deleted, so that the service can stop listening for updates." ([Link Previews introduction](https://developers.notion.com/guides/link-previews/introduction))
- **Render data is a typed attribute array, not markup.** Each unfurl attribute has an `id`, a `name` and a `type` of `inline` (`title`, `plain_text`, `enum`, `color`, … with a `section` saying where it renders) or `embed` (`audio`, `html`, `image`, `video` with `src_url`). "Every array … must also include a `dev` attribute"; a `title` attribute is required. Notion lays it out. ([Unfurl attribute object](https://developers.notion.com/reference/unfurl-attribute-object))
- **Status:** "Custom Link Preview connections are no longer available for new developers to create." ([Build a Link Preview integration](https://developers.notion.com/docs/build-a-link-preview-integration))
- **Synced blocks** are not resolvers: the original `synced_block` has `synced_from: null` and holds the children; a duplicate has `synced_from: { type: "block_id", block_id }` and mirrors them. The API returns `link_preview` blocks but "does not support creating or appending" them. ([Block reference](https://developers.notion.com/reference/block))
- **Mapping to Sidekick:** the provider returns structured fields and the host owns the layout per display type, which is one possible shape for the resolver's return value. Notion's push-on-change model resembles the map's version-bump seed for events.

### WordPress and Drupal (oEmbed)

- **WordPress:** `wp_oembed_add_provider( string $format, string $provider, bool $regex = false )` "Adds a URL format and oEmbed provider URL pair"; `$format` accepts `*` wildcards or a regex. Before `plugins_loaded` fires, it queues the pair via `WP_oEmbed::_add_provider_early()`; afterwards it writes into the shared `WP_oEmbed` object's `providers` array. ([wp_oembed_add_provider](https://developer.wordpress.org/reference/functions/wp_oembed_add_provider), [WP_oEmbed](https://developer.wordpress.org/reference/classes/wp_oembed/)) The registry is keyed by URL pattern and populated by plugins at runtime, with an explicit early-registration path for ordering.
- **Drupal core Media:** builds its provider list by fetching `https://oembed.com/providers.json`, overridable through the `oembed_providers_url` setting; core offers `hook_oembed_resource_url_alter()`. A proposed `hook_oembed_providers_alter()` was postponed in favor of the contrib [oEmbed Providers](https://www.drupal.org/project/oembed_providers) module. ([Drupal issue 3008119](https://www.drupal.org/node/3008119))

### Patterns across the four

| System             | Contract owned by         | Key                                | Registration                    | Who composes                                 |
| ------------------ | ------------------------- | ---------------------------------- | ------------------------------- | -------------------------------------------- |
| Backstage backend  | separate `-node` package  | provider name, entity kind         | extension point in `init`       | the backend app (`backend.add`)              |
| Backstage frontend | `plugin-catalog-react`    | entity kind (`isKind`) / extension | component export or blueprint   | the app (`EntityPage.tsx`) or extension tree |
| Obsidian           | host (`obsidian` package) | language, view type, extension     | imperative, in `onload()`       | the host at runtime                          |
| Notion             | host (HTTP contract)      | URL domain/pattern                 | connection settings             | Notion (out of process)                      |
| WordPress          | host (`WP_oEmbed`)        | URL pattern                        | imperative, with an early queue | the host at runtime                          |
| Drupal             | host + oembed.com list    | URL pattern                        | remote list, alter hook         | config / contrib module                      |

In none of them does the host import a plugin. In each one the contract lives with the host or in a package the host and plugins both depend on, and either the app or the runtime host does the composing.

## Open questions this research does not settle

- Whether the registry should import feature runtime code (A) or only metadata, given `packages/ops` imports it.
- What the resolver returns: structured fields that a shared component lays out per display type (Notion's model) or a rendered element per display type (Obsidian's and Backstage's model).
- Whether dispatch is in-process (A/B/E) or always through the HTTP API, which decides how `apps/cli` and agents reach it.
