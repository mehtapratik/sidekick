/**
 * Build-time helpers for site metadata baked into the static HTML.
 *
 * `getLastCommit` prefers a local git checkout (sidekick clone on CF Pages
 * via `SIDEKICK_GIT_ROOT`, or `../sidekick` in local dev), then falls back
 * to the GitHub REST API once per Node process. The git path is preferred
 * because Cloudflare Pages builds intermittently fail to reach the GitHub
 * API, leaving the footer's "Last Update" UI blank.
 *
 * The function never throws: any failure resolves to `null` and the caller
 * is expected to omit the affected UI gracefully.
 */

import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

export interface LastCommit {
  /** Strict ISO-8601 commit date, e.g. `2026-05-18T13:10:22Z`. */
  iso: string;
  /** Canonical web URL for the commit, e.g. `https://github.com/<o>/<r>/commit/<sha>`. */
  htmlUrl: string;
  /**
   * Pre-formatted UTC fallback string (`YYYY-MM-DD HH:MM UTC`). Rendered
   * server-side so the page is meaningful before client JS runs; a small
   * inline script re-formats it to the viewer's local timezone on load.
   */
  displayUtc: string;
}

let cached: Promise<LastCommit | null> | null = null;

function pad(n: number): string {
  return n < 10 ? "0" + n : "" + n;
}

function formatUtc(iso: string): string | null {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return (
    d.getUTCFullYear() +
    "-" +
    pad(d.getUTCMonth() + 1) +
    "-" +
    pad(d.getUTCDate()) +
    " " +
    pad(d.getUTCHours()) +
    ":" +
    pad(d.getUTCMinutes()) +
    " UTC"
  );
}

function parseGithubRepo(repoUrl: string): { owner: string; name: string } | null {
  const m = repoUrl.match(/github\.com\/([^/]+)\/([^/?#]+)/i);
  if (!m) return null;
  return { owner: m[1], name: m[2].replace(/\.git$/, "") };
}

function resolveGitRepoRoot(): string | null {
  const candidates: string[] = [];
  if (process.env.SIDEKICK_GIT_ROOT) {
    candidates.push(path.resolve(process.env.SIDEKICK_GIT_ROOT));
  }
  if (process.env.DOCS_ROOT) {
    candidates.push(path.resolve(process.env.DOCS_ROOT, ".."));
  }
  candidates.push(path.resolve(process.cwd(), "../sidekick"));

  for (const root of candidates) {
    if (fs.existsSync(path.join(root, ".git"))) return root;
  }
  return null;
}

function lastCommitFromGit(
  repoUrl: string,
  gitRoot: string,
): LastCommit | null {
  const repo = parseGithubRepo(repoUrl);
  if (!repo) return null;
  try {
    const iso = execSync("git log -1 --format=%cI", {
      cwd: gitRoot,
      encoding: "utf8",
    }).trim();
    const sha = execSync("git log -1 --format=%H", {
      cwd: gitRoot,
      encoding: "utf8",
    }).trim();
    const displayUtc = formatUtc(iso);
    if (!iso || !sha || !displayUtc) return null;
    return {
      iso,
      htmlUrl: `https://github.com/${repo.owner}/${repo.name}/commit/${sha}`,
      displayUtc,
    };
  } catch {
    return null;
  }
}

async function fetchOnce(repoUrl: string): Promise<LastCommit | null> {
  const repo = parseGithubRepo(repoUrl);
  if (!repo) return null;
  const api = `https://api.github.com/repos/${repo.owner}/${repo.name}/commits?per_page=1`;
  try {
    const res = await fetch(api, {
      headers: {
        Accept: "application/vnd.github+json",
        "User-Agent": "arkive-build",
      },
    });
    if (!res.ok) return null;
    const arr = (await res.json()) as Array<{
      commit?: { author?: { date?: string } };
      html_url?: string;
    }>;
    const c = Array.isArray(arr) ? arr[0] : null;
    const iso = c?.commit?.author?.date;
    const htmlUrl = c?.html_url;
    if (!iso || !htmlUrl) return null;
    const displayUtc = formatUtc(iso);
    if (!displayUtc) return null;
    return { iso, htmlUrl, displayUtc };
  } catch {
    return null;
  }
}

async function resolveLastCommit(repoUrl: string): Promise<LastCommit | null> {
  const gitRoot = resolveGitRepoRoot();
  if (gitRoot) {
    const fromGit = lastCommitFromGit(repoUrl, gitRoot);
    if (fromGit) return fromGit;
  }
  return fetchOnce(repoUrl);
}

export function getLastCommit(repoUrl: string): Promise<LastCommit | null> {
  if (!cached) cached = resolveLastCommit(repoUrl);
  return cached;
}
