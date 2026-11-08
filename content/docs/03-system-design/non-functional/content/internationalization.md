---
publish: true
id: system-design.non-functional.content.internationalization
title: Internationalization
created: 2026-11-05
updated: 2026-11-06
kind: spec
version: 1.1.0
tags:
   - system-design
   - content
   - i18n
status: accepted
---

**D240** `decision` #i18n: Sidekick ships in English only but stays i18n-ready: adding a language means adding catalogs and an entry in the locale config, with no other code change.

Sidekick has one locale today and no plan for a second. Being ready costs little now and a lot later: a sentence glued together from pieces, a hand-written thousands separator or a `padding-left` has to be found and rewritten in every screen once a second language arrives. So the App and the site are built as if more languages were coming, and the [[04-phases/03-synergy/00-plan#i18n lessons|i18n lessons]] prove it with a mock locale (Pratik, 2026-11-05). This page replaces [[03-system-design/non-functional/content/centralized-copy|Centralized Copy]] once lesson I1 lands.

## Library

**D241** `decision` #i18n: The App translates and formats with next-intl; a public face built to last uses use-intl, the library next-intl is built on, so both read the same ICU catalogs through the same `t()` and formatter API. derived-from [[D240]]

next-intl is use-intl plus the Next.js wiring: server helpers, request config and optional routing. Astro has no Next.js, so a lasting public face would use use-intl's `createTranslator` and `createFormatter` at build time and ship no client JS for it. Today's site, `apps/www`, is temporary ([[D256]]): it stays English with `lang` and `dir` on `<html>`, and has no catalogs, no `no-literal-string` and no logical-CSS lint (Pratik, 2026-11-06). Rejected: **react-intl** (the reference ICU implementation, but server components, locale detection and routing are left to us), **i18next** (App Router wiring by hand, ICU only through a plugin), **Paraglide** (needs `--webpack` or a separate compile task on Next 16) and **Lingui** (its SWC plugin is tied to Next versions). The catalogs are plain ICU, so a later switch keeps them.

## Where the locale comes from

**D242** `decision` #i18n: The App takes the locale from the device (`Accept-Language`, `en` until a second language ships) in one place, `i18n/request.ts`, and keeps locales out of URLs; the site sets `lang` and `dir` from config and adds locale routes, English unprefixed, only when translated content exists. derived-from [[D240]]

URL locales pay off for pages search engines index in more than one language. The App is signed in and never indexed, so `/dashboard` stays `/dashboard` in every language, as in most signed-in apps; `i18n/request.ts` returns `en` until a second language ships, then reads `Accept-Language`.

**D253** `decision` #i18n: The App shows dates in the device's time zone, which the browser writes to a `tz` cookie that `i18n/request.ts` passes to next-intl as `timeZone`, with UTC only before the cookie exists; a stored locale or time zone is optional, added only when something with no browser needs one. derived-from [[D245]] derived-from [[D1]]

The server renders in UTC (Vercel). Without an explicit `timeZone`, a note saved at 11:30 pm shows "Nov 6" from the server and "Nov 5" after the browser re-renders, a hydration mismatch. The browser knows the zone (`Intl.DateTimeFormat().resolvedOptions().timeZone`) but sends it in no header, so the root layout's client provider compares it with the `tz` cookie on every load and, when they differ (first visit, or the device moved to another zone), rewrites the cookie and calls `router.refresh()`, so the server renders that page again in the new zone. The locale needs no cookie: `Accept-Language` comes with every request.

No profile columns yet (Pratik, 2026-11-06): the device already knows both. A stored setting arrives only for a job that runs with no browser (a reminder, a digest, a bot posting "due today") or for a person who wants to override the device, and it is optional ([[D1]]). The order then becomes: stored setting, else the device, else UTC, still in `i18n/request.ts`. The site is indexed, but its entries are English Markdown: a second language there is a content decision, and when it comes Astro's i18n routing adds `/xx/` without moving an English URL.

## Catalogs

**D243** `rule` #i18n #copy: Every user-visible string lives in a JSON catalog next to the package that uses it, under one namespace named for that package; `@sidekick/i18n` alone owns the `common` namespace, and a string moves there once a second package needs it. supersedes [[D36]]

**D244** `rule` #i18n: A message is a whole sentence in ICU syntax, with plurals and selects inside it; code never builds a sentence by joining messages or changing their case. derived-from [[D240]]

- **`@sidekick/i18n`** holds what every app shares: the `common` catalog (the app name, generic errors, words like Sign in once two packages use them), the locale config (supported locales, the default, each locale's direction, and which are mock), the named formats, the `AppConfig` types that make `t('auth.signIn')` type-checked, and `mergeCatalogs`, which throws on a duplicate namespace.
- **Each package** ships `messages/<locale>.json` with one top-level key, its namespace (`synergy`, `app`, `www`). There is no `defineMessages`: catalogs are data, not code (Pratik, 2026-11-05).
- **Each app assembles** its catalogs for the locale, the way the feature registry collects manifests: the App in `i18n/request.ts`, the site in its translator helper.
- **Why colocate:** a feature's words change with the feature, and deleting a feature deletes its words. The `common` catalog keeps shared words from drifting apart, which is what [[D36]] was for.

**D249** `rule` #i18n #ui: `@sidekick/ui` holds no words and imports no i18n library; every word in a primitive is a required `string` prop named `<purpose>Label` (`closeLabel`, `loadingLabel`), which the caller fills from its own catalog. derived-from [[D243]]

A primitive renders in server components, client components, the site's static build, tests and third-party pages. React's server build has no `createContext` or `useContext`, so a `ui` that read words through a provider would turn every worded primitive into a client component and need a provider in every host. Plain string props work everywhere (Q3 of the [[03-system-design/phase-3-additions-handover|Phase 3 additions handover]], Pratik, 2026-11-06; research in the project's `i18n-ui/ui-words-evaluation.md`).

- The App fills the props with `t()` in server and client components alike; a wrapper (`AppDialog`) can save the repetition, because the App may import both.
- Props are strings, never functions: a server component cannot pass a function to a client one.
- `no-restricted-imports` bans `use-intl`, `next-intl` and `@sidekick/i18n` inside `packages/foundation/ui`.
- **Later, if a trigger arrives** (a host with no catalogs renders `ui` directly, Storybook, or more than about ten built-in words): `ui` may bundle its own catalogs behind a React context whose default is `en`, and the props become optional. That change only adds, so no caller breaks. The reverse would break every caller, which is why props come first.
- Rejected: `ui` importing `@sidekick/i18n` (an exception to the flat foundation rule, and a provider everywhere), and `ui` calling `useTranslations` on its own catalog (client-only, provider everywhere).

`@sidekick/i18n` lives in `packages/foundation/i18n`, next to `core` and `ui`, and no foundation package imports another.

Today's `validationCopies.invalidInput(labelCopies.email.toLocaleLowerCase())` breaks D244: German capitalises nouns and Hindi puts the verb last, so each field gets its own whole sentence.

## Formatting

**D245** `rule` #i18n: Numbers, currencies, dates, relative times and lists are formatted only through the locale's formatter and the shared named formats; an amount is always stored with its ISO 4217 currency code, and a date is shown in the person's time zone. derived-from [[D240]]

No hand-written separators and no bare `toLocaleString()`. The currency rule is also a database convention: every table with an amount stores its currency code beside it ([[03-system-design/non-functional/database/syncable-tables|syncable tables]]). A named format (`short` date, `compact` number) means every screen formats a value the same way, and a new locale changes only the separators, digits and order, which come from `Intl`.

## Direction

**D246** `rule` #i18n #css: Layout is direction-agnostic: CSS uses logical properties and values (`padding-inline-end`, `margin-inline-start`, `text-align: start`), `<html>` gets `lang` and `dir` from the locale, and code that maps keys or icons to a direction reads `dir`. derived-from [[D240]]

In right-to-left text ArrowLeft means next, a "back" arrow points right, and `inset-inline-start` is the right edge. Styling lives in CSS modules and a short list of global files ([[D47]], `sidekick/no-inline-styles`), so Stylelint sees all of it. Mantine leaves the App in lesson M1, before I1, so no direction provider is needed ([[D255]]).

## Proving it

**D247** `rule` #i18n: Arabic (`ar`) is a mock locale for the test pages only: marked `mock` in the locale config, never offered to people, and required only of the catalogs the test pages read. derived-from [[D240]]

Each app has one dev-only test page (the App's `/dev/i18n` returns 404 in production) that renders the same sample twice, side by side, in English and in Arabic: a form with validation messages, a count that needs plurals, a price, a date, a relative time and a list. Arabic exercises everything at once: right-to-left, Arabic-Indic digits, its own separators, currency placement and six plural forms. Its text is machine-written; the English column is how it is checked.

**D248** `rule` #i18n: Lint keeps the catalogs and direction honest: `eslint-plugin-i18next`'s `no-literal-string` on user-facing code, `stylelint-use-logical` on CSS, `sidekick/catalog-namespace` on catalogs, and a catalog check that fails on the same English text in two catalogs or a missing catalog for a supported locale. derived-from [[D243]] derived-from [[D246]]

- **`no-literal-string`** (open source, works with any library despite its name) flags hardcoded strings in JSX and code, in `mode: "jsx-only"`: the default, `jsx-text-only`, does not check attributes, so `aria-label="Close"` would pass. Tests, `packages/ops` and `apps/www` ([[D256]]) are exempt. If it does not support ESLint 10 yet, lesson I2 writes the equivalent in `eslint-plugin-sidekick`.
- **`stylelint-use-logical`** (csstools) reports and fixes physical properties.
- **TypeScript** rejects unknown keys through `AppConfig`, so keys need no lint rule.
- **`sidekick/catalog-namespace`** (ours, on JSON through `@eslint/json`): a catalog has one top-level key, its package's namespace, and only `@sidekick/i18n` may use `common`.
- **The catalog check** (ours, a script, since ESLint reads one file at a time) is the drift guard: the same English text in two catalogs fails with "move it to `common`".

## Known gaps

- **Other consumers of keys.** The API returns keys and `MessageRef`s ([[D201]], [[D250]]), so `apps/cli`, bots and third parties need the catalogs to show words: Synergy's catalog is exported from the package, and a catalog endpoint can come later. Nothing in Phase 3 needs it.

## Decision History

- 2026-11-05 · accepted · English only, i18n-ready, with next-intl and use-intl; replaces Centralized Copy (D36) when lesson I1 lands
- 2026-11-06 · accepted · `ui` holds no words ([[D249]]); locale and time zone from the device ([[D242]] revised, [[D253]]); the temporary site leaves i18n out ([[D241]] revised); `no-literal-string` in `jsx-only` mode
