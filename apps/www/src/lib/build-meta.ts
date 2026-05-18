/**
 * Build-time helpers for site metadata baked into the static HTML.
 *
 * `getLastCommit` calls the GitHub REST API once per Node process — not
 * once per page render and not once per visitor — so a full SSG build
 * for a site with N pages still only consumes a single API request.
 * In `astro dev` the cache lives for the lifetime of the dev server.
 *
 * The function never throws: any network, parse, or rate-limit failure
 * resolves to `null` and the caller is expected to omit the affected
 * UI gracefully.
 */

export interface LastCommit {
  /** Strict ISO-8601 commit date (committer date), e.g. `2026-05-18T13:10:22Z`. */
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

async function fetchOnce(repoUrl: string): Promise<LastCommit | null> {
  const m = repoUrl.match(/github\.com\/([^/]+)\/([^/?#]+)/i);
  if (!m) return null;
  const owner = m[1];
  const name = m[2].replace(/\.git$/, "");
  const api = `https://api.github.com/repos/${owner}/${name}/commits?per_page=1`;
  try {
    const res = await fetch(api, {
      headers: {
        Accept: "application/vnd.github+json",
        // GitHub requires a User-Agent on API requests.
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

export function getLastCommit(repoUrl: string): Promise<LastCommit | null> {
  if (!cached) cached = fetchOnce(repoUrl);
  return cached;
}
