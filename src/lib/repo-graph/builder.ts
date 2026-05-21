import type { RepoRef } from "@/lib/repo-source/types";
import type { RepoGraph } from "./types";

// Bump when the graph schema changes — old caches are silently dropped.
const CACHE_KEY_PREFIX = "plot-repo-graph:v2";
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

function cacheKey(ref: RepoRef) {
  return `${CACHE_KEY_PREFIX}::${ref.owner}/${ref.repo}`;
}

export function loadCachedGraph(ref: RepoRef): RepoGraph | null {
  try {
    const raw = localStorage.getItem(cacheKey(ref));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<RepoGraph>;
    if (!parsed.files || !parsed.groups) return null;
    return {
      rootName: parsed.rootName ?? ref.repo,
      defaultBranch: parsed.defaultBranch ?? "main",
      fetchedAt: parsed.fetchedAt ?? 0,
      files: parsed.files,
      groups: parsed.groups,
      edges: parsed.edges ?? [],
      symbols: parsed.symbols ?? [],
      callEdges: parsed.callEdges ?? [],
    };
  } catch {
    return null;
  }
}

export function isStale(graph: RepoGraph): boolean {
  return Date.now() - graph.fetchedAt > CACHE_TTL_MS;
}

export function saveGraph(ref: RepoRef, graph: RepoGraph) {
  try {
    localStorage.setItem(cacheKey(ref), JSON.stringify(graph));
  } catch {
    /* localStorage full / blocked — skip */
  }
}

/**
 * Build (or fetch a cached copy of) a repo's knowledge graph.
 *
 * The heavy lifting — tree walk + raw content fetches + import parsing —
 * happens server-side at /api/repo/graph, which uses the deployment's
 * GITHUB_TOKEN and caches at the CDN edge. From the client this collapses to
 * a single round-trip.
 */
export async function buildRepoGraph(
  ref: RepoRef,
  _token: string | null,
  opts?: { ref?: string },
): Promise<RepoGraph> {
  const params = new URLSearchParams({
    owner: ref.owner,
    repo: ref.repo,
  });
  if (opts?.ref) params.set("ref", opts.ref);
  const res = await fetch(`/api/repo/graph?${params.toString()}`, {
    method: "GET",
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(body.error ?? `HTTP ${res.status}`);
  }
  return (await res.json()) as RepoGraph;
}
