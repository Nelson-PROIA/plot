/**
 * Fetch raw file content from `raw.githubusercontent.com`.
 *
 * raw.githubusercontent.com serves the file body without counting against the
 * GitHub REST API rate limit (60 req/h anonymous). That's the only realistic
 * way to ingest a repo unauthenticated.
 *
 * Supports `Authorization: token <pat>` for private repos when a token is
 * provided.
 */
export async function fetchRawFile(
  owner: string,
  repo: string,
  ref: string,
  path: string,
  token?: string | null,
): Promise<string | null> {
  const url = `https://raw.githubusercontent.com/${owner}/${repo}/${encodeURIComponent(ref)}/${path
    .split("/")
    .map(encodeURIComponent)
    .join("/")}`;
  const res = await fetch(url, {
    headers: token ? { Authorization: `token ${token}` } : undefined,
    // Lightly cache on the server side so repeated visitors don't re-fetch
    // identical commits.
    next: { revalidate: 3600 },
  });
  if (!res.ok) return null;
  return res.text();
}
