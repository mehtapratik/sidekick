import { defineCollection } from "astro:content";
import { glob } from "astro/loaders";
import { z } from "astro/zod";
import {
   DOCS_DIR,
   DOCS_EXCLUDE,
   WRITINGS_DIR,
   WRITINGS_EXCLUDE,
   docSlug,
   writingSlug,
} from "./lib/vault.mjs";

const text = z.union([z.string(), z.number()]).transform(String);

// Unknown frontmatter keys (id, depends_on, applies_to, …) are allowed and ignored.
const schema = z.object({
   // Only `publish: true` lists an entry. Any other value is "not published", never an error.
   publish: z.unknown().optional(),
   // Most vault notes take their title from the file name (see deriveTitle in lib/vault.mjs).
   title: text.optional(),
   deck: text.optional(),
   description: text.optional(),
   created: z.coerce.date(),
   updated: z.coerce.date().optional(),
   version: text.optional(),
   status: text.optional(),
   kind: text.optional(),
   // Older writings say `type: note` where vault notes say `kind:`.
   type: text.optional(),
   audience: text.optional(),
   tags: z
      .array(text)
      .nullish()
      .transform((t) => t ?? []),
});

const patterns = (exclude: string[]) => [
   "**/*.md",
   ...exclude.map((p) => `!${p}`),
];

export const collections = {
   writings: defineCollection({
      loader: glob({
         base: WRITINGS_DIR,
         pattern: patterns(WRITINGS_EXCLUDE),
         generateId: ({ entry }) => writingSlug(entry),
      }),
      schema,
   }),
   docs: defineCollection({
      loader: glob({
         base: DOCS_DIR,
         pattern: patterns(DOCS_EXCLUDE),
         generateId: ({ entry }) => docSlug(entry),
      }),
      schema,
   }),
};
