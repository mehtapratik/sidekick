import fs from "node:fs";
import path from "node:path";
import yaml from "js-yaml";

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
  builds: "Builds",
  notes: "Notes",
};

export const CATEGORY_TAGS: Record<Category, string> = {
  essays: "essay",
  plans: "plan",
  decisions: "decision",
  builds: "build",
  notes: "note",
};

export const CATEGORY_DESCRIPTIONS: Record<Category, string> = {
  essays:
    "Long-form thinking on attention, tools, and what it means to build a system meant to outlast its first author. Read in any order.",
  plans:
    "Roadmaps, phase plans, and implementation breakdowns for Sidekick. Plans get rewritten as the work progresses.",
  decisions:
    "Architecture decision records — non-obvious choices with rationale, written when made.",
  builds:
    "Step-by-step build logs and walkthroughs. The exact commits, the wrong turns, the final shape.",
  notes:
    "Learning notes and references for the technologies in the stack. Pages I wish I'd found earlier.",
};

export type ContentMeta = {
  site: {
    hero: string;
    heroImage?: string | null;
    title?: string;
    description?: string;
    url?: string;
    repoUrl?: string;
    tagline?: string;
    intro?: string;
  };
  defaults: {
    author?: string;
    license?: string;
    version?: number;
  };
  entries: Record<
    string,
    {
      deck?: string;
      date?: string;
      updated?: string;
      tags?: string[];
      draft?: boolean;
      title?: string;
      heroImage?: string | null;
      version?: number;
      tldr?: string;
    }
  >;
};

export function loadContentMeta(root = process.cwd()): ContentMeta {
  const file = path.join(root, "content-meta.yaml");
  const raw = fs.readFileSync(file, "utf8");
  return yaml.load(raw) as ContentMeta;
}

export function resolveHeroRef(
  heroRef: string,
): { category: Category; slug: string } {
  if (heroRef.includes("/")) {
    const [category, slug] = heroRef.split("/", 2) as [Category, string];
    return { category, slug };
  }
  return { category: "essays", slug: heroRef };
}
