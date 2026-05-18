import type { Octokit } from "@octokit/rest";
import type {
  MergeResult,
  PRSummary,
  PreviewStatus,
  RepoMeta,
  RepoRef,
  RepoSource,
} from "./types";
import type { PRCanvas } from "@/lib/types";
import { buildCanvasFromPR } from "./canvas-builder";
import { getOctokit } from "@/lib/octokit-client";

/**
 * Pulls a PR + its file list in a single GraphQL round-trip (GitHub-as-graph),
 * then falls back to REST for the per-file `patch` payload (not exposed via
 * GraphQL). REST is also used for the squash-merge mutation.
 */
export class GitHubRepoSource implements RepoSource {
  readonly mode = "live" as const;
  private octokit: Octokit;

  constructor(
    private ref: RepoRef,
    token?: string | null,
  ) {
    this.octokit = getOctokit(token);
  }

  async meta(): Promise<RepoMeta> {
    const { data } = await this.octokit.rest.repos.get({
      owner: this.ref.owner,
      repo: this.ref.repo,
    });
    return {
      name: data.name,
      fullName: data.full_name,
      htmlUrl: data.html_url,
      defaultBranch: data.default_branch,
      owner: data.owner.login,
    };
  }

  async listPRs(): Promise<PRSummary[]> {
    type ListResp = {
      repository: {
        pullRequests: {
          nodes: Array<{
            number: number;
            title: string;
            url: string;
            body: string | null;
            changedFiles: number;
            additions: number;
            deletions: number;
            headRefName: string;
            baseRefName: string;
            headRefOid: string;
            author: { login: string; avatarUrl: string } | null;
          }>;
        };
      };
    };
    const result = await this.octokit.graphql<ListResp>(
      `query($owner: String!, $repo: String!) {
        repository(owner: $owner, name: $repo) {
          pullRequests(first: 25, states: OPEN, orderBy: { field: CREATED_AT, direction: DESC }) {
            nodes {
              number title url body changedFiles additions deletions
              headRefName baseRefName headRefOid
              author { login ... on User { avatarUrl } }
            }
          }
        }
      }`,
      { owner: this.ref.owner, repo: this.ref.repo },
    );
    return result.repository.pullRequests.nodes.map((n) => ({
      number: n.number,
      title: n.title,
      author: n.author?.login ?? "unknown",
      authorAvatar: n.author?.avatarUrl,
      filesChanged: n.changedFiles,
      headRef: n.headRefName,
      headSha: n.headRefOid,
      baseRef: n.baseRefName,
      htmlUrl: n.url,
      body: n.body ?? "",
      additions: n.additions,
      deletions: n.deletions,
    }));
  }

  /**
   * Three-step preview-URL resolution:
   *   1. GitHub Deployments API for environment=Preview (canonical, knows
   *      build state).
   *   2. Fallback: parse the `vercel[bot]` comment on the PR.
   *   3. Give up — return unavailable. We do NOT guess the URL by convention
   *      from the browser because we don't have the team slug reliably.
   */
  async getPreviewUrl(number: number): Promise<PreviewStatus> {
    try {
      const { data: pr } = await this.octokit.rest.pulls.get({
        owner: this.ref.owner,
        repo: this.ref.repo,
        pull_number: number,
      });
      const sha = pr.head.sha;

      // --- Step 1: Deployments API
      try {
        const deployments = await this.octokit.rest.repos.listDeployments({
          owner: this.ref.owner,
          repo: this.ref.repo,
          sha,
          per_page: 20,
        });
        const previews = deployments.data
          .filter((d) =>
            /preview/i.test(d.environment ?? "") ||
            /preview/i.test(d.original_environment ?? ""),
          )
          .sort(
            (a, b) =>
              new Date(b.created_at).getTime() -
              new Date(a.created_at).getTime(),
          );
        for (const dep of previews) {
          const statuses = await this.octokit.rest.repos.listDeploymentStatuses({
            owner: this.ref.owner,
            repo: this.ref.repo,
            deployment_id: dep.id,
            per_page: 20,
          });
          const sorted = [...statuses.data].sort(
            (a, b) =>
              new Date(b.created_at).getTime() -
              new Date(a.created_at).getTime(),
          );
          const success = sorted.find(
            (s) => s.state === "success" && s.environment_url,
          );
          if (success?.environment_url) {
            return {
              state: "ready",
              url: success.environment_url,
              source: "deployments",
            };
          }
          const failure = sorted.find(
            (s) => s.state === "failure" || s.state === "error",
          );
          if (failure) {
            return { state: "failed", message: failure.description ?? undefined };
          }
          const inProgress = sorted.find(
            (s) => s.state === "in_progress" || s.state === "queued",
          );
          if (inProgress) {
            return { state: "building" };
          }
        }
      } catch {
        /* fall through to comment scan */
      }

      // --- Step 2: vercel[bot] PR comment scrape
      try {
        const { data: comments } = await this.octokit.rest.issues.listComments({
          owner: this.ref.owner,
          repo: this.ref.repo,
          issue_number: number,
          per_page: 50,
        });
        const vercel = comments
          .filter((c) => c.user?.login?.toLowerCase().startsWith("vercel"))
          .reverse(); // newest first
        for (const c of vercel) {
          const body = c.body ?? "";
          // Look for the first vercel.app URL — Vercel bot posts the
          // branch-alias URL as a link.
          const m = body.match(/https?:\/\/[^\s)]*\.vercel\.app[^\s)]*/);
          if (m) {
            return {
              state: "ready",
              url: m[0],
              source: "vercel-comment",
            };
          }
        }
      } catch {
        /* ignore */
      }

