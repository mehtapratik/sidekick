import { defineCollection, z } from "astro:content";
import { glob } from "astro/loaders";

const entrySchema = z.object({
  title: z.string(),
  deck: z.string(),
  pubDate: z.coerce.date(),
  updated: z.coerce.date(),
  version: z.number().default(1),
  tags: z.array(z.string()).default([]),
  draft: z.boolean().default(false),
  category: z.enum(["essays", "plans", "decisions", "builds", "notes"]),
  sourcePath: z.string(),
  wordCount: z.number(),
  readingMinutes: z.number(),
  author: z.string(),
  license: z.string(),
});

function collection(name: "essays" | "plans" | "decisions" | "builds" | "notes") {
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
