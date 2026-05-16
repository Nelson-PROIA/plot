import type { PRCanvas } from "@/lib/types";

const PREFIX = "plot-ai-canvas";
const TTL_MS = 24 * 60 * 60 * 1000; // 1 day

function keyFor(owner: string, repo: string, sha: string) {
  return `${PREFIX}::${owner}/${repo}@${sha}`;
}

type CacheEntry = {
  ts: number;
  canvas: PRCanvas;
};

export function loadCachedEnrichment(
  owner: string,
  repo: string,
  sha: string,
): PRCanvas | null {
  try {
    const raw = localStorage.getItem(keyFor(owner, repo, sha));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CacheEntry;
    if (Date.now() - parsed.ts > TTL_MS) {
      localStorage.removeItem(keyFor(owner, repo, sha));
      return null;
    }
    return parsed.canvas;
  } catch {
    return null;
  }
}

export function saveCachedEnrichment(
  owner: string,
  repo: string,
  sha: string,
  canvas: PRCanvas,
) {
  try {
    localStorage.setItem(
      keyFor(owner, repo, sha),
      JSON.stringify({ ts: Date.now(), canvas } satisfies CacheEntry),
    );
  } catch {
    /* quota / blocked */
  }
}
