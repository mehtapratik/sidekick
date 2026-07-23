import { load } from "js-yaml";
import fs from "node:fs";
import path from "node:path";

export type Category = "essays" | "plans" | "decisions" | "builds" | "notes";

export const CATEGORIES: Category[] = [
   "essays",
   "plans",
   "decisions",
   "builds",
   "notes",
];

export const CATEGORY_LABELS: Record<Category, string> = {
   essays: "Essays",
   plans: "Plans",
   decisions: "Decisions",
   builds: "Build",
   notes: "Notes",
};

export const CATEGORY_DESCRIPTIONS: Record<Category, string> = {
   essays:
      "Non-technical writings about Sidekick and other ideas worth writing down.",
   decisions:
      "A registry of every decisions (technical and non-technical) made while building Sidekick.",
   plans: "Overall implementation plan and phase-wise plans. What was planned and how it went.",
   builds:
      "Step-by-step instructions to build the same thing yourself, from scratch.",
   notes: "Learning notes taken while building Sidekick - mostly technical in nature, but not always.",
};

export type ContentMeta = {
   site: {
      title?: string;
      hero: string;
      heroImage?: string | null;
      url?: string;
      repoUrl?: string;
      intro?: string;
   };
   defaults: {
      author?: string;
      license?: string;
      version?: string;
   };
   entries: Record<
      string,
      {
         status?: string;
         date?: string;
         updated?: string;
         tags?: string[];
         deck?: string;
         title?: string;
         description?: string;
         audience?: string;
         version?: string;
      }
   >;
};

export function loadContentMeta(root = process.cwd()): ContentMeta {
   const file = path.join(root, "content-meta.yaml");
   return load(fs.readFileSync(file, "utf8")) as ContentMeta;
}
