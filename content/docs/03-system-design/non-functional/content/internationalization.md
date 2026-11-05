---
publish: true
id: system-design.non-functional.content.internationalization
title: Internationalization
created: 2026-11-05
updated: 2026-11-05
kind: spec
version: 1.0.0
tags:
   - system-design
   - content
   - i18n
status: accepted
---

**D240** `decision` #i18n: Sidekick ships in English only but stays i18n-ready: adding a language means adding catalogs and an entry in the locale config, with no other code change.

Sidekick has one locale today and no plan for a second. Being ready costs little now and a lot later: a sentence glued together from pieces, a hand-written thousands separator or a `padding-left` has to be found and rewritten in every screen once a second language arrives. So the App and the site are built as if more languages were coming, and the [[04-phases/03-synergy/00-plan#i18n lessons|i18n lessons]] prove it with a mock locale (Pratik, 2026-11-05). This page replaces [[03-system-design/non-functional/content/centralized-copy|Centralized Copy]] once lesson I1 lands.

## Library

**D241** `decision` #i18n: The App translates and formats with next-intl, and the public site with use-intl, the library next-intl is built on; both read the same ICU catalogs through the same `t()` and formatter API. derived-from [[D240]]

next-intl is use-intl plus the Next.js wiring: server helpers, request config and optional routing. Astro has no Next.js, so the site uses use-intl's `createTranslator` and `createFormatter` at build time and ships no client JS for it. Rejected: **react-intl** (the reference ICU implementation, but server components, locale detection and routing are left to us), **i18next** (App Router wiring by hand, ICU only through a plugin), **Paraglide** (needs `--webpack` or a separate compile task on Next 16) and **Lingui** (its SWC plugin is tied to Next versions). The catalogs are plain ICU, so a later switch keeps them.

## Where the locale comes from

**D242** `decision` #i18n: The App takes the locale from the person (their setting, else `Accept-Language`) in one place, `i18n/request.ts`, and keeps locales out of URLs; the site sets `lang` and `dir` from config and adds locale routes, English unprefixed, only when translated content exists. derived-from [[D240]]

URL locales pay off for pages search engines index in more than one language. The App is signed in and never indexed, so `/dashboard` stays `/dashboard` in every language, as in most signed-in apps; `i18n/request.ts` returns `en` until a person can choose. The site is indexed, but its entries are English Markdown: a second language there is a content decision, and when it comes Astro's i18n routing adds `/xx/` without moving an English URL.

## Catalogs

**D243** `rule` #i18n #copy: Every user-visible string lives in a JSON catalog next to the package that uses it, under one namespace named for that package; `@sidekick/i18n` alone owns the `common` namespace, and a string moves there once a second package needs it. supersedes [[D36]]

**D244** `rule` #i18n: A message is a whole sentence in ICU syntax, with plurals and selects inside it; code never builds a sentence by joining messages or changing their case. derived-from [[D240]]

- **`@sidekick/i18n`** holds what every app shares: the `common` catalog (the app name, generic errors, words like Sign in once two packages use them), the locale config (supported locales, the default, each locale's direction, and which are mock), the named formats, the `AppConfig` types that make `t('auth.signIn')` type-checked, and `mergeCatalogs`, which throws on a duplicate namespace.
- **Each package** ships `messages/<locale>.json` with one top-level key, its namespace (`synergy`, `app`, `www`). There is no `defineMessages`: catalogs are data, not code (Pratik, 2026-11-05).
- **Each app assembles** its catalogs for the locale, the way the feature registry collects manifests: the App in `i18n/request.ts`, the site in its translator helper.
- **Why colocate:** a feature's words change with the feature, and deleting a feature deletes its words. The `common` catalog keeps shared words from drifting apart, which is what [[D36]] was for.

Today's `validationCopies.invalidInput(labelCopies.email.toLocaleLowerCase())` breaks D244: German capitalises nouns and Hindi puts the verb last, so each field gets its own whole sentence.

## Formatting

**D245** `rule` #i18n: Numbers, currencies, dates, relative times and lists are formatted only through the locale's formatter and the shared named formats; an amount is always stored with its ISO 4217 currency code, and a date is shown in the person's time zone. derived-from [[D240]]

No hand-written separators and no bare `toLocaleString()`. A named format (`short` date, `compact` number) means every screen formats a value the same way, and a new locale changes only the separators, digits and order, which come from `Intl`.

## Direction

**D246** `rule` #i18n #css: Layout is direction-agnostic: CSS uses logical properties and values (`padding-inline-end`, `margin-inline-start`, `text-align: start`), `<html>` gets `lang` and `dir` from the locale, and code that maps keys or icons to a direction reads `dir`. derived-from [[D240]]

In right-to-left text ArrowLeft means next, a "back" arrow points right, and `inset-inline-start` is the right edge. Styling already lives only in CSS modules (`sidekick/no-inline-styles`, `sidekick/no-mantine-style-props`), so Stylelint sees all of it; Mantine supports RTL through its direction provider.

## Proving it

**D247** `rule` #i18n: Arabic (`ar`) is a mock locale for the test pages only: marked `mock` in the locale config, never offered to people, and required only of the catalogs the test pages read. derived-from [[D240]]

Each app has one dev-only test page (the App's `/dev/i18n` returns 404 in production) that renders the same sample twice, side by side, in English and in Arabic: a form with validation messages, a count that needs plurals, a price, a date, a relative time and a list. Arabic exercises everything at once: right-to-left, Arabic-Indic digits, its own separators, currency placement and six plural forms. Its text is machine-written; the English column is how it is checked.

**D248** `rule` #i18n: Lint keeps the catalogs and direction honest: `eslint-plugin-i18next`'s `no-literal-string` on user-facing code, `stylelint-use-logical` on CSS, `sidekick/catalog-namespace` on catalogs, and a catalog check that fails on the same English text in two catalogs or a missing catalog for a supported locale. derived-from [[D243]] derived-from [[D246]]

- **`no-literal-string`** (open source, works with any library despite its name) flags hardcoded strings in JSX and code; tests and `packages/ops` are exempt. If it does not support ESLint 10 yet, lesson I2 writes the equivalent in `eslint-plugin-sidekick`.
- **`stylelint-use-logical`** (csstools) reports and fixes physical properties.
- **TypeScript** rejects unknown keys through `AppConfig`, so keys need no lint rule.
- **`sidekick/catalog-namespace`** (ours, on JSON through `@eslint/json`): a catalog has one top-level key, its package's namespace, and only `@sidekick/i18n` may use `common`.
- **The catalog check** (ours, a script, since ESLint reads one file at a time) is the drift guard: the same English text in two catalogs fails with "move it to `common`".

## Decision History

- 2026-11-05 · accepted · English only, i18n-ready, with next-intl and use-intl; replaces Centralized Copy (D36) when lesson I1 lands
