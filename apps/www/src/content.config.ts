import { glob } from "astro/loaders";
import { defineCollection, z } from "astro:content";

const writingsSchema = z.object({
   title: z.string(),
   deck: z.string().optional(),
   created: z.coerce.date(),
   updated: z.coerce.date().optional(),
   version: z.string().optional(),
   tags: z.array(z.string()).default([]),
   type: z.enum(["essay", "blog", "note"]).default("essay"),
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

const docsSchema = z.object({
   title: z.string(),
   deck: z.string().optional(),
   created: z.coerce.date(),
   updated: z.coerce.date().optional(),
   kind: z.enum([
      "spec",
      "prd",
      "decision",
      "plan",
      "guidance",
      "glossary",
      "opportunity",
   ]),
   status: z.enum([
      "draft",
      "approved",
      "building",
      "built",
      "rejected",
      "cancelled",
   ]),
   version: z.string().optional(),
   tags: z.array(z.string()).default([]),
   appliesTo: z.array(z.string()).default([]),
   isSection: z.boolean().default(false),
   docId: z.string(),
   sourcePath: z.string(),
   wordCount: z.number(),
   readingMinutes: z.number(),
   author: z.string(),
   license: z.string().optional(),
   description: z.string().optional(),
});

export const collections = {
   writings: defineCollection({
      loader: glob({ base: "./src/content/writings", pattern: "**/*.md" }),
      schema: writingsSchema,
   }),
   docs: defineCollection({
      loader: glob({ base: "./src/content/docs", pattern: "**/*.md" }),
      schema: docsSchema,
   }),
};
