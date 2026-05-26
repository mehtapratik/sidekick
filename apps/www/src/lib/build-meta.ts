/**
 * Build-time helpers for site metadata baked into the static HTML.
 *
 * `getLastCommit` prefers a local git checkout (sidekick clone on CF Pages),
 * then falls back to the GitHub REST API once per Node process.
 */

import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

export interface LastCommit {
  iso: string;
  htmlUrl: string;
  displayUtc: string;
}

let cached: Promise<LastCommit | null> | null = null;

// #region agent log
function debugLog(
  hypothesisId: string,
  message: string,
  data: Record<string, unknown>,
): void {
  const payload = {
    sessionId: "eb06f2",
    hypothesisId,
    location: "build-meta.ts",
    message,
    data,
    timestamp: Date.now(),
    runId: process.env.DEBUG_BUILD_META_RUN ?? "build",
  };
  console.log("[arkive-build-meta]", JSON.stringify(payload));
  fetch("http://127.0.0.1:7469/ingest/a677998f-baf0-443a-aa8a-ce957733e7cf", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Debug-Session-Id": "eb06f2",
    },
    body: JSON.stringify(payload),
  }).catch(() => {});
}
// #endregion

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
  } catch (err) {
    // #region agent log
    debugLog("E", "git log failed", {
      gitRoot,
      error: err instanceof Error ? err.message : String(err),
    });
    // #endregion
    return null;
  }
}

async function fetchOnce(repoUrl: string): Promise<LastCommit | null> {
  const repo = parseGithubRepo(repoUrl);
  if (!repo) {
    // #region agent log
    debugLog("B", "repoUrl parse failed", { repoUrl });
    // #endregion
    return null;
  }
  if (process.env.SIMULATE_API_FAIL === "1") {
    // #region agent log
    debugLog("A", "simulated API failure", {});
    // #endregion
    return null;
  }
  const api = `https://api.github.com/repos/${repo.owner}/${repo.name}/commits?per_page=1`;
  try {
    const res = await fetch(api, {
      headers: {
        Accept: "application/vnd.github+json",
        "User-Agent": "arkive-build",
      },
    });
    // #region agent log
    debugLog("A", "GitHub API response", {
      status: res.status,
      ok: res.ok,
      rateRemaining: res.headers.get("x-ratelimit-remaining"),
    });
    // #endregion
    if (!res.ok) return null;
    const arr = (await res.json()) as Array<{
      commit?: { author?: { date?: string } };
      html_url?: string;
    }>;
    const c = Array.isArray(arr) ? arr[0] : null;
    const iso = c?.commit?.author?.date;
    const htmlUrl = c?.html_url;
    if (!iso || !htmlUrl) {
      // #region agent log
      debugLog("C", "GitHub API missing fields", { hasIso: !!iso, hasHtmlUrl: !!htmlUrl });
      // #endregion
      return null;
    }
    const displayUtc = formatUtc(iso);
    if (!displayUtc) return null;
    return { iso, htmlUrl, displayUtc };
  } catch (err) {
    // #region agent log
    debugLog("D", "GitHub API fetch threw", {
      error: err instanceof Error ? err.message : String(err),
    });
    // #endregion
    return null;
  }
}

async function resolveLastCommit(repoUrl: string): Promise<LastCommit | null> {
  const gitRoot = resolveGitRepoRoot();
  // #region agent log
  debugLog("E", "resolve paths", {
    gitRoot,
    SIDEKICK_GIT_ROOT: process.env.SIDEKICK_GIT_ROOT ?? null,
    DOCS_ROOT: process.env.DOCS_ROOT ?? null,
  });
  // #endregion

  if (gitRoot) {
    const fromGit = lastCommitFromGit(repoUrl, gitRoot);
    if (fromGit) {
      // #region agent log
      debugLog("E", "using git last commit", { gitRoot, iso: fromGit.iso });
      // #endregion
      return fromGit;
    }
  }

  const fromApi = await fetchOnce(repoUrl);
  // #region agent log
  debugLog("A", "resolved via API fallback", { ok: !!fromApi });
  // #endregion
  return fromApi;
}

export function getLastCommit(repoUrl: string): Promise<LastCommit | null> {
  if (!cached) cached = resolveLastCommit(repoUrl);
  return cached;
}