      return {
        state: "unavailable",
        reason: "No Preview deployment registered for this PR's head SHA.",
      };
    } catch (e) {
      return {
        state: "unavailable",
        reason: e instanceof Error ? e.message : String(e),
      };
    }
  }

  async getPRCanvas(number: number): Promise<PRCanvas> {
    const [{ data: pr }, { data: files }, preview] = await Promise.all([
      this.octokit.rest.pulls.get({
        owner: this.ref.owner,
        repo: this.ref.repo,
        pull_number: number,
      }),
      this.octokit.rest.pulls.listFiles({
        owner: this.ref.owner,
        repo: this.ref.repo,
        pull_number: number,
        per_page: 50,
      }),
      this.getPreviewUrl(number).catch(
        () => ({ state: "unavailable" as const }),
      ),
    ]);

    return buildCanvasFromPR(
      {
        number: pr.number,
        title: pr.title,
        body: pr.body,
        html_url: pr.html_url,
        additions: pr.additions ?? 0,
        deletions: pr.deletions ?? 0,
        changed_files: pr.changed_files ?? files.length,
      },
      files.map((f) => ({
        filename: f.filename,
        additions: f.additions,
        deletions: f.deletions,
        patch: f.patch,
        status: f.status,
      })),
      preview,
    );
  }

  async mergePR(
    number: number,
    options?: { commitTitle?: string },
  ): Promise<MergeResult> {
    let reviewPosted = false;
    let reviewSkipped: string | undefined;
    try {
      const { data: pr } = await this.octokit.rest.pulls.get({
        owner: this.ref.owner,
        repo: this.ref.repo,
        pull_number: number,
      });

      // Step 1: best-effort APPROVE review. GitHub disallows approving your own
      // PR — we swallow that case (and any other review failure) and still
      // attempt the merge.
      try {
        await this.octokit.rest.pulls.createReview({
          owner: this.ref.owner,
          repo: this.ref.repo,
          pull_number: number,
          event: "APPROVE",
          body: "Approved via Plot.",
        });
        reviewPosted = true;
      } catch (reviewErr) {
        reviewSkipped =
          reviewErr instanceof Error ? reviewErr.message : String(reviewErr);
      }

      // Step 2: squash merge.
      const resp = await this.octokit.rest.pulls.merge({
        owner: this.ref.owner,
        repo: this.ref.repo,
        pull_number: number,
        merge_method: "squash",
        commit_title: options?.commitTitle ?? pr.title,
      });
      return {
        merged: resp.data.merged,
        reviewPosted,
        reviewSkipped,
        sha: resp.data.sha,
        message: resp.data.message,
      };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      return {
        merged: false,
        reviewPosted,
        reviewSkipped,
        message: msg,
      };
    }
  }
}
