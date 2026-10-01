# Arkive — build specification

Arkive (https://arkive.blog) is Pratik Mehta's online journal: essays, notes and the working documents
of Project Sidekick. This spec describes a **from-scratch rebuild**. Do not port the old
implementation or its workarounds. Where this spec and the old code disagree, this spec wins.

Files in this handover:

| File | What it is |
| --- | --- |
| `SPEC.md` | This document: what to build and why. |
| `arkive.css` | The complete stylesheet. Ship it as-is; change it only to fix a bug. |
| `arkive.js` | The complete client script: progressive enhancement only. |
| `shiki-themes.mjs` | The two code-highlighting themes for Astro's Shiki. |
| `reference/entry.html` | **The markup contract** for an entry page, with real content and the real Index. |
| `reference/home.html` | Same contract for `/` (newest entry + site tagline). |
| `reference/specimen.html` | Every element an entry body can contain. Use it as the visual regression page. |
| `reference/entries.sample.json` | The current vault's entries as the site would derive them (see §3 caveat). |
| `reference/tree.py` | The reference implementation of the folder-tree rules (§5.3). |

Serve the folder with any static server (`npx serve handover`) and open `reference/entry.html` to see
the finished behaviour. Your Astro output should produce the **same HTML structure** as these pages.

---

## 1. Principles (from the owner, non-negotiable)

1. **Reading comes first.** Everything that isn't the text is removed, or tucked into a corner,
   even on large screens.
2. **No home-page design.** `/` shows the most recent entry in full. From there, readers move
   previous/next through time.
3. **Browse, search and filter live in one corner control.** It opens a full-screen Index over the page.
4. **The Index lists every entry, newest "as of" first.** Search and a tag filter narrow it. The filter
   lasts until the browser session ends or the reader changes it. While it is on, previous/next only
   visit matching entries.
5. **Each entry shows its metadata as a table under the title.** Tag names in it are links that set
   the Index filter.
6. **Start from browser defaults; only add.** HTML is responsive by itself. Never add a style and
   then override it to get responsiveness back. **No media queries.** If something seems to need
   one, rethink it.
7. **The same rule applies to scripts.** Use native behaviour (popover, details, forms, links) first.
   Script only what the platform can't do, and make it optional.
8. **Light and dark** follow the OS, through `color-scheme` and system colours.

The look is deliberately close to a research paper or a Wikipedia article: system fonts, the
browser's own link colours (including visited), native buttons, ruled tables.

## 2. Stack

- **Astro**, current major version, `output: "static"`. No UI framework integration (no React, Vue
  or Svelte). No Tailwind, no CSS-in-JS, no CSS preprocessor.
- **One stylesheet** (`/arkive.css`), linked in `<head>`. **One script** (`/arkive.js`), loaded with
  `<script type="module">`. No other client JS, no web fonts, no third-party requests.
- Markdown through Astro content collections (glob loaders), plus small remark/rehype plugins you
  write (§6).
- Code highlighting with Astro's built-in Shiki and `shiki-themes.mjs` (`defaultColor: false`).
- Static hosting. The current site deploys to Cloudflare. Keep `public/_redirects` working.

## 3. Content

### 3.1 Sources

Read Markdown straight from the authoring folders. **No intermediate ingest or copy step.**

| Collection | Folder | Excluded paths (never built, whatever their frontmatter says) |
| --- | --- | --- |
| `writings` | `sources/writings/` | `_archive/**` |
| `docs` | `sources/docs/` (an Obsidian vault) | `00-principles/**`, `01-motivations/**`, `_assets_/**`, `.obsidian/**`, `**/*.canvas` |

The excluded vault folders are private. Add a post-build check that fails the build if any HTML
file or the RSS feed contains text from, or a link to, an excluded path.

### 3.2 Frontmatter

```ts
// zod; unknown keys are allowed and ignored
{
  publish:  z.literal(true).optional(),   // REQUIRED to be listed — see below
  title:    z.string(),
  deck:     z.string().optional(),        // one-line summary; fall back to `description`
  created:  z.coerce.date(),
  updated:  z.coerce.date().optional(),
  version:  z.string().optional(),
  status:   z.string().optional(),        // shown verbatim, e.g. active, draft, approved
  kind:     z.string().optional(),        // essay | note | spec | plan | prd | decision | guidance | glossary | opportunity …
  audience: z.string().optional(),
  tags:     z.array(z.string()).default([]),
}
```

**`publish: true` is the only way in.** An entry without it, or with any other value, does not exist
on the site: no page, no Index row, no tag page, no RSS item, no sitemap entry, and links to it render
as plain text (§6). This is opt-in by design. Vault notes are private until marked.

Derived at build time:

- **`asOf` = `updated` ?? `created`**, from frontmatter only. Never use file modification time, git
  time or build time. (The old site stamped every vault doc with its build date. That was the bug
  this rule removes.)
- **Words**: counted from the rendered body text. **Minutes** = `max(1, round(words / 230))`.
- **Kind**: frontmatter `kind`, else `essay` for writings, `doc` for docs.
- **Tags**: lower-cased, trimmed, leading `#` removed. Do not merge near-duplicates (e.g.
  `phase-1-1` and `phase-1.1`); that is an authoring fix.

> `reference/entries.sample.json` was built from today's content as if every entry had
> `publish: true` (MOC/index notes removed, as the owner is deleting them). The real site lists only
> what is marked.

### 3.3 Order

One stream across both collections, sorted by **`asOf` descending, then `created` descending, then
`title` ascending** (case-insensitive). Every ordering in the site (`/`, previous/next, Index, tag
pages, RSS) uses this one comparator. Define it once.

### 3.4 URLs

Keep today's public URLs so existing links keep working:

- writings: `/writings/<file-slug>/`
- docs: `/docs/<section>/<path-slug>/`, where the section folder maps to a slug:
  `02-prd → prd`, `03-system-design → system-design`, `04-plans → plans`, `05-builds → builds`,
  `06-decisions → decisions`, `07-glossary → glossary`, `08-ai-coding-harness → harness`.
  Path segments are slugified (lower case; spaces and underscores → `-`; numeric prefixes such as
  `02-` dropped from folder names).

Before launch, crawl the old site's `dist/` (or sitemap) and add a `_redirects` line for every old
URL that no longer resolves. URLs are permanent.

## 4. Routes

| Route | Content |
| --- | --- |
| `/` | The newest published entry, rendered with the entry template, plus the site tagline under the header. `<link rel="canonical">` points at the entry's permanent URL. |
| entry URLs | The entry template (§5). |
| `/tags/<tag>/` | No-JS fallback for the tag filter: header, `<h1>Tagged “<tag>”</h1>`, the count line, and the same entries table as the Index, pre-filtered. |
| `/rss.xml` | Newest 50 entries: title, link, `pubDate` = asOf, description = deck, or the first paragraph when there is no deck. |
| `/404.html` | Header, "Not found", a link home. |
| `/sitemap.xml` | Published entry URLs. |

There is no archive page, category page, about page, search page or featured list. The Index is
all of those.

## 5. Page anatomy

**`reference/entry.html` is the contract.** Reproduce its element structure, class names, `id`s and
`data-*` attributes exactly. `arkive.css` and `arkive.js` depend on them. In outline:

```
body[data-entry="<this entry's URL>"]
  header.site
    div.masthead
      a.wordmark[href="/"]                 "Arkive"
      p > button[popovertarget=index][data-index-button]   "Index"
    p.tagline.blurb                        (on / only)
  main > article
    h1, p.deck?
    table > tbody                          metadata rows (below)
    …rendered Markdown…
  hr
  nav[aria-label="Previous and next entries"]
    div.pager
      p  "← Previous" <br> span[data-slot=prev] > a[rel=prev] | span.muted "None. This is the earliest entry."
      p  "Next →"     <br> span[data-slot=next] > a[rel=next] | span.muted "None. This is the latest entry."
    p  small.muted[data-scope]  button[data-clear][hidden] "Clear filter"
  hr
  footer > p > small.muted   "Pratik Mehta · CC BY-NC 4.0 · RSS"
  div#index[popover]         (the Index, §5.2)
```

### 5.1 Metadata table

Rows, in order, with `th[scope=row]` labels. Omit a row whose value is missing.

| Label | Value |
| --- | --- |
| As of | `asOf` as `YYYY-MM-DD` in `<time datetime>` |
| First written | `created`, only when it differs from `asOf` |
| Version | `version (status)` |
| Kind | `kind`, plus `, for <audience>` when there is an audience |
| Length | `1,234 words, about 6 min` |
| Tags | `a[href="/tags/<tag>/"][data-tag="<tag>"]`, comma-separated |

No author row (always the owner) and no license row (the footer states it once for the site).

### 5.2 The Index

A `<div id="index" popover>` **server-rendered on every page**, so it works without JS and opens
instantly. It covers the viewport, and its content uses the same reading column. Contents, in order:

1. The same header, with `button[popovertarget=index][popovertargetaction=hide]` "Close" in place of Index.
2. `h2#index-heading` "Index", then `p.blurb` with the site description:
   *Notes, decisions, and progress on my journey as I build Project Sidekick — built in the open; written as it happens.*
3. `form[role=search][hidden]`: a label, `.searchrow` (`input#index-search[type=search]` + `button[data-clear][hidden]` "Clear"),
   and `p.active-tag[data-active-tag][hidden]` "Tag: <b></b> (remove)". The form ships hidden because
   search needs JS. The script reveals it.
4. `<details>` (closed) `<summary>Tags (N)</summary>` and `ul.cloud`, alphabetical:
   `li > a[href="/tags/<t>/"][data-tag="<t>"]` + ` <span class="muted">(count)</span>`.
5. The view switch: two native radios in one row, **By date** checked by default:
   `p.view-switch[role=radiogroup]` > "View:" + `label > input[type=radio][name=index-view]#view-date[value=date][checked]`
   + `label > input…#view-folder[value=folder]`. CSS alone shows the matching view, with `:has()`;
   browsers without `:has()` show both views. These are deliberately not ARIA tabs, which would need
   JS to work at all.
6. `p[data-count]` "N entries."
7. `div.by-folder > ul.tree`: the folder tree (§5.3).
8. `div.by-date > table.entries`: columns As of, Title, Kind, newest first. Each `tr` carries `data-url`,
   `data-title`, `data-tags` (space-separated) and `data-search` (lower-cased title + deck + kind + tags).
   The title cell has the link (with `aria-current="page"` and ` (reading)` on the current entry), the
   deck in `small.muted`, and the tag links in `small`.
9. `p[data-none][hidden]` "No entries match." + Clear filter.

At about 210 entries the Index (table plus tree) adds about 220 KB raw, roughly 20 KB compressed, per page. That's fine.
If the site passes about 1,000 published entries, render the Index once at `/index/` and have the
popover fetch that fragment on first open instead.

### 5.3 The folder tree (By folder)

Only native disclosure, no ARIA tree role and no custom keyboard handling:

```html
<ul class="tree">
  <li class="folder" data-total="94">
    <details>                                   <!-- `open` when it contains the current entry -->
      <summary>System design <span class="muted">(<span data-folder-count>94</span>)</span></summary>
      <ul>
        …sub-folders first (alphabetical by label), then entries in the global order…
        <li data-url="/docs/system-design/opportunities/api-route-fail-open/">
          <a href="…">API route fail open</a><br><small class="muted"><time datetime="2026-09-19">2026-09-19</time></small>
        </li>
      </ul>
    </details>
  </li>
</ul>
```

Build rules. The reference build is in `tree.py` beside the reference pages; match its output.

- **Top level**, in this order: Writings, Product requirements (`prd`), System design, Plans, Builds,
  Decisions, Glossary, AI coding harness (`harness`). Doc sections sit at the top level; there is no
  extra "Docs" folder.
- **Folder labels** come from the folder slug in sentence case, keeping known spellings (AI, API, CLI,
  CSS, PWA, RAG, UX, Next.js, TypeScript, ESLint) and "Non-functional". Folders named `phase-N-…` read
  "Phase N: …".
- **Single-child chains collapse.** A folder whose only content is one sub-folder merges with it:
  "Decisions / Technical", "Phase 1: Supabase and auth shell / Tasks".
- **Single-entry folders flatten.** A sub-folder holding exactly one entry and no sub-folders is removed,
  and its entry moves up into the parent.
- **An entry whose path is also a folder** (e.g. `…/observability.md` beside `…/observability/`) is
  listed first inside that folder.
- Leaves have the title link on line one and the as-of date on line two, with ½ line between items.
- With no filter, only the folders on the path to the current entry are open.

### 5.4 Home page tagline

Only `/` shows `p.tagline.blurb` under the wordmark. Readers who type the domain need to know what
Arkive is. Readers arriving at a post came for that post. Everyone else meets the description at
the top of the Index.

## 6. Markdown → HTML

Write these as small remark/rehype plugins. Each one's output must match `reference/specimen.html`.

- **Tables**: wrap every `<table>` in `<div class="wide">`. That lets a wide table extend past the column to
  the viewport edge and then scroll.
- **Callouts**: Obsidian `> [!kind] Optional title` becomes `<aside class="callout"><p class="callout-title">Title or Kind</p>…</aside>`.
  Same look for every kind. No icons.
- **Code blocks**: Shiki output wrapped as
  `<figure class="code"><div class="code-head"><span class="muted">TypeScript</span><button type="button" data-copy hidden>Copy</button></div><pre …>…</pre></figure>`.
  The label comes from the fence language (ts → TypeScript, tsx → TSX, js → JavaScript, json → JSON,
  bash/sh/shell → Shell, sql → SQL, yaml → YAML, md → Markdown, none → Code).
- **Headings** get `id`s for deep links. Show no visible anchor glyph.
- **Thematic breaks** (`---`) stay plain `<hr>`.
- **Wikilinks** `[[Note]]` / `[[Note|label]]` / `[[Note#Heading]]` resolve to the target's URL. A
  target that is unpublished or missing renders as plain text, never a dead link.
- **Embeds** `![[image.png]]` resolve from the vault's `_assets_/`, are copied to the output, and get
  `loading="lazy"`, `width` and `height`.
- Strip the vault's leading `# Title` from the body when it repeats the frontmatter title.

## 7. Behaviour

Without JS (must fully work):

- Index opens and closes (`popovertarget`, Esc, light dismiss), lists all entries, tag links go to `/tags/<t>/`.
- Previous/next follow the global order.
- Copy buttons and the search form stay hidden.
- The By date / By folder switch works (CSS `:has()`), and folders open and close.

With `arkive.js` (already written; don't rewrite it, fix it if needed):

- Search (title, deck, kind, tags) and one active tag narrow the Index live. The count line and the
  "No entries match" state update with them.
- In the tree, non-matching entries and empty folders hide, folder counts read "13 of 94", and every
  folder with matches opens. When the filter changes again, open state is recomputed. When it is cleared,
  folders return to their server-rendered open state. Folders the reader opens or closes by hand stay that
  way until the filter next changes.
- The chosen view (By date / By folder) is remembered for the session (`arkive:view`).
- A tag link **inside the Index** toggles that tag and keeps the search text. A tag link **in an article**
  starts a fresh filter on that tag and opens the Index.
- The filter persists in `sessionStorage` (`arkive:filter`) until the session ends or it is cleared.
- While a filter is on: the button reads **"Index (filtered)"**, previous/next are recomputed to the
  nearest older and newer matching entries, the scope line names the filter, and "Clear filter" shows.
- Clicking the wordmark clears the filter and goes to `/`.
- Copy buttons copy the block's text and read "Copied" for 1.6 s.

## 8. Visual decisions (encoded in `arkive.css`)

| Decision | Why |
| --- | --- |
| `system-ui`, 1.6 line height, 60ch column | Chosen by the owner on the design canvas. Measure and leading are the reading experience. |
| Rhythm in `rlh` (1 and ½ lines) | Every gap is a multiple of one body line. Borders are drawn as inset shadows so they don't shift the grid. |
| Browser link colours, including visited | The owner asked for defaults. Visited state helps readers of a journal. |
| Research-paper tables (horizontal rules only) | Matches the academic register. Fewer lines than a full grid. |
| Wide tables leave the column, then scroll | Squeezing many columns into 60ch hurts reading more than a wider table does. |
| Native buttons at body size with padding | Noticeable without a custom control. |
| Header hairline, home-only tagline | Separates chrome from text. Tells first-time visitors what the site is. |
| Five-colour code theme | "Basic" highlighting. Readable in both schemes. |

No theme toggle: the OS setting decides. No icons, no images in the chrome, no animation.

## 9. Accessibility

- Landmarks: `header`, `main`, `nav` (labelled), `footer`. The Index has `aria-labelledby`.
- One `h1` per page. Heading levels in bodies are never skipped by the templates.
- The Index button carries an `aria-label` describing the filter (the script maintains it).
- The current Index row's link has `aria-current="page"`. The active tag has `aria-current="true"`.
- Every colour pair meets WCAG AA in both schemes. Check `--muted` against `Canvas` in Chrome, Safari and Firefox.
- Everything works by keyboard: Tab order is header → article → pager → footer, and the Index traps nothing.

## 10. Acceptance checks

Automate these with Playwright, run against `astro preview`, at 1280×900 and 390×844, in light and dark:

1. No page scrolls horizontally (`documentElement.scrollWidth === innerWidth`), including pages with long URLs and wide tables.
2. On the Model selection strategy entry, each `.wide` is ≥ the article width and ≤ the viewport minus 2em. At 390px it scrolls inside itself.
3. The Index button opens the Index. Clicking tag `security` in the cloud shows "15 entries of 210 match tag “security”…" (with sample data). Typing `rls` narrows it further.
4. With a filter on, reload: the button still reads "Index (filtered)", and previous/next point to matching entries only.
5. Clicking "Clear filter" restores "Index" and the global previous/next.
6. A tag link in an article opens the Index filtered to that tag alone.
7. The Copy button puts the code text on the clipboard and shows "Copied".
7a. Choosing By folder hides the table and shows the tree, and the choice survives a reload. With tag
    `security` on, the tree shows 15 entries in 6 open folders, including "System design (13 of 94)".
    Clearing the filter leaves only the current entry's folders open.
8. With JS disabled, the Index still opens and closes, the view switch still works, tag links go to
   `/tags/<t>/`, and the search form is not visible.
9. An entry without `publish: true` has no page and appears nowhere. A link to it renders as text.
10. No built file contains an excluded private path (§3.1).
11. Write a Markdown fixture with the same elements as `reference/specimen.html`, render it through the
    real pipeline in a test-only page (not built for production), and compare it with the reference page.

## 11. Out of scope

Comments, analytics UI, newsletter, related posts, reading progress bars, table of contents,
share buttons, OG image generation (can come later), a manual theme toggle, full-text search
(the Index searches title, deck, kind and tags; add Pagefind later only if the owner asks).

## 12. Known caveats

- `100vw` in `.wide` includes the classic scrollbar on Windows, so a full-bleed table can be a few
  pixels too wide there. If that shows up, make `html` a size container and use `100cqi` instead.
- Browsers differ on default link colours in dark mode. If one shows `#0000EE` on a dark background,
  add the two `light-dark()` lines noted in `arkive.css`.
- The vault still contains link-only stub notes (for example the AI-coding-harness standards). With
  `publish: true` as the gate, they stay off the site until the owner marks them.
