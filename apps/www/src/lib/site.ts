import { load } from "js-yaml";
import fs from "node:fs";
import path from "node:path";

export type Section = "writings" | "core-drive" | "plans" | "builds" | "notes";
export type PostType =
   | "essay"
   | "blog"
   | "core-drive"
   | "plan"
   | "decision"
   | "build"
   | "note";

export const SECTIONS: Section[] = [
   "writings",
   "core-drive",
   "plans",
   "builds",
   "notes",
];

// Nav-visible sections, in display order. `notes` is Index-only.
export const NAV_SECTIONS: Section[] = [
   "writings",
   "core-drive",
   "plans",
   "builds",
];

export const SECTION_LABELS: Record<Section, string> = {
   writings: "Writings",
   "core-drive": "Core Drive",
   plans: "Plans",
   builds: "Builds",
   notes: "Notes",
};

export const SECTION_DESCRIPTIONS: Record<Section, string> = {
   writings:
      "Essays and technical blogs — non-technical and technical writing about Sidekick and other ideas worth writing down.",
   "core-drive":
      "Core principles driving my actions, behaviors, and Sidekick's implementations.",
   plans:
      "Original plans and the technical or tactical decisions made later that influenced them.",
   builds:
      "Step-by-step instructions to build the same thing yourself, from scratch.",
   notes:
      "Learning notes taken while building Sidekick — mostly technical in nature, but not always.",
};

export const TYPE_LABELS: Record<PostType, string> = {
   essay: "Essay",
   blog: "Blog",
   "core-drive": "Core Drive",
   plan: "Plan",
   decision: "Decision",
   build: "Build",
   note: "Note",
};

// Maps a post's `type` to a hero-art motif. hero-art.js has no "Note" motif,
// so notes fall back to the Blog treatment.
export const TYPE_TO_MOTIF: Record<PostType, string> = {
   essay: "Essay",
   blog: "Blog",
   "core-drive": "Core Drive",
   plan: "Plan",
   decision: "Decision",
   build: "Build",
   note: "Blog",
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
         seed?: string;
      }
   >;
};

export function loadContentMeta(root = process.cwd()): ContentMeta {
   const file = path.join(root, "content-meta.yaml");
   return load(fs.readFileSync(file, "utf8")) as ContentMeta;
}
