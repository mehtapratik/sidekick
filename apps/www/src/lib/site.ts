import { load } from "js-yaml";
import fs from "node:fs";
import path from "node:path";

export type DocKind =
   | "spec"
   | "prd"
   | "decision"
   | "plan"
   | "guidance"
   | "glossary"
   | "opportunity";

export type DocStatus =
   | "draft"
   | "approved"
   | "building"
   | "built"
   | "rejected"
   | "cancelled";

export type WritingType = "essay" | "blog" | "note";

// Top-level nav destinations. Docs' five vault sections live one level
// down, in the document tree — they are not top-nav items.
export const NAV_ITEMS = [
   { href: "/writings/", label: "Writings", num: "01" },
   { href: "/docs/", label: "Docs", num: "02" },
   { href: "/index/", label: "Index", num: "03" },
];

export const WRITING_TYPE_LABELS: Record<WritingType, string> = {
   essay: "Essay",
   blog: "Blog",
   note: "Note",
};

export const KIND_LABELS: Record<DocKind, string> = {
   spec: "Spec",
   prd: "PRD",
   decision: "Decision",
   plan: "Plan",
   guidance: "Guidance",
   glossary: "Glossary",
   opportunity: "Opportunity",
};

export const STATUS_LABELS: Record<DocStatus, string> = {
   draft: "Draft",
   approved: "Approved",
   building: "Building",
   built: "Built",
   rejected: "Rejected",
   cancelled: "Cancelled",
};

// Maps a document's `kind` to a hero-art motif. Two further writings
// motifs (Margin, Drift) exist in hero-art.js but are held in reserve and
// intentionally unmapped here. Keep in sync with generate-og.mjs.
export const KIND_TO_MOTIF: Record<DocKind, string> = {
   spec: "Frame stack",
   prd: "Requirement grid",
   decision: "Branch",
   plan: "Gantt",
   guidance: "Radar",
   glossary: "Lattice",
   opportunity: "Scatter",
};

export const WRITINGS_MOTIF = "Contour";

export type DocSection = { slug: string; label: string };

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
   vault: {
      root: string;
      exclude: string[];
      sections: Record<string, DocSection>;
      statusMap: Record<string, string>;
      titleDictionary: string[];
   };
   writings: {
      root: string;
      exclude: string[];
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
         type?: string;
         author?: string;
      }
   >;
};

export function loadContentMeta(root = process.cwd()): ContentMeta {
   const file = path.join(root, "content-meta.yaml");
   return load(fs.readFileSync(file, "utf8")) as ContentMeta;
}

// Ordered list of the vault's doc sections, in the order configured in
// content-meta.yaml (object key order — YAML preserves insertion order).
export function docSections(meta: ContentMeta): DocSection[] {
   return Object.values(meta.vault.sections);
}

export function sectionLabel(meta: ContentMeta, slug: string): string | undefined {
   return docSections(meta).find((s) => s.slug === slug)?.label;
}
