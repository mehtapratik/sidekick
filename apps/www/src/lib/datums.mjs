// Datums: single claims written inline in a page (principles, decisions, rules, requirements).
// A datum is one line that starts with its id and kind:
//
//    **D12** `rule` #api #security: The claim, in one or two sentences. derived-from [[D5]]
//
// The id is `D<n>`, global and never reused or changed. The kind says what sort of claim it is.
// `#tags` are optional. Relations are a relation word followed by a wikilink, using Synergy's
// vocabulary plus `violates` and `exception-to`; a wikilink to `D<n>` points at another datum.
import fs from 'node:fs';
import { resolveWikilink, scanVault } from './vault.mjs';

export const DATUM_KINDS = [
   'principle',
   'decision',
   'rule',
   'requirement',
   'concept',
   'learning',
   'outcome',
];

/** Relation words. Pairs share a line; the second word reads the same link from the other side. */
export const RELATIONS = [
   'derived-from',
   'source-of',
   'cites',
   'cited-by',
   'supported-by',
   'evidence-for',
   'explained-by',
   'explains',
   'inspired-by',
   'inspiration-for',
   'next',
   'previous',
   'related-to',
   'contradicts',
   'defined-by',
   'defines',
   'superseded-by',
   'supersedes',
   'violates',
   'violated-by',
   'exception-to',
   'has-exception',
];

const MARKER = /^\s*(?:[-*]|\d+\.)?\s*\*\*(D\d+)\*\*\s+`([^`]+)`\s*(.*)$/;
const REL = new RegExp(
   `(?:^|[\\s.;,])(${RELATIONS.join('|')})\\s+\\[\\[([^\\]]+?)\\]\\]`,
   'g',
);

/** Every datum in every non-excluded doc, in file then line order. `published` follows the file. */
export function scanDatums() {
   const out = [];
   for (const f of scanVault().filter(
      (f) => f.collection === 'docs' && !f.excluded,
   )) {
      const lines = fs
         .readFileSync(f.abs, 'utf8')
         .replace(/^---\n[\s\S]*?\n---\n/, '')
         .split('\n');
      let fence = false;
      for (const [i, line] of lines.entries()) {
         if (line.startsWith('```')) fence = !fence;
         if (fence) continue;
         const m = line.match(MARKER);
         if (!m) continue;
         const [, id, kind, rest] = m;
         const relations = [...rest.matchAll(REL)].map((r) => ({
            type: r[1],
            target: r[2].split('|')[0].split('#')[0].trim(),
         }));
         const claim = rest
            .replace(
               new RegExp(
                  `\\s*\\b(${RELATIONS.join('|')})\\s+\\[\\[[^\\]]+?\\]\\]`,
                  'g',
               ),
               '',
            )
            .replace(/\s*\[\[[^\]]*\|Why\?\]\]/g, '')
            .replace(/\[\[([^\]|]*\|)?([^\]]*)\]\]/g, '$2')
            .replace(/(^|\s)#[a-z][\w-]*/g, '')
            .replace(/^\s*:\s*/, '')
            .replace(/\s+/g, ' ')
            .trim();
         const tags = [...rest.matchAll(/(?:^|\s)#([a-z][\w-]*)/g)].map(
            (t) => t[1],
         );
         out.push({
            id,
            n: Number(id.slice(1)),
            kind,
            claim,
            tags,
            relations,
            rel: f.rel,
            line: i + 1,
            url: f.url,
            published: f.published,
         });
      }
   }
   return out;
}

/** The first problems that should stop a build: duplicate ids, unknown kinds, unresolved relations. */
export function datumProblems(datums = scanDatums()) {
   const problems = [];
   const byId = new Map();
   for (const d of datums) {
      if (byId.has(d.id))
         problems.push(
            `${d.id} is defined twice: ${byId.get(d.id).rel} and ${d.rel}`,
         );
      else byId.set(d.id, d);
      if (!DATUM_KINDS.includes(d.kind))
         problems.push(`${d.id} has an unknown kind "${d.kind}" in ${d.rel}`);
   }
   for (const d of datums) {
      for (const r of d.relations) {
         if (/^D\d+$/.test(r.target)) {
            if (!byId.has(r.target))
               problems.push(
                  `${d.id} (${d.rel}) ${r.type} ${r.target}, which does not exist`,
               );
         } else if (!resolveWikilink(r.target, d.rel, 'docs')) {
            problems.push(
               `${d.id} (${d.rel}) ${r.type} [[${r.target}]], which does not resolve`,
            );
         }
      }
   }
   return problems;
}

/** The next free id. */
export function nextDatumId(datums = scanDatums()) {
   return 'D' + (Math.max(0, ...datums.map((d) => d.n)) + 1);
}
