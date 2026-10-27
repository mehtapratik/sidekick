---
publish: false
id: prd.synergy.research-07
title: "Research: search across modules"
created: 2026-10-25
kind: research
tags:
   - prd
   - synergy
   - wayfinder
---

Research for ticket 07 ([[02-prd/synergy/tickets/07-search-across-modules|Search across modules]]). It lists facts and trade-offs only. The decision belongs to Pratik.

Sources: the Sidekick repo at commit `80b61cc` (`packages/core/src/db/rls.ts`, `packages/core/src/db/migrations/`), the [[02-prd/synergy/map|wayfinder map]], and the first-party docs linked below. Facts marked **(tested)** come from `EXPLAIN ANALYZE` runs on a local PostgreSQL 16.15 with a 300,000-row synthetic `entity_index` (50 owners, 6,000 rows each), a non-superuser role and a policy shaped like Sidekick's. PostgreSQL 17 docs describe the same behaviour for every feature used. The synthetic titles share most words, so the timings show plan shape, not production speed.

## What is being searched

Per the map, core keeps one thin row per entity (id, type, owner, title, version, status, updated time), with tags beside it: flat (`finance`) and `key:value` (`domain:spending`). Titles are short, often a handful of words. Search spans every module because the index does. Phase 6 adds `text-embedding-3-small` embeddings with an HNSW index.

Two query shapes follow from that:

- **Command palette / quick switcher:** the user types a few characters at a time, expects results per keystroke, and mistypes.
- **Search box / bot query:** the user or agent types whole words, maybe a phrase, maybe a tag.

## 1. Postgres full-text search

### Mechanics

