import type {
  PRCanvas,
  IntentNodeData,
  RiskNodeData,
  SurfaceNode,
  SurfaceEdge,
  ChangeKind,
  Surface,
  Scope,
  RiskSeverity,
  AlternativesNodeData,
  AlternativeOption,
  ChangeCardNodeData,
  TourStop,
} from "@/lib/types";

type EnrichInput = {
  title: string;
  body: string;
  files: Array<{
    filename: string;
    additions: number;
    deletions: number;
    patch?: string;
  }>;
};

type AIRisk = {
  rule?: string;
  rationale?: string;
  severity?: string;
  file?: string;
  line?: number;
};

type AIOption = {
  name?: string;
  summary?: string;
  pros?: string[];
  cons?: string[];
  code?: string;
  whenToUse?: string;
};

type AIAlternatives = {
  question?: string;
  chosenIndex?: number;
  options?: AIOption[];
};

type AIChange = {
  symbol?: string;
  file?: string;
  beforeSteps?: number;
  afterSteps?: number;
  beforeMermaid?: string;
  afterMermaid?: string;
};

type IntentPayload = {
  summary?: string;
  kind?: string;
  surface?: string;
  scope?: string;
};

function clampKind(s: string | undefined, fallback: ChangeKind): ChangeKind {
  if (s === "feature" || s === "fix" || s === "refactor") return s;
  return fallback;
}
function clampSurface(s: string | undefined, fallback: Surface): Surface {
  if (s === "frontend" || s === "backend" || s === "fullstack") return s;
  return fallback;
}
function clampScope(s: string | undefined, fallback: Scope): Scope {
  if (s === "S" || s === "M" || s === "L") return s;
  return fallback;
}
function clampSeverity(s: string | undefined): RiskSeverity {
  if (s === "high" || s === "medium" || s === "low") return s;
  return "medium";
}

function validMermaid(src: string | undefined): src is string {
  if (!src) return false;
  const trimmed = src.trim();
  if (!/^flowchart\s/i.test(trimmed)) return false;
  return /-->/i.test(trimmed);
}

function applyIntent(canvas: PRCanvas, intent: IntentPayload): PRCanvas {
  const nodes = canvas.nodes.map((n) => {
    if (n.type !== "intent") return n;
    const d = n.data as IntentNodeData;
    const next: IntentNodeData = {
      ...d,
      summary: (intent.summary ?? d.summary).trim() || d.summary,
      kind: clampKind(intent.kind, d.kind),
      surface: clampSurface(intent.surface, d.surface),
      scope: clampScope(intent.scope, d.scope),
    };
    return { ...n, data: next };
  });
  return { ...canvas, nodes };
}

function applyRisks(canvas: PRCanvas, risks: AIRisk[]): PRCanvas {
  if (!risks || risks.length === 0) return canvas;
  const nodes: SurfaceNode[] = canvas.nodes.filter((n) => n.type !== "risk");
  const edges: SurfaceEdge[] = canvas.edges.filter(
    (e) => !e.id.startsWith("e-arch-risk-"),
  );
  const aiRisks: SurfaceNode[] = risks.slice(0, 4).map((r, i) => ({
    id: `risk-${i}`,
    type: "risk",
    position: { x: 660 + (i % 2) * 280, y: 240 + Math.floor(i / 2) * 220 },
    data: {
      rule: (r.rule ?? "Unnamed risk").slice(0, 80),
      rationale: r.rationale ?? "",
      severity: clampSeverity(r.severity),
      file: r.file ?? "",
      line: typeof r.line === "number" ? r.line : 0,
    } as RiskNodeData,
  }));
  nodes.push(...aiRisks);
  aiRisks.forEach((r) => {
    edges.push({
      id: `e-arch-${r.id}`,
      source: "architecture",
      target: r.id,
      data: { relationship: "risk" },
    });
  });
  // Update tour: replace risk stops, place them right after Intent.
  let tour = canvas.tour;
  if (tour) {
    tour = tour.filter((s) => !s.nodeId.startsWith("risk-"));
    const intentIdx = tour.findIndex((s) => s.nodeId === "intent");
    const inject = aiRisks.map((r) => ({
      nodeId: r.id,
      title: `Risk · ${(r.data as RiskNodeData).severity}`,
      caption: (r.data as RiskNodeData).rationale,
    }));
    tour.splice(intentIdx >= 0 ? intentIdx + 1 : 0, 0, ...inject);
  }
  return { ...canvas, nodes, edges, tour };
}

