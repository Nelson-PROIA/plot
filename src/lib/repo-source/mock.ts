import type {
  MergeResult,
  PRSummary,
  PreviewStatus,
  RepoMeta,
  RepoSource,
} from "./types";
import type { PRCanvas } from "@/lib/types";
import pr42 from "@/lib/mock-data/pr-42.json";
import pr41 from "@/lib/mock-data/pr-41.json";
import repo from "@/lib/mock-data/repo.json";
import { DIFFS } from "@/lib/mock-data/diffs";

function hydrateDiffs(prNumber: string, canvas: PRCanvas): PRCanvas {
  const diffMap = DIFFS[prNumber];
  if (!diffMap) return canvas;
  return {
    ...canvas,
    nodes: canvas.nodes.map((node) => {
      if (node.type !== "diff") return node;
      const data = node.data as { files?: { path: string }[] };
      if (!data.files) return node;
      return {
        ...node,
        data: {
          ...data,
          files: data.files.map((f) => ({
            ...f,
            unifiedDiff: diffMap[f.path],
          })),
        },
      } as typeof node;
    }),
  };
}

const CANVASES: Record<string, PRCanvas> = {
  "42": hydrateDiffs("42", pr42 as unknown as PRCanvas),
  "41": hydrateDiffs("41", pr41 as unknown as PRCanvas),
};

export class MockRepoSource implements RepoSource {
  readonly mode = "mock" as const;

  async meta(): Promise<RepoMeta> {
    return {
      name: repo.name,
      fullName: `acme/${repo.name}`,
      htmlUrl: `https://example.com/acme/${repo.name}`,
      defaultBranch: "main",
      owner: "acme",
    };
  }

  async listPRs(): Promise<PRSummary[]> {
    return repo.prs.map((pr) => ({
      number: pr.number,
      title: pr.title,
      author: pr.author,
      filesChanged: pr.files_changed,
      headRef: `mock/${pr.number}`,
      baseRef: "main",
      htmlUrl: `https://example.com/acme/${repo.name}/pull/${pr.number}`,
      body: "",
    }));
  }

  async getPRCanvas(number: number): Promise<PRCanvas> {
    const c = CANVASES[String(number)];
    if (!c) throw new Error(`Mock canvas for PR #${number} not found`);
    return c;
  }

  async mergePR(_number: number): Promise<MergeResult> {
    // Simulated delay for the demo button animation.
    await new Promise((r) => setTimeout(r, 800));
    return {
      merged: true,
      sha: "mock-" + Math.random().toString(36).slice(2, 10),
      message: "Simulated squash-merge (mock mode).",
    };
  }

  async getPreviewUrl(_number: number): Promise<PreviewStatus> {
    return {
      state: "unavailable",
      reason: "Mock mode — no live preview deployment.",
    };
  }
}
