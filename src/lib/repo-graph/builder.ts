import type { RepoRef } from "@/lib/repo-source/types";
import type { RepoGraph } from "./types";

// Bump when the graph schema changes — old caches are silently dropped.
// v3: graph served from the Postgres KB (/api/kb/graph) instead of the
// regex extractor; symbols now include non-exported top-level declarations.
const CACHE_KEY_PREFIX = "plot-repo-graph:v3";
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

function cacheKey(ref: RepoRef) {
  return `${CACHE_KEY_PREFIX}::${ref.owner}/${ref.repo}`;
}

/** Served alongside the RepoGraph by /api/kb/graph; additive field. */
export type GraphStats = {
  snapshotSha: string;
  snapshotId: number;
  files: number;
  symbols: number;
  importEdges: number;
  callEdges: number;
};

export type KbRepoGraph = RepoGraph & { stats?: GraphStats };

export type IndexProgress = {
  status: string;
  indexedFiles: number;
  fileCount: number | null;
};

export function loadCachedGraph(ref: RepoRef): KbRepoGraph | null {
  try {
    const raw = localStorage.getItem(cacheKey(ref));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<KbRepoGraph>;
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
      stats: parsed.stats,
    };
  } catch {
    return null;
  }
}

export function isStale(graph: RepoGraph): boolean {
  return Date.now() - graph.fetchedAt > CACHE_TTL_MS;
}

export function saveGraph(ref: RepoRef, graph: KbRepoGraph) {
  try {
    localStorage.setItem(cacheKey(ref), JSON.stringify(graph));
  } catch {
    /* localStorage full / blocked — skip */
  }
}

async function fetchKbGraph(ref: RepoRef): Promise<KbRepoGraph | null> {
  const params = new URLSearchParams({ owner: ref.owner, repo: ref.repo });
  const res = await fetch(`/api/kb/graph?${params.toString()}`);
  if (res.status === 404) return null; // not indexed yet
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(body.error ?? `HTTP ${res.status}`);
  }
  return (await res.json()) as KbRepoGraph;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Build (or fetch a cached copy of) a repo's knowledge graph.
 *
 * The graph is served from the Postgres KB (per-SHA snapshots, tree-sitter
 * indexed). If the repo was never indexed, this kicks off indexing via
 * POST /api/kb/index and reports progress through `onProgress` while
 * polling /api/kb/status.
 */
export async function buildRepoGraph(
  ref: RepoRef,
  _token: string | null,
  opts?: { ref?: string; onProgress?: (p: IndexProgress) => void },
): Promise<KbRepoGraph> {
  const existing = await fetchKbGraph(ref);
  if (existing) return existing;

  // Not indexed: start the job, then poll status until ready.
  const indexRes = fetch(`/api/kb/index`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ owner: ref.owner, repo: ref.repo, ref: opts?.ref }),
  });

  const startedAt = Date.now();
  const TIMEOUT_MS = 5 * 60 * 1000;
  // Poll while the index request runs; whichever finishes first wins.
  let done = false;
  indexRes
    .then(() => {
      done = true;
    })
    .catch(() => {
      done = true;
    });

  while (!done && Date.now() - startedAt < TIMEOUT_MS) {
    await sleep(1200);
    try {
      const res = await fetch(
        `/api/kb/status?owner=${encodeURIComponent(ref.owner)}&repo=${encodeURIComponent(ref.repo)}`,
      );
      if (res.ok) {
        const p = (await res.json()) as {
          status: string;
          indexedFiles: number;
          fileCount: number | null;
        };
        opts?.onProgress?.({
          status: p.status,
          indexedFiles: p.indexedFiles,
          fileCount: p.fileCount,
        });
        if (p.status === "ready" || p.status === "failed") break;
      }
    } catch {
      /* transient poll failure — keep going */
    }
  }

  const indexResponse = await indexRes;
  if (!indexResponse.ok) {
    const body = (await indexResponse.json().catch(() => ({}))) as {
      error?: string;
    };
    throw new Error(body.error ?? `Indexing failed (HTTP ${indexResponse.status})`);
  }

  // `indexing` = another request holds the build claim (e.g. second tab);
  // keep polling status until that build finishes.
  const body = (await indexResponse.json().catch(() => ({}))) as {
    status?: string;
  };
  if (body.status === "indexing") {
    while (Date.now() - startedAt < TIMEOUT_MS) {
      await sleep(1200);
      try {
        const res = await fetch(
          `/api/kb/status?owner=${encodeURIComponent(ref.owner)}&repo=${encodeURIComponent(ref.repo)}`,
        );
        if (!res.ok) continue;
        const p = (await res.json()) as {
          status: string;
          indexedFiles: number;
          fileCount: number | null;
        };
        opts?.onProgress?.(p);
        if (p.status === "ready") break;
        if (p.status === "failed") throw new Error("Indexing failed");
      } catch (e) {
        if (e instanceof Error && e.message === "Indexing failed") throw e;
        /* transient poll failure — keep going */
      }
    }
  }

  const graph = await fetchKbGraph(ref);
  if (!graph) throw new Error("Indexing finished but no ready snapshot found");
  return graph;
}