function applyAlternatives(
  canvas: PRCanvas,
  alts: AIAlternatives | null,
): PRCanvas {
  if (!alts || !Array.isArray(alts.options) || alts.options.length < 2)
    return canvas;
  const opts = alts.options.slice(0, 4).map(
    (o, i): AlternativeOption => ({
      name: (o.name ?? `Option ${i + 1}`).slice(0, 60),
      summary: (o.summary ?? "").slice(0, 280),
      pros: (o.pros ?? []).slice(0, 3),
      cons: (o.cons ?? []).slice(0, 3),
      code: (o.code ?? "").slice(0, 700),
      whenToUse: (o.whenToUse ?? "").slice(0, 180),
    }),
  );
  const altData: AlternativesNodeData = {
    question: (alts.question ?? "Design choice").slice(0, 140),
    chosenIndex: Math.min(
      Math.max(0, alts.chosenIndex ?? 0),
      opts.length - 1,
    ),
    options: opts,
  };
  const altNode: SurfaceNode = {
    id: "alternatives",
    type: "alternatives",
    position: { x: 680, y: 60 },
    data: altData,
  };
  const nodes = canvas.nodes.filter((n) => n.id !== "alternatives");
  nodes.push(altNode);
  const edges = canvas.edges.filter((e) => e.target !== "alternatives");
  edges.push({
    id: "e-architecture-alternatives",
    source: "architecture",
    target: "alternatives",
    animated: true,
  });
  let tour = canvas.tour;
  if (tour) {
    tour = tour.filter((s) => s.nodeId !== "alternatives");
    // Inject between Risks and Diff. If no risks yet, place before Diff.
    const diffIdx = tour.findIndex((s) => s.nodeId === "diff");
    const insertAt = diffIdx >= 0 ? diffIdx : tour.length;
    tour.splice(insertAt, 0, {
      nodeId: "alternatives",
      title: "The decision",
      caption: `${altData.options[altData.chosenIndex]?.name ?? ""} won — ${altData.options[altData.chosenIndex]?.summary ?? ""}`.trim(),
    });
  }
  return { ...canvas, nodes, edges, tour };
}

function applyChanges(canvas: PRCanvas, changes: AIChange[]): PRCanvas {
  if (!changes || changes.length === 0) return canvas;
  // Drop any previous change cards we may have appended.
  const nodes: SurfaceNode[] = canvas.nodes.filter(
    (n) => !(n.type === "change" && n.id.startsWith("change-")),
  );
  const edges: SurfaceEdge[] = canvas.edges.filter(
    (e) => !e.id.startsWith("e-arch-change-"),
  );
  const accepted: AIChange[] = [];
  for (const c of changes) {
    if (!c.symbol || !c.file) continue;
    accepted.push(c);
    if (accepted.length >= 3) break;
  }
  let tour = canvas.tour ? canvas.tour.filter((s) => !s.nodeId.startsWith("change-")) : undefined;
  accepted.forEach((c, i) => {
    const beforeOK = validMermaid(c.beforeMermaid);
    const afterOK = validMermaid(c.afterMermaid);
    const cardData: ChangeCardNodeData = {
      symbol: c.symbol!,
      file: c.file!,
      beforeSteps: typeof c.beforeSteps === "number" ? c.beforeSteps : 0,
      afterSteps: typeof c.afterSteps === "number" ? c.afterSteps : 0,
      beforeMermaid: beforeOK ? c.beforeMermaid : undefined,
      afterMermaid: afterOK ? c.afterMermaid : undefined,
    };
    const id = `change-${i}`;
    nodes.push({
      id,
      type: "change",
      position: { x: 0 + i * 320, y: 560 },
      data: cardData,
    });
    edges.push({
      id: `e-arch-${id}`,
      source: "architecture",
      target: id,
      animated: true,
      data: { label: i === 0 ? "changes" : undefined },
    });
    if (tour) {
      const diffIdx = tour.findIndex((s) => s.nodeId === "diff");
      tour.splice(diffIdx >= 0 ? diffIdx : tour.length, 0, {
        nodeId: id,
        title: `Change · ${cardData.symbol}()`,
        caption: `${cardData.beforeSteps} → ${cardData.afterSteps} step${cardData.afterSteps === 1 ? "" : "s"} in ${cardData.file}`,
      });
    }
  });
  return { ...canvas, nodes, edges, tour };
}

/**
 * Stream the canvas enrichment from /api/ai/canvas section by section.
 * `onUpdate` is called every time a section arrives with the partially-merged
 * canvas. The final canvas is returned.
 */
export async function enrichCanvasWithAI(
  canvas: PRCanvas,
  input: EnrichInput,
  openaiKey: string | null,
  onUpdate?: (next: PRCanvas) => void,
): Promise<PRCanvas> {
  let current = canvas;
  try {
    const res = await fetch("/api/ai/canvas", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(openaiKey ? { "x-openai-key": openaiKey } : {}),
      },
      body: JSON.stringify(input),
    });
    if (!res.ok || !res.body) return canvas;

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    const applySection = (section: string, value: unknown) => {
      switch (section) {
        case "intent":
          current = applyIntent(current, value as IntentPayload);
          break;
        case "risks":
          current = applyRisks(current, (value as { risks?: AIRisk[] })?.risks ?? []);
          break;
        case "alternatives":
          current = applyAlternatives(
            current,
            (value as { alternatives?: AIAlternatives })?.alternatives ?? null,
          );
          break;
        case "changes":
          current = applyChanges(
            current,
            (value as { changes?: AIChange[] })?.changes ?? [],
          );
          break;
      }
      onUpdate?.(current);
    };

    // eslint-disable-next-line no-constant-condition
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let idx: number;
      while ((idx = buffer.indexOf("\n\n")) >= 0) {
        const chunk = buffer.slice(0, idx).trim();
        buffer = buffer.slice(idx + 2);
        if (!chunk) continue;
        for (const line of chunk.split("\n")) {
          if (!line.startsWith("data:")) continue;
          const payload = line.slice(5).trim();
          if (payload === "[DONE]") continue;
          try {
            const event = JSON.parse(payload) as {
              section?: string;
              value?: unknown;
              error?: string;
            };
            if (event.error || !event.section || !("value" in event)) continue;
            applySection(event.section, event.value);
          } catch {
            /* skip malformed */
          }
        }
      }
    }
  } catch {
    /* swallow — heuristic canvas remains */
  }
  return current;
}
