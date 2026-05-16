import type { Node, Edge } from "@xyflow/react";

export type ChangeKind = "feature" | "fix" | "refactor";
export type Surface = "frontend" | "backend" | "fullstack";
export type Scope = "S" | "M" | "L";

export type IntentNodeData = {
  kind: ChangeKind;
  surface: Surface;
  scope: Scope;
  summary: string;
  /** Full long-form description (PR body), shown in the "Show full intent" sheet. */
  details?: string;
  ticket?: string;
};

export type ArchitectureModule = {
  id: string;
  label: string;
  touched: boolean;
  x: number;
  y: number;
};

export type ArchitectureConnection = {
  from: string;
  to: string;
};

export type ArchitectureNodeData = {
  modules: ArchitectureModule[];
  connections: ArchitectureConnection[];
};

export type ChangeCardNodeData = {
  symbol: string;
  file: string;
  beforeSteps: number;
  afterSteps: number;
  beforeMermaid?: string;
  afterMermaid?: string;
  /** Controllable expansion — drives the card open from outside (e.g. tour). */
  expanded?: boolean;
};

export type AlternativeOption = {
  name: string;
  summary: string;
  pros: string[];
  cons: string[];
  code: string;
  whenToUse: string;
};

export type AlternativesNodeData = {
  question: string;
  chosenIndex: number;
  options: AlternativeOption[];
};

export type RiskSeverity = "low" | "medium" | "high";

export type RiskNodeData = {
  rule: string;
  file: string;
  line: number;
  rationale: string;
  severity: RiskSeverity;
  codeExcerpt?: string;
};

export type DiffFileEntry = {
  path: string;
  additions: number;
  deletions: number;
  /** Optional unified-diff source. When present the sheet renders a real line-by-line diff. */
  unifiedDiff?: string;
};

export type DiffNodeData = {
  additions: number;
  deletions: number;
  files: DiffFileEntry[];
};

export type PreviewNodeData = {
  url: string | null;
  prNumber: number;
  prTitle: string;
  state: "ready" | "building" | "failed" | "unavailable" | "unchanged";
  note?: string;
  source?: string;
};

export type NodeKind =
  | "intent"
  | "architecture"
  | "change"
  | "alternatives"
  | "risk"
  | "diff";

export type IntentNodeType = Node<IntentNodeData, "intent">;
export type ArchitectureNodeType = Node<ArchitectureNodeData, "architecture">;
export type ChangeCardNodeType = Node<ChangeCardNodeData, "change">;
export type AlternativesNodeType = Node<AlternativesNodeData, "alternatives">;
export type RiskNodeType = Node<RiskNodeData, "risk">;
export type DiffNodeType = Node<DiffNodeData, "diff">;
export type PreviewNodeType = Node<PreviewNodeData, "preview">;

export type SurfaceNode =
  | IntentNodeType
  | ArchitectureNodeType
  | ChangeCardNodeType
  | AlternativesNodeType
  | RiskNodeType
  | DiffNodeType
  | PreviewNodeType;

export type SurfaceEdge = Edge & {
  data?: {
    relationship?: "default" | "risk";
    label?: string;
  };
};

export type TourStop = {
  nodeId: string;
  title: string;
  caption: string;
  /** Optional override zoom for this stop. */
  zoom?: number;
};

export type PRCanvas = {
  nodes: SurfaceNode[];
  edges: SurfaceEdge[];
  tour?: TourStop[];
};

export type PRSummary = {
  number: number;
  title: string;
  author: string;
  files_changed: number;
};

export type Repo = {
  name: string;
  prs: PRSummary[];
};
