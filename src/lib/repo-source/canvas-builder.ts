import type {
  PRCanvas,
  IntentNodeData,
  ArchitectureNodeData,
  ArchitectureModule,
  RiskNodeData,
  DiffNodeData,
  PreviewNodeData,
  TourStop,
  SurfaceNode,
  SurfaceEdge,
  ChangeKind,
  Surface,
  Scope,
} from "@/lib/types";
import type { PreviewStatus } from "./types";

type GhPR = {
  number: number;
  title: string;
  body: string | null;
  html_url: string;
  additions: number;
  deletions: number;
  changed_files: number;
};

type GhFile = {
  filename: string;
  additions: number;
  deletions: number;
  patch?: string;
  status: string;
};

const CHANGE_KEYWORDS: Array<{ rx: RegExp; kind: ChangeKind }> = [
  { rx: /^feat(?:ure)?(?:\b|\()/i, kind: "feature" },
  { rx: /^fix(?:\b|\()/i, kind: "fix" },
  { rx: /^refactor(?:\b|\()/i, kind: "refactor" },
];

const SURFACE_MAP: Array<{ rx: RegExp; surface: Surface }> = [
  { rx: /^(api|backend|server|prisma|db|database)$/i, surface: "backend" },
  { rx: /^(web|client|frontend|ui|app|components?|pages?)$/i, surface: "frontend" },
];

const RISK_PATTERNS: Array<{
  rx: RegExp;
  rule: string;
  severity: RiskNodeData["severity"];
}> = [
  {
    rx: /race condition/i,
    rule: "Potential race condition",
    severity: "high",
  },
  {
    rx: /not transactional|missing transaction|outside (a |the )?transaction/i,
    rule: "Non-transactional write path",
    severity: "high",
  },
  {
    rx: /breaking change|breaking api/i,
    rule: "Breaking API change",
    severity: "high",
  },
  {
    rx: /no rate limit|rate[- ]?limit(ing)? missing/i,
    rule: "Missing rate limiting",
    severity: "medium",
  },
  {
    rx: /sql injection|xss|csrf/i,
    rule: "Possible injection / XSS / CSRF",
    severity: "high",
  },
  {
    rx: /TODO|FIXME/i,
    rule: "Unresolved TODO/FIXME in code",
    severity: "low",
  },
];

function pickKind(title: string): ChangeKind {
  for (const c of CHANGE_KEYWORDS) if (c.rx.test(title)) return c.kind;
  return "feature";
}

function pickSurface(title: string, files: GhFile[]): Surface {
  const scopeMatch = title.match(/^[a-z]+\(([^)]+)\)/i);
  if (scopeMatch) {
    for (const m of SURFACE_MAP) if (m.rx.test(scopeMatch[1])) return m.surface;
  }
  const dirs = new Set(files.map((f) => f.filename.split("/")[0]));
  let backend = false;
  let frontend = false;
  for (const d of dirs) {
    for (const m of SURFACE_MAP) {
      if (m.rx.test(d)) {
        if (m.surface === "backend") backend = true;
        if (m.surface === "frontend") frontend = true;
      }
    }
  }
  if (backend && frontend) return "fullstack";
  if (backend) return "backend";
  if (frontend) return "frontend";
  return "fullstack";
}

function pickScope(files: GhFile[]): Scope {
  if (files.length <= 2) return "S";
  if (files.length <= 6) return "M";
  return "L";
}

function summarize(pr: GhPR): string {
  const body = (pr.body ?? "").trim();
  if (body) {
    // Walk lines, collecting the first real paragraph (blank-line delimited).
    const lines = body.split(/\r?\n/);
    const collected: string[] = [];
    let started = false;
    for (const raw of lines) {
      let line = raw.trim();
      // Blank line ends the paragraph (only if we've already started collecting).
      if (!line) {
        if (started) break;
        continue;
      }
      if (/^#+\s/.test(line)) continue;
      if (/^```/.test(line)) continue;
      if (/^<!--/.test(line) || /^-->/.test(line)) continue;
      if (/^[-*_]{3,}\s*$/.test(line)) continue;
      line = line.replace(/^[-*+]\s+/, "").replace(/^>\s+/, "").trim();
      if (!started) {
        // Strip a leading ticket prefix only at the start so the first
        // sentence isn't just "ACME-142."
        line = line.replace(/^[A-Z]{2,6}-\d{1,6}\s*[.:\-–—]\s*/, "").trim();
      }
      if (!line) continue;
      collected.push(line);
      started = true;
    }
    const paragraph = collected.join(" ").replace(/\s+/g, " ").trim();
    if (paragraph.length > 0) {
      // Return the full first paragraph; the card auto-grows. Only cap on
      // pathologically huge paragraphs (>2000 chars) to keep layout sane.
      if (paragraph.length <= 2000) return paragraph;
      const slice = paragraph.slice(0, 1997);
      const lastStop = Math.max(
        slice.lastIndexOf(". "),
        slice.lastIndexOf("! "),
        slice.lastIndexOf("? "),
      );
      if (lastStop > 1200) return slice.slice(0, lastStop + 1);
      return slice.trimEnd() + "…";
    }
  }
  const m = pr.title.match(/^[a-z]+(?:\([^)]+\))?:\s*(.+)$/i);
  return (m?.[1] ?? pr.title).trim();
}

function findTicket(body: string | null): string | undefined {
  if (!body) return undefined;
  const m = body.match(/\b([A-Z]{2,6}-\d{1,5})\b/);
  return m?.[1];
}

function buildIntent(pr: GhPR, files: GhFile[]): IntentNodeData {
  const fullBody = (pr.body ?? "").trim();
  return {
    kind: pickKind(pr.title),
    surface: pickSurface(pr.title, files),
    scope: pickScope(files),
    summary: summarize(pr),
    details: fullBody.length > 0 ? fullBody : undefined,
    ticket: findTicket(pr.body),
  };
}

function buildArchitecture(files: GhFile[]): ArchitectureNodeData {
  // Use second-level dirs when first level is a single big bucket, so a PR
  // touching "api/src/middleware/auth.ts" + "api/src/routes/transfers.ts"
  // shows up as `src/middleware` + `src/routes`, not just `api`.
  const dirs = new Map<string, { count: number; touched: boolean }>();
  for (const f of files) {
    const parts = f.filename.split("/");
    let label: string;
    if (parts.length === 1) label = parts[0];
    else if (parts.length === 2) label = parts[0];
    else label = `${parts[0]}/${parts[1]}`;
    const prev = dirs.get(label) ?? { count: 0, touched: false };
    dirs.set(label, { count: prev.count + 1, touched: true });
  }
  const entries = Array.from(dirs.entries()).slice(0, 6);
  const n = entries.length;

  // SVG inside ArchitectureNode is 208 wide × 200 tall; module is 86×26.
  const SVG_W = 208;
  const SVG_H = 200;
  const M_W = 86;
  const M_H = 26;

  const positions: Array<{ x: number; y: number }> = (() => {
    if (n === 1) return [{ x: (SVG_W - M_W) / 2, y: (SVG_H - M_H) / 2 }];
    if (n === 2)
      return [
        { x: 20, y: (SVG_H - M_H) / 2 },
        { x: SVG_W - M_W - 20, y: (SVG_H - M_H) / 2 },
      ];
    if (n === 3)
      return [
        { x: (SVG_W - M_W) / 2, y: 30 },
        { x: 12, y: SVG_H - M_H - 30 },
        { x: SVG_W - M_W - 12, y: SVG_H - M_H - 30 },
      ];
    // 4-6: 2-column grid
    const rows = Math.ceil(n / 2);
    const rowH = (SVG_H - 24) / rows;
    return entries.map((_, i) => ({
      x: 12 + (i % 2) * (SVG_W - M_W - 24),
      y: 12 + Math.floor(i / 2) * rowH,
    }));
  })();

  const modules: ArchitectureModule[] = entries.map(([label, info], i) => ({
    id: label,
    label,
    touched: info.touched,
    x: positions[i]?.x ?? 20,
    y: positions[i]?.y ?? 20,
  }));

  // No synthetic edges — only show real structure. Connections will be added
  // by the AI enrichment pass when it has actual import data.
  return { modules, connections: [] };
}

function buildRisks(pr: GhPR, files: GhFile[]): RiskNodeData[] {
  const text = `${pr.title}\n${pr.body ?? ""}`;
  const results: RiskNodeData[] = [];
  for (const pattern of RISK_PATTERNS) {
    const match = text.match(pattern.rx);
    if (!match) continue;
    if (results.find((r) => r.rule === pattern.rule)) continue;
    // Try to attach a likely file:line
    const file = files[0]?.filename ?? "";
    const line = 0;
    const around = extractContext(text, match.index ?? 0);
    results.push({
      rule: pattern.rule,
      file,
      line,
      rationale: around,
      severity: pattern.severity,
    });
    if (results.length >= 3) break;
  }
  return results;
}

function extractContext(body: string, idx: number): string {
  const start = Math.max(0, idx - 40);
  const end = Math.min(body.length, idx + 220);
  const snippet = body.slice(start, end).trim();
  return snippet.length > 0 ? snippet : "Flagged by Plot during PR scan.";
}

function buildDiff(files: GhFile[]): DiffNodeData {
  return {
    additions: files.reduce((s, f) => s + (f.additions ?? 0), 0),
    deletions: files.reduce((s, f) => s + (f.deletions ?? 0), 0),
    files: files.map((f) => ({
      path: f.filename,
      additions: f.additions ?? 0,
      deletions: f.deletions ?? 0,
      unifiedDiff: rebuildUnified(f),
    })),
  };
}

function rebuildUnified(f: GhFile): string | undefined {
  if (!f.patch) return undefined;
  // GitHub's `patch` field is the body of a unified diff. Prepend headers so
  // gitdiff-parser is happy.
  const oldPath =
    f.status === "added" ? "/dev/null" : `a/${f.filename}`;
  const newPath =
    f.status === "removed" ? "/dev/null" : `b/${f.filename}`;
  return `--- ${oldPath}\n+++ ${newPath}\n${f.patch}`;
}

function buildPreview(
  pr: GhPR,
  files: GhFile[],
  preview: PreviewStatus,
): PreviewNodeData {
  const surface = pickSurface(pr.title, files);
  const isBackendOnly = surface === "backend";
  if (preview.state === "ready") {
    return {
      url: preview.url,
      prNumber: pr.number,
      prTitle: pr.title,
      state: isBackendOnly ? "unchanged" : "ready",
      note: isBackendOnly
        ? "Backend-only PR — the deployed surface is unchanged."
        : undefined,
      source: preview.source,
    };
  }
  if (preview.state === "building") {
    return {
      url: preview.url ?? null,
      prNumber: pr.number,
      prTitle: pr.title,
      state: "building",
    };
  }
  if (preview.state === "failed") {
    return {
      url: null,
      prNumber: pr.number,
      prTitle: pr.title,
      state: "failed",
      note: preview.message,
    };
  }
  return {
    url: null,
    prNumber: pr.number,
    prTitle: pr.title,
    state: "unavailable",
    note: preview.reason,
  };
}

export function buildCanvasFromPR(
  pr: GhPR,
  files: GhFile[],
  preview: PreviewStatus = { state: "unavailable" },
): PRCanvas {
  const intentData = buildIntent(pr, files);
  const archData = buildArchitecture(files);
  const risks = buildRisks(pr, files);
  const diffData = buildDiff(files);
  const previewData = buildPreview(pr, files, preview);

  const nodes: SurfaceNode[] = [
    {
      id: "intent",
      type: "intent",
      position: { x: 0, y: 40 },
      data: intentData,
    },
    {
      id: "architecture",
      type: "architecture",
      position: { x: 320, y: 0 },
      data: archData,
    },
  ];

  risks.forEach((r, i) => {
    nodes.push({
      id: `risk-${i}`,
      type: "risk",
      position: { x: 660 + (i % 2) * 280, y: 240 + Math.floor(i / 2) * 220 },
      data: r,
    });
  });

  nodes.push({
    id: "preview",
    type: "preview",
    position: { x: 1080, y: 0 },
    data: previewData,
  });

  nodes.push({
    id: "diff",
    type: "diff",
    position: { x: 320, y: 600 },
    data: diffData,
  });

  const edges: SurfaceEdge[] = [
    {
      id: "e-intent-architecture",
      source: "intent",
      target: "architecture",
      animated: true,
    },
    {
      id: "e-architecture-preview",
      source: "architecture",
      target: "preview",
      animated: true,
      data: { label: "deploys to" },
    },
  ];

  risks.forEach((_, i) => {
    edges.push({
      id: `e-arch-risk-${i}`,
      source: "architecture",
      target: `risk-${i}`,
      data: { relationship: "risk" },
    });
  });

  edges.push({
    id: "e-architecture-diff",
    source: "architecture",
    target: "diff",
    animated: true,
  });

  const tour: TourStop[] = [
    {
      nodeId: "intent",
      title: "Why this PR",
      caption: intentData.summary,
    },
    {
      nodeId: "architecture",
      title: "What it touches",
      caption: `${files.length} file${files.length === 1 ? "" : "s"} across ${
        archData.modules.length
      } module${archData.modules.length === 1 ? "" : "s"}.`,
    },
    ...risks.map((r, i) => ({
      nodeId: `risk-${i}`,
      title: `Risk · ${r.severity}`,
      caption: r.rationale,
    })),
    // Alternatives stop is injected by AI enrichment when available.
    {
      nodeId: "preview",
      title:
        previewData.state === "unchanged"
          ? "Live preview — surface unchanged"
          : previewData.state === "ready"
            ? "Live preview"
            : previewData.state === "building"
              ? "Preview building…"
              : "Preview unavailable",
      caption:
        previewData.state === "ready"
          ? `Deployed branch is reachable at ${previewData.url}. Poke around the UI before merging.`
          : previewData.state === "unchanged"
            ? "This PR doesn't touch the deployed surface — the preview matches production."
            : previewData.note ?? "No live preview deployment was found for this PR's head SHA.",
    },
    {
      nodeId: "diff",
      title: "Total footprint",
      caption: `+${diffData.additions} additions · −${diffData.deletions} deletions across ${diffData.files.length} files.`,
    },
  ];

  return { nodes, edges, tour };
}
