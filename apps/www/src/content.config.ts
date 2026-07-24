import { glob } from "astro/loaders";
import { defineCollection, z } from "astro:content";

const entrySchema = z.object({
   title: z.string(),
   deck: z.string().optional(),
   created: z.coerce.date(),
   updated: z.coerce.date().optional(),
   version: z.string().optional(),
   tags: z.array(z.string()).default([]),
   section: z.enum(["writings", "core-drive", "plans", "builds", "notes"]),
   type: z.enum([
      "essay",
      "blog",
      "core-drive",
      "plan",
      "decision",
      "build",
      "note",
   ]),
   seed: z.string().optional(),
   sourcePath: z.string(),
   wordCount: z.number(),
   readingMinutes: z.number(),
   author: z.string(),
   license: z.string().optional(),
   audience: z.string().optional(),
   status: z.enum(["active", "wip", "draft", "deprecated"]).optional(),
   description: z.string().optional(),
});

function collection(
   name: "writings" | "core-drive" | "plans" | "builds" | "notes",
) {
   return defineCollection({
      loader: glob({ base: `./src/content/${name}`, pattern: "**/*.md" }),
      schema: entrySchema,
   });
}

export const collections = {
   writings: collection("writings"),
   "core-drive": collection("core-drive"),
   plans: collection("plans"),
   builds: collection("builds"),
   notes: collection("notes"),
};
