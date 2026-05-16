import type { PRCanvas } from "@/lib/types";

export type Mode = "live" | "mock";

export type RepoRef = {
  owner: string;
  repo: string;
};

export type PRSummary = {
  number: number;
  title: string;
  author: string;
  authorAvatar?: string;
  filesChanged: number;
  headRef: string;
  headSha?: string;
  baseRef: string;
  htmlUrl: string;
  body: string;
  additions?: number;
  deletions?: number;
};

export type PreviewStatus =
  | { state: "ready"; url: string; source: "deployments" | "vercel-comment" | "convention" }
  | { state: "building"; url?: string }
  | { state: "failed"; message?: string }
  | { state: "unavailable"; reason?: string };

export type MergeResult = {
  merged: boolean;
  reviewPosted?: boolean;
  reviewSkipped?: string;
  sha?: string;
  message?: string;
};

export type RepoMeta = {
  name: string;
  fullName: string;
  htmlUrl: string;
  defaultBranch: string;
  owner: string;
};

export interface RepoSource {
  readonly mode: Mode;
  meta(): Promise<RepoMeta>;
  listPRs(): Promise<PRSummary[]>;
  getPRCanvas(number: number): Promise<PRCanvas>;
  mergePR(number: number, options?: { commitTitle?: string }): Promise<MergeResult>;
  /** Resolve a deployable preview URL for the PR's head, if any. */
  getPreviewUrl(number: number): Promise<PreviewStatus>;
}

/** Accepts the formats `owner/repo`, `github.com/owner/repo`, or full URL with optional .git/trailing slash. */
export function parseRepoUrl(input: string): RepoRef | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  const ownerRepo = trimmed.match(/^([^/\s]+)\/([^/\s.]+?)(?:\.git)?\/?$/);
  if (ownerRepo) return { owner: ownerRepo[1], repo: ownerRepo[2] };
  const urlMatch = trimmed.match(
    /^(?:https?:\/\/)?(?:www\.)?github\.com\/([^/]+)\/([^/?#]+?)(?:\.git)?\/?(?:[?#].*)?$/,
  );
  if (urlMatch) return { owner: urlMatch[1], repo: urlMatch[2] };
  return null;
}
