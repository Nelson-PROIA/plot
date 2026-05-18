import { GitHubRepoSource } from "./github";
import { MockRepoSource } from "./mock";
import type { Mode, RepoRef, RepoSource } from "./types";

export function getRepoSource(
  mode: Mode,
  ref?: RepoRef | null,
  token?: string | null,
): RepoSource {
  if (mode === "live") {
    if (!ref) {
      throw new Error("Live mode requires a repo. Falling back to mock mode.");
    }
    // Token is optional — unauthenticated GitHub API works for public repos
    // (with a lower rate limit and no approve/merge writes).
    return new GitHubRepoSource(ref, token ?? null);
  }
  return new MockRepoSource();
}
