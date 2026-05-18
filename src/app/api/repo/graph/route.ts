import { NextResponse } from "next/server";
import {
  extToKind,
  groupOf,
  shouldInclude,
  type RepoFile,
  type RepoGraph,
  type RepoGraphEdge,
} from "@/lib/repo-graph/types";
import {
  extractEdgesFromFile,
  parseTsconfigAliases,
  type AliasScope,
} from "@/lib/repo-graph/imports";
import { fetchRawFile } from "@/lib/github-raw";

export const runtime = "nodejs";
// Cache the graph at the edge for an hour so repeat ingests are instant.
// `revalidate` is a Next.js Route Handler hint; we also set Cache-Control
// headers below for CDN-level caching across all visitors.
export const revalidate = 3600;

const GITHUB_BASE = "https://api.github.com";
const PARSEABLE_KINDS = new Set(["ts", "tsx", "js", "jsx", "html", "css"]);
const FETCH_CONCURRENCY = 12; // server-side: lower latency to GitHub
const MAX_PARSE_FILES = 80;
const MAX_FILES = 250;

type TreeNode = {
  path?: string;
  sha?: string;
  size?: number;
  type?: string;
};

async function ghJson<T>(path: string): Promise<T> {
  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": "plot-app",
  };
  if (process.env.GITHUB_TOKEN) {
    headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  }
  const res = await fetch(`${GITHUB_BASE}${path}`, {
    headers,
    next: { revalidate: 3600 },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`GitHub ${res.status}: ${text.slice(0, 200)}`);
  }
  return (await res.json()) as T;
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const owner = url.searchParams.get("owner");
  const repo = url.searchParams.get("repo");
  const refOverride = url.searchParams.get("ref");

  if (!owner || !repo) {
    return NextResponse.json(
      { error: "Missing owner/repo" },
      { status: 400 },
    );
  }

  let graph: RepoGraph;
  try {
    // 1) repo meta — name + default_branch
    const meta = await ghJson<{ name: string; default_branch: string }>(
      `/repos/${owner}/${repo}`,
    );
    const branch = refOverride || meta.default_branch;

    // 2) recursive tree against the branch name directly (skips getRef)
    const tree = await ghJson<{ tree: TreeNode[] }>(
      `/repos/${owner}/${repo}/git/trees/${encodeURIComponent(branch)}?recursive=1`,
    );

    // 3) bucket files
    const files: RepoFile[] = [];
    const groupsInOrder: string[] = [];
    const seenGroups = new Set<string>();
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
      if (files.length >= MAX_FILES) break;
    }

    // 4) tsconfig fetch — concurrent
    const aliases: AliasScope[] = [];
    const tsconfigs = files.filter(
      (f) => f.path.endsWith("/tsconfig.json") || f.path === "tsconfig.json",
    );
    if (tsconfigs.length > 0) {
      const results = await Promise.allSettled(
        tsconfigs.map(async (f) => {
          const content = await fetchRawFile(owner, repo, branch, f.path);
          if (content == null) return null;
          return { path: f.path, content };
        }),
      );
      for (const r of results) {
        if (r.status !== "fulfilled" || !r.value) continue;
        const scope = parseTsconfigAliases(r.value.path, r.value.content);
        if (scope) aliases.push(scope);
      }
    }

    // 5) parseable file content — batched concurrent
    const filesById = new Map<string, RepoFile>(files.map((f) => [f.path, f]));
    const parseTargets = files
      .filter((f) => PARSEABLE_KINDS.has(f.kind))
      .slice(0, MAX_PARSE_FILES);

    const edges: RepoGraphEdge[] = [];
    const seenEdgeId = new Set<string>();

    for (let i = 0; i < parseTargets.length; i += FETCH_CONCURRENCY) {
      const batch = parseTargets.slice(i, i + FETCH_CONCURRENCY);
      const results = await Promise.allSettled(
        batch.map(async (file) => {
          const content = await fetchRawFile(owner, repo, branch, file.path);
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
        for (const e of fileEdges) {
          if (seenEdgeId.has(e.id)) continue;
          seenEdgeId.add(e.id);
          edges.push(e);
        }
      }
    }

    graph = {
      rootName: meta.name,
      defaultBranch: branch,
      fetchedAt: Date.now(),
      files,
      groups: groupsInOrder,
      edges,
    };
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 502 },
    );
  }

  return NextResponse.json(graph, {
    headers: {
      // CDN-cache so anyone hitting the same repo gets the cached graph.
      "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400",
    },
  });
}
