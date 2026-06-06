import { createGunzip } from "node:zlib";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { createHash } from "node:crypto";
import { extract as tarExtract } from "tar-stream";
import type { ReadableStream as WebReadableStream } from "node:stream/web";

// Server-side GitHub access for the indexer. Same token model as the
// /api/gh proxy (GITHUB_TOKEN injected server-side, no git binary) — the
// proxy itself exists for browser calls; route handlers talk to the API
// directly to avoid a self-HTTP hop.

const GITHUB_BASE = "https://api.github.com";

function ghHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": "plot-app",
  };
  if (process.env.GITHUB_TOKEN) {
    headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  }
  return headers;
}

export async function ghJson<T>(path: string): Promise<T> {
  const res = await fetch(`${GITHUB_BASE}${path}`, { headers: ghHeaders() });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`GitHub ${res.status} ${path}: ${text.slice(0, 200)}`);
  }
  return (await res.json()) as T;
}

export type RepoMeta = {
  name: string;
  defaultBranch: string;
};

export async function fetchRepoMeta(
  owner: string,
  repo: string,
): Promise<RepoMeta> {
  const meta = await ghJson<{ name: string; default_branch: string }>(
    `/repos/${owner}/${repo}`,
  );
  return { name: meta.name, defaultBranch: meta.default_branch };
}

/** Resolve a branch/tag/sha ref to the concrete commit SHA. */
export async function resolveCommitSha(
  owner: string,
  repo: string,
  ref: string,
): Promise<string> {
  const commit = await ghJson<{ sha: string }>(
    `/repos/${owner}/${repo}/commits/${encodeURIComponent(ref)}`,
  );
  return commit.sha;
}

export type TarEntry = {
  /** Repo-relative path (leading `{repo}-{sha}/` segment stripped). */
  path: string;
  content: Buffer;
  /** sha256 hex of content — drives the incremental-reindex diff. */
  hash: string;
};

/**
 * Download and unpack a repo tarball at a ref in one authenticated request.
 * This is what lifts the old per-file-fetch 250-file cap (M1.1).
 */
export async function downloadTarball(
  owner: string,
  repo: string,
  ref: string,
): Promise<TarEntry[]> {
  const res = await fetch(
    `${GITHUB_BASE}/repos/${owner}/${repo}/tarball/${encodeURIComponent(ref)}`,
    { headers: ghHeaders(), redirect: "follow" },
  );
  if (!res.ok || !res.body) {
    const text = await res.text().catch(() => "");
    throw new Error(`GitHub tarball ${res.status}: ${text.slice(0, 200)}`);
  }

  const entries: TarEntry[] = [];
  const extract = tarExtract();

  extract.on("entry", (header, stream, next) => {
    if (header.type !== "file") {
      stream.resume();
      stream.on("end", next);
      return;
    }
    const chunks: Buffer[] = [];
    stream.on("data", (c: Buffer) => chunks.push(c));
    stream.on("end", () => {
      // first path segment is `{repo}-{shortsha}/`
      const repoPath = header.name.split("/").slice(1).join("/");
      if (repoPath) {
        const content = Buffer.concat(chunks);
        entries.push({
          path: repoPath,
          content,
          hash: createHash("sha256").update(content).digest("hex"),
        });
      }
      next();
    });
    stream.on("error", next);
  });

  await pipeline(
    Readable.fromWeb(res.body as unknown as WebReadableStream),
    createGunzip(),
    extract,
  );

  return entries;
}
