import { Octokit } from "@octokit/rest";
import type { RepoRef } from "@/lib/repo-source/types";
import {
  extToKind,
  groupOf,
  shouldInclude,
  type RepoFile,
  type RepoGraph,
  type RepoGraphEdge,
} from "./types";
import {
  extractEdgesFromFile,
  parseTsconfigAliases,
  type AliasScope,
} from "./imports";
import { fetchRawFile } from "@/lib/github-raw";

const PARSEABLE_KINDS = new Set(["ts", "tsx", "js", "jsx", "html", "css"]);
const FETCH_CONCURRENCY = 6;
const MAX_PARSE_FILES = 80; // cap content fetches per refresh

function base64ToUtf8(b64: string): string {
  if (typeof atob === "function") {
    const clean = b64.replace(/\s/g, "");
    const binary = atob(clean);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return new TextDecoder("utf-8").decode(bytes);
  }
  // Node fallback (won't run in the browser path)
  return Buffer.from(b64, "base64").toString("utf-8");
}

const CACHE_KEY_PREFIX = "plot-repo-graph";
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
 * Walks the repo's git tree recursively in a single API call, filters down to
 * code-ish files (and excludes node_modules / dist / lockfiles), groups them by
 * top-level directory.
 *
 * Treating the GitHub REST `git/trees?recursive=1` endpoint as the cheapest
 * "the repo, expressed as a graph" primitive — no per-file fetches, one round
 * trip.
 */
export async function buildRepoGraph(
  ref: RepoRef,
  token: string,
  opts?: { ref?: string; maxFiles?: number },
): Promise<RepoGraph> {
  const octokit = new Octokit({ auth: token });

  const { data: repoMeta } = await octokit.rest.repos.get({
    owner: ref.owner,
    repo: ref.repo,
  });
  const branch = opts?.ref ?? repoMeta.default_branch;

  const { data: branchRef } = await octokit.rest.git.getRef({
    owner: ref.owner,
    repo: ref.repo,
    ref: `heads/${branch}`,
  });

  const { data: tree } = await octokit.rest.git.getTree({
    owner: ref.owner,
    repo: ref.repo,
    tree_sha: branchRef.object.sha,
    recursive: "1",
  });

  const files: RepoFile[] = [];
  const groupsInOrder: string[] = [];
  const seenGroups = new Set<string>();

  const max = opts?.maxFiles ?? 250;
  for (const node of tree.tree) {
    if (node.type !== "blob") continue;
    const path = node.path ?? "";
    if (!path) continue;
    if (!shouldInclude(path)) continue;
    const group = groupOf(path);
    if (!seenGroups.has(group)) {
      seenGroups.add(group);
      groupsInOrder.push(group);
    }
    files.push({
      path,
      sha: node.sha ?? "",
      size: node.size ?? 0,
      kind: extToKind(path),
      group,
    });
    if (files.length >= max) break;
  }

  // ─── Fetch tsconfig.json files for path-alias resolution ──────────────
  const aliases: AliasScope[] = [];
  const tsconfigBlobs = files.filter(
    (f) => f.path.endsWith("/tsconfig.json") || f.path === "tsconfig.json",
  );
  if (tsconfigBlobs.length > 0) {
    const tsResults = await Promise.allSettled(
      tsconfigBlobs.map(async (f) => {
        const content = await fetchRawFile(
          ref.owner,
          ref.repo,
          branch,
          f.path,
          token,
        );
        if (content == null) return null;
        return { path: f.path, content };
      }),
    );
    for (const r of tsResults) {
      if (r.status !== "fulfilled" || !r.value) continue;
      const scope = parseTsconfigAliases(r.value.path, r.value.content);
      if (scope) aliases.push(scope);
    }
  }

  // ─── Fetch content for parseable files and build dependency edges ──────
  const filesById = new Map<string, RepoFile>(files.map((f) => [f.path, f]));
  const parseTargets = files
    .filter((f) => PARSEABLE_KINDS.has(f.kind))
    .slice(0, MAX_PARSE_FILES);

  const edges: RepoGraphEdge[] = [];
  const seenEdgeId = new Set<string>();
  const pushEdges = (list: RepoGraphEdge[]) => {
    for (const e of list) {
      if (seenEdgeId.has(e.id)) continue;
      seenEdgeId.add(e.id);
      edges.push(e);
    }
  };

  // Batch the raw fetches so we don't fan out 80 simultaneous requests.
  for (let i = 0; i < parseTargets.length; i += FETCH_CONCURRENCY) {
    const batch = parseTargets.slice(i, i + FETCH_CONCURRENCY);
    const results = await Promise.allSettled(
      batch.map(async (file) => {
        const content = await fetchRawFile(
          ref.owner,
          ref.repo,
          branch,
          file.path,
          token,
        );
        return { file, content: content ?? "" };
      }),
    );
    for (const r of results) {
      if (r.status !== "fulfilled") continue;
      const fileEdges = extractEdgesFromFile(
        r.value.file,
        r.value.content,
        filesById,
        aliases,
      );
      pushEdges(fileEdges);
    }
  }

  return {
    rootName: repoMeta.name,
    defaultBranch: branch,
    fetchedAt: Date.now(),
    files,
    groups: groupsInOrder,
    edges,
  };
}