- `to_tsvector(config, text)` turns text into normalized lexemes. With `english`, stop words drop and words stem: `rats` becomes `rat` ([textsearch-controls](https://www.postgresql.org/docs/17/textsearch-controls.html)).
- `setweight(..., 'A'|'B'|'C'|'D')` labels lexemes so a title match can outrank a tag match. Default rank weights are `{0.1, 0.2, 0.4, 1.0}` for D, C, B, A. Wrap nullable inputs in `coalesce`, since `to_tsvector(NULL)` is `NULL` (same page).
- **Stored generated column + GIN** is the documented pattern: `GENERATED ALWAYS AS (to_tsvector('english', ...)) STORED`, then `USING GIN (col)` ([textsearch-tables](https://www.postgresql.org/docs/17/textsearch-tables.html)).
   - Against an expression index, the separate column means queries need not name the config, and "searches will be faster, since it will not be necessary to redo the `to_tsvector` calls to verify index matches." The expression index "requires less disk space" (same page).
   - An expression index must use the two-argument `to_tsvector` with a named config, and the query must match it exactly (same page).
- **GIN vs GiST:** "GIN indexes are the preferred text search index type." GiST is lossy and needs heap rechecks; GIN stores no weight labels, so weighted queries recheck too ([textsearch-indexes](https://www.postgresql.org/docs/17/textsearch-indexes.html)).

### Query parsers

| Function               | Behaviour                                                                                                                                                                | Fit                                                       |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------- |
| `websearch_to_tsquery` | Unquoted words AND together, `"quoted"` is a phrase, `or` is OR, `-` is NOT. It "will never raise syntax errors, which makes it possible to use raw user-supplied input" | Search box, bot queries                                   |
| `plainto_tsquery`      | ANDs the words, ignores all operators                                                                                                                                    | Simple search box                                         |
| `phraseto_tsquery`     | Words must follow one another                                                                                                                                            | Exact phrase                                              |
| `to_tsquery`           | Full operator syntax, including prefix `word:*`; raises syntax errors on malformed input                                                                                 | Prefix search, but input must be escaped or built by code |

Source: [textsearch-controls](https://www.postgresql.org/docs/17/textsearch-controls.html).

### Ranking

- `ts_rank` ranks by match frequency; `ts_rank_cd` also weights proximity (cover density). Normalization flags divide by document length and so on; flag 32 rescales without changing order (same page).
- "Ranking can be expensive since it requires consulting the `tsvector` of each matching document." Supabase's hybrid example notes `ts_rank_cd` "is not indexable but will only rank matches of the where clause" ([Supabase hybrid search](https://supabase.com/docs/guides/ai/hybrid-search)). For short titles the per-row cost is small; the cost scales with the number of matches.
- For one- to five-word titles, frequency and proximity carry little signal: most matches hit each word once. Weights (title A, tags B) do most of the ranking work.

### Language configs (tested)

| Input                 | `english`                                                         | `simple`                    |
| --------------------- | ----------------------------------------------------------------- | --------------------------- |
| `Running the Budgets` | `'budget' 'run'`                                                  | `'budgets' 'running' 'the'` |
| `domain:spending`     | `domain`, `spend` (the `:` is a blank token, so the pair splits)  | `domain`, `spending`        |
| `budget-review`       | `budget-review`, `budget`, `review` (hyphenated word plus parts)  | same, unstemmed             |
| `café`                | `café` (accents kept; `unaccent` is a separate extension)         | same                        |
| query `the`           | Empty query, with the notice "contains only stop words … ignored" | matches `the`               |

- `english` stems, so `plans` finds `plan`, and it drops stop words. It assumes English text. Titles in other languages, names and codes such as `Q3` get stemmed or kept unpredictably.
- `simple` lowercases only. It is predictable for names and codes but misses `plan` vs `plans`.
- Both split `key:value` tags into two independent lexemes. A query for `domain:spending` also matches an entity tagged `domain:other` with `spending` in its title. Exact tag filtering belongs on the tags table with equality, not in FTS.
- Some teams index the same text twice (`english` weighted A, `simple` weighted B) to get stemming and exact tokens. This is a pattern, not a docs recommendation.

### Fit for short titles + tags

- Good: whole-word and multi-word queries, phrase queries, negation, tag words, raw user input through `websearch_to_tsquery`.
- Weak: no typo tolerance (`budjet` finds nothing); no partial words through `websearch_to_tsquery` (tested: `budg` does not match `budget`). Prefix needs `to_tsquery('simple', 'bud:*')` (tested: matches `Budget review`), which Supabase also shows ([Supabase FTS](https://supabase.com/docs/guides/database/full-text-search)), and the code must sanitize input before building it.

## 2. `pg_trgm`

### Mechanics

Source for this section: [pg_trgm](https://www.postgresql.org/docs/17/pgtrgm.html).

- A trigram is three consecutive characters. Each word gets two leading spaces and one trailing space; non-alphanumerics are ignored. Comparisons are case-insensitive in a default build.
- `similarity(a, b)`: shared trigrams over all trigrams, from 0 to 1. Operator `%`, threshold `pg_trgm.similarity_threshold`, default **0.3**.
- `word_similarity(q, text)`: best match of `q` against any continuous extent of `text`, so a short query against a long title still scores high. Operators `<%` / `%>`, default threshold **0.6**.
- `strict_word_similarity`: the same, but extents snap to word boundaries. Operators `<<%` / `%>>`, default **0.5**. The docs: strict is for "whole words", `word_similarity` "for parts of words".
- Distance operators `<->`, `<<->`, `<<<->` (1 − similarity) support `ORDER BY … LIMIT` nearest-neighbour search.
- Tested: `similarity('budget','budjet')` = 0.4; `word_similarity('budjet','Q3 budget review')` = 0.43; `word_similarity('bu','Q3 budget review')` = 0.67. A one-letter typo in a six-letter word passes `%` at 0.3 but fails `<%` at 0.6. The thresholds need tuning against real titles.

### Indexes

|                                      | GIN `gin_trgm_ops`       | GiST `gist_trgm_ops`                             |
| ------------------------------------ | ------------------------ | ------------------------------------------------ |
| `%`, `<%`, `<<%`                     | yes                      | yes                                              |
| `LIKE`, `ILIKE`, `~`, `~*`, `=`      | yes                      | yes                                              |
| `ORDER BY title <-> q LIMIT n` (KNN) | no: "not by GIN indexes" | yes, "quite efficiently"                         |
| Tuning                               |                          | `siglen` signature, default 12 bytes, up to 2024 |

- "A pattern with no extractable trigrams will degenerate to a full-index scan" for `LIKE` and regex. A one- or two-character `ILIKE '%bu%'` falls in this case (inference from the trigram rules; not measured).
- Trigram indexes "may not be as efficient as regular B-tree indexes" for equality.
- `pg_trgm` is a trusted extension: any role with `CREATE` on the database can install it.

### Fit for a command palette

- Typo tolerance and substring matching in one index, which FTS lacks.
- `ILIKE 'bud%'` on a title gives a literal prefix match; `word_similarity` gives "starts like" ranking for partial words.
- No stemming, no stop words, no phrase or negation syntax, no idea of word importance. For three or more words of whole-word input, FTS ranks better.
- A per-user `entity_index` holds thousands to tens of thousands of rows, not millions. At that size, a bounded scan of one owner's rows with `word_similarity` stays in the tens of milliseconds (tested: 6,000 rows per owner, about 35 ms on pathological data where every title shares words).

## 3. Supabase availability and RLS

### Extensions on Supabase

- `pg_trgm`, `vector`, `unaccent`, `btree_gin` and `fuzzystrmatch` are all in Supabase's catalog. Enable them from Dashboard → Database → Extensions or with SQL. Most install into the `extensions` schema; Supabase advises against creating other objects there ([Supabase extensions](https://supabase.com/docs/guides/database/extensions)).
- Full-text search is core Postgres: no extension to enable.
- Drizzle has no code for `CREATE EXTENSION` and assumes the extension exists ([Drizzle extensions](https://orm.drizzle.team/docs/extensions)). Sidekick's migrations would need a hand-written `create extension if not exists pg_trgm with schema extensions;`.
- With extensions in `extensions`, a function pinned to `search_path = ''` (Supabase's rule for `security definer`) must qualify operators: `title operator(extensions.%) q`, opclasses as `extensions.gin_trgm_ops`.

### RLS: how search operators interact with policies

Postgres evaluates policy expressions "prior to any conditions or functions coming from the user's query", except `leakproof` functions, which "the optimizer may choose to apply … ahead of the row-security check" ([ddl-rowsecurity](https://www.postgresql.org/docs/17/ddl-rowsecurity.html), [CREATE POLICY](https://www.postgresql.org/docs/17/sql-createpolicy.html)).

None of the search operators are leakproof (tested, `pg_proc.proleakproof`): `similarity_op` (`%`), `word_similarity_op`, `ts_match_vq` (`@@`), `textlike`, `texticlike` are all `false`. `uuid_eq` and `texteq` are `true`.

What that does to plans **(tested, running as a non-owner, non-superuser role under RLS)**:

| Policy and query                                                                                                                                               | Plan                                                                                                                                                                          |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Sidekick's current shape, `owner_id::text = current_setting('app.current_user_id', true)`, with `%`, `ILIKE` or `@@`                                           | **Parallel seq scan** of all 300,000 rows. The cast on the column stops the `owner_id` B-tree from matching, and the search operator cannot use its index ahead of the policy |
| `owner_id = nullif(current_setting(...), '')::uuid` with `%` or `@@`                                                                                           | B-tree scan on `owner_id`, then the search condition runs as a **filter** over that owner's 6,000 rows. The GIN index is never used                                           |
| Same policy, `ORDER BY title <-> q LIMIT 10` with a GiST trigram index                                                                                         | GiST KNN index scan, owner check as a filter. Ordering is not a qual, so the index still serves it                                                                            |
| `security definer` function (owner bypasses RLS) with explicit `owner_id = … AND title % q` and a `btree_gin` composite index `(owner_id, title gin_trgm_ops)` | **Both conditions as index conditions** on the composite GIN index                                                                                                            |
| Same queries as superuser (RLS bypassed)                                                                                                                       | GIN index used directly for `@@` and `%`                                                                                                                                      |

Takeaways, as facts:

- Under RLS, the B-tree on the owner column decides the plan; the GIN or trigram index cannot help a filtering query. Search cost is roughly linear in the rows one user owns.
- Sidekick's existing policies (`0002_profiles_rls_policy.sql`, `0007_user_feature_entitlements_rls.sql`) cast the column to `text`. Copying that shape to `entity_index` gives a full table scan across every user's rows. Comparing `owner_id = (select …)::uuid` keeps the owner index usable. Supabase recommends indexing policy columns and wrapping function calls in `select` so they run once as an `initPlan` ([Supabase RLS](https://supabase.com/docs/guides/database/postgres/row-level-security)).
- Supabase also recommends repeating the policy filter in the query, because "Postgres can use the filter to construct a better query plan" ([Supabase RLS performance](https://supabase.com/docs/guides/database/postgres/row-level-security-performance)). This helps the owner B-tree. It does not lift the leakproof restriction.
- A `security definer` function restores full index use, at a price:
   - It skips RLS only when its owner can (`postgres` has `bypassrls` on Supabase). It must set `search_path = ''` and live outside exposed schemas ([Supabase RLS](https://supabase.com/docs/guides/database/postgres/row-level-security)). The Data API is off in Sidekick, so exposure through PostgREST is not a live risk; the RLS bypass is.
   - The function becomes the only thing standing between users. It must read the user id from the transaction setting (which `withRLS` sets), never trust an argument.
   - It carves an exception into "all user data under RLS via `app_runtime`".
- Marking `pg_trgm` or text-search functions `LEAKPROOF` is a superuser act, and the docs reserve it for functions "guaranteed to not leak information". These functions can raise errors on input, which is what leakproof forbids. Supabase does not give customers superuser.

## 4. Drizzle

Sidekick pins `drizzle-orm ^0.45.4` and `drizzle-kit ^0.31.11` (`packages/core/package.json`).

- **`tsvector` column:** Drizzle has no built-in type; the guide defines one with `customType` returning `tsvector` as `dataType()`. The column uses `.generatedAlwaysAs((): SQL => sql\`to_tsvector('english', ${t.title})\`)`. Postgres supports only `STORED` generated columns, and the expression cannot reference another generated column or a subquery ([Drizzle FTS with generated columns](https://orm.drizzle.team/docs/guides/full-text-search-with-generated-columns), [Drizzle generated columns](https://orm.drizzle.team/docs/generated-columns)).
- **Weighted vector:** the same guide shows `setweight(to_tsvector('english', ${t.title}), 'A') || setweight(..., 'B')` inside `sql`.
- **GIN index:** `index('idx').using('gin', t.search)`. Expression indexes are supported: `index('title_search_index').using('gin', sql\`to_tsvector('english', ${t.title})\`)` ([Drizzle PostgreSQL FTS](https://orm.drizzle.team/docs/guides/postgresql-full-text-search)).
- **Operator classes:** `.op('...')` sets one per column ([Drizzle indexes](https://orm.drizzle.team/docs/indexes-constraints)). The docs show `.op('vector_cosine_ops')` on HNSW; `gin_trgm_ops` follows the same method but no Drizzle page shows it.
- **Queries:** `@@`, `%`, `word_similarity`, `ts_rank` and the parsers are all raw `sql` fragments, for example ``.where(sql`${t.search} @@ websearch_to_tsquery('english', ${q})`)`` and ``rank: sql`ts_rank(...)` `` with `orderBy(desc(...))` (same guide). Drizzle has no typed helpers for FTS or trigram.
- **pgvector:** `vector('embedding', { dimensions: 1536 })`, `index(...).using('hnsw', t.embedding.op('vector_cosine_ops'))`, and helpers such as `cosineDistance()` mapping to `<=>` ([Drizzle extensions](https://orm.drizzle.team/docs/extensions)).
- **Not covered by Drizzle:** `CREATE EXTENSION`, `security definer` functions and RLS policies with this repo's custom shape. Sidekick already writes those as hand-written SQL migrations (`0001`–`0008`).

## 5. Adding embeddings later

### Hybrid search and RRF

- pgvector's README: "Use together with Postgres full-text search for hybrid search", combining results with "Reciprocal Rank Fusion or a cross-encoder" ([pgvector](https://github.com/pgvector/pgvector)).
- Supabase's reference `hybrid_search` function runs two CTEs, full text (`fts @@ websearch_to_tsquery`, `row_number()` over `ts_rank_cd`) and semantic (`row_number()` over `embedding <#> query_embedding`). It joins them with a `full outer join` on `id` and orders by `coalesce(1.0 / (rrf_k + rank), 0) * weight` summed across both. Defaults: `full_text_weight = 1`, `semantic_weight = 1`, `rrf_k = 50` ([Supabase hybrid search](https://supabase.com/docs/guides/ai/hybrid-search)).
- RRF uses ranks, not scores. A `ts_rank`, a trigram similarity and a cosine distance can fuse without calibration, and a third list (trigram) slots in as one more CTE. Each list must be capped (`limit`) before fusion.

### Facts that bear on the handover

- `text-embedding-3-small` returns 1,536 dimensions by default, and the `dimensions` parameter shortens it ([OpenAI embeddings](https://developers.openai.com/api/docs/guides/embeddings)). HNSW on `vector` supports up to 2,000 dimensions; `halfvec` up to 4,000 and is smaller ([pgvector](https://github.com/pgvector/pgvector)).
- HNSW needs no training and is "safe to build … immediately after the table is created" ([Supabase HNSW](https://supabase.com/docs/guides/ai/vector-indexes/hnsw-indexes)).
- "With approximate indexes, filtering is applied after the index is scanned", and results are capped by `hnsw.ef_search` (default 40). Iterative index scans (pgvector 0.8.0+) keep scanning until enough rows pass ([pgvector](https://github.com/pgvector/pgvector)). Under RLS the owner policy is such a filter. One user's rows are a small fraction of a shared HNSW index, so without iterative scans a semantic query can return few or no rows. The README suggests partial indexes or partitioning when filtering by many values. Which pgvector version Supabase ships was not checked.
- Short titles carry little meaning for an embedding. Embedding the title alone, or the title plus a module-supplied summary, is a Phase 6 decision that changes how much semantic search adds over FTS + trigram.
- An entity index row that changes title must re-embed. FTS generated columns update in the same write; embeddings need an async job (Supabase documents one approach in [Automatic embeddings](https://supabase.com/docs/guides/ai/automatic-embeddings); not read for this note).

## Options in brief

| Option                                                    | Palette (prefix, typos)                                      | Search box (words, phrases)          | Index use under RLS                                    | Moving parts                                                     |
| --------------------------------------------------------- | ------------------------------------------------------------ | ------------------------------------ | ------------------------------------------------------ | ---------------------------------------------------------------- |
| FTS only                                                  | Prefix via `to_tsquery(':*')` with sanitized input; no typos | Strong                               | Owner B-tree, FTS as filter                            | Generated column, GIN                                            |
| Trigram only                                              | Strong                                                       | Weak ranking, no phrases or negation | Owner B-tree, trigram as filter; GiST serves KNN order | Extension, GIN or GiST                                           |
| Both, fused (RRF or `coalesce` of scores)                 | Strong                                                       | Strong                               | As above                                               | Both, plus a fusion query that Phase 6 extends with a vector CTE |
| Any of the above via a `security definer` search function | same                                                         | same                                 | Full GIN use with `btree_gin` composite index          | One audited RLS exception                                        |

## Open questions this research does not settle

- Expected rows per user in `entity_index` after a year. Below tens of thousands, the RLS filter-scan cost is likely acceptable and the `security definer` route buys little.
- `english`, `simple`, or both, given titles that mix English, names and codes.
- Whether tags enter the search vector (as weight B) or stay a separate exact filter, given that `key:value` splits in FTS.
- Whether Sidekick's existing `::text` cast policies should change, which matters to every RLS table, not only search.
- The pgvector version on Sidekick's Supabase project, which decides whether iterative scans are available for Phase 6.
