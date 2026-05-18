import { Octokit } from "@octokit/rest";

/**
 * Build an Octokit client that goes through Plot's server-side proxy
 * (`/api/gh/*`) so the deploy-time GITHUB_TOKEN authenticates every call.
 * The token never reaches the browser.
 *
 * If the user supplied their own PAT (write access / private repos), it rides
 * along in the Authorization header and the server forwards it as-is.
 */
export function getOctokit(userToken?: string | null): Octokit {
  const baseUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/api/gh`
      : // Fallback for any SSR path — pure-relative isn't allowed by fetch().
        "/api/gh";
  return new Octokit({
    baseUrl,
    auth: userToken || undefined,
  });
}
