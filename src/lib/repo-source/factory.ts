import { GitHubRepoSource } from "./github";
import { MockRepoSource } from "./mock";
import type { Mode, RepoRef, RepoSource } from "./types";

export function getRepoSource(
  mode: Mode,
  ref?: RepoRef | null,
  token?: string | null,
): RepoSource {
  if (mode === "live") {
    if (!ref || !token) {
      throw new Error(
        "Live mode requires both a repo and a GitHub token. Falling back to mock mode.",
      );
    }
    return new GitHubRepoSource(ref, token);
  }
  return new MockRepoSource();
}
