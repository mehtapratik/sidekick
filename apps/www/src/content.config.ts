import { glob } from "astro/loaders";
import { defineCollection, z } from "astro:content";

const entrySchema = z.object({
   title: z.string(),
   deck: z.string().optional(),
   created: z.coerce.date(),
   updated: z.coerce.date().optional(),
   version: z.string().optional(),
   tags: z.array(z.string()).default([]),
   category: z.enum(["essays", "plans", "decisions", "builds", "notes"]),
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
   name: "essays" | "plans" | "decisions" | "builds" | "notes",
) {
   return defineCollection({
      loader: glob({ base: `./src/content/${name}`, pattern: "**/*.md" }),
      schema: entrySchema,
   });
}

export const collections = {
   essays: collection("essays"),
   plans: collection("plans"),
   decisions: collection("decisions"),
   builds: collection("builds"),
   notes: collection("notes"),
};
