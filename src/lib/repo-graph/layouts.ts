import dagre from "dagre";
import type {
  RepoFile,
  RepoGraph,
  RepoSymbol,
  SymbolCallEdge,
} from "./types";

// ───── File-level (kept from previous version) ─────

export const FILE_W = 220;
export const FILE_H = 26;
export const FILE_GAP = 6;
export const SIG_ROW_H = 22;
export const SIG_PADDING_Y = 8;
export const GROUP_PADDING = 14;
export const GROUP_HEADER = 30;
export const GROUP_GAP_X = 56;
export const GROUP_GAP_Y = 40;

export type GroupBox = {
  id: string;
  group: string;
  x: number;
  y: number;
  w: number;
  h: number;
};

export type FilePos = {
  parentId: string;
  x: number;
  y: number;
};

export function layoutFiles(
  files: RepoFile[],
  groups: string[],
  heightFor: (path: string) => number,
): { groupBoxes: GroupBox[]; filePositions: Map<string, FilePos> } {
  const byGroup = new Map<string, RepoFile[]>();
  for (const g of groups) byGroup.set(g, []);
  for (const f of files) {
    const bucket = byGroup.get(f.group) ?? [];
    bucket.push(f);
    byGroup.set(f.group, bucket);
  }
  byGroup.forEach((bucket) =>
    bucket.sort((a, b) => a.path.localeCompare(b.path)),
  );

  const ordered = [...groups].sort(
    (a, b) => (byGroup.get(b)?.length ?? 0) - (byGroup.get(a)?.length ?? 0),
  );

  const groupW = FILE_W + GROUP_PADDING * 2;
  const cols = Math.max(1, Math.min(4, Math.ceil(Math.sqrt(ordered.length))));
  const colHeights = new Array(cols).fill(0);

  const groupBoxes: GroupBox[] = [];
  const filePositions = new Map<string, FilePos>();

  ordered.forEach((g) => {
    const bucket = byGroup.get(g) ?? [];
    const heights = bucket.map((f) => heightFor(f.path));
    const inner =
      heights.reduce((s, h) => s + h, 0) +
      Math.max(0, bucket.length - 1) * FILE_GAP;
    const h =
      GROUP_HEADER + GROUP_PADDING + Math.max(FILE_H, inner) + GROUP_PADDING;

    let col = 0;
    for (let i = 1; i < cols; i++) {
      if (colHeights[i] < colHeights[col]) col = i;
    }
    const x = col * (groupW + GROUP_GAP_X);
    const y = colHeights[col];
    colHeights[col] = y + h + GROUP_GAP_Y;

    const id = `group:${g}`;
    groupBoxes.push({ id, group: g, x, y, w: groupW, h });

    let cursor = GROUP_HEADER + GROUP_PADDING;
    bucket.forEach((f, idx) => {
      filePositions.set(f.path, {
        parentId: id,
        x: GROUP_PADDING,
        y: cursor,
      });
      cursor += heights[idx] + FILE_GAP;
    });
  });

  return { groupBoxes, filePositions };
}

// ───── System level (groups as big bubbles) ─────

export const SYSTEM_BUBBLE_W = 260;
export const SYSTEM_BUBBLE_H = 158;
export const SYSTEM_GAP_X = 110;
export const SYSTEM_GAP_Y = 90;

export type SystemBubble = {
  id: string;
  group: string;
  x: number;
  y: number;
  w: number;
  h: number;
};

export function layoutSystem(groups: string[]): SystemBubble[] {
  if (groups.length === 0) return [];
  const cols = Math.max(1, Math.ceil(Math.sqrt(groups.length)));
  return groups.map((g, i) => ({
    id: `sys:${g}`,
    group: g,
    x: (i % cols) * (SYSTEM_BUBBLE_W + SYSTEM_GAP_X),
    y: Math.floor(i / cols) * (SYSTEM_BUBBLE_H + SYSTEM_GAP_Y),
    w: SYSTEM_BUBBLE_W,
    h: SYSTEM_BUBBLE_H,
  }));
}

/** Aggregate file→file import edges into group→group counts. */
export function aggregateGroupEdges(
  graph: RepoGraph,
): Array<{ source: string; target: string; weight: number }> {
  const fileToGroup = new Map<string, string>(
    graph.files.map((f) => [f.path, f.group]),
  );
  const acc = new Map<string, number>();
  for (const e of graph.edges) {
    const sg = fileToGroup.get(e.source);
    const tg = fileToGroup.get(e.target);
    if (!sg || !tg || sg === tg) continue;
    const key = `${sg}->${tg}`;
    acc.set(key, (acc.get(key) ?? 0) + 1);
  }
  return Array.from(acc.entries()).map(([k, weight]) => {
    const [source, target] = k.split("->");
    return { source, target, weight };
  });
}

// ───── Symbol level (symbols inside lightweight file containers) ─────

export const SYMBOL_W = 168;
export const SYMBOL_H = 30;
export const SYMBOL_GAP_Y = 4;
export const FILE_CONTAINER_HEADER = 26;
export const FILE_CONTAINER_PADDING = 12;
export const FILE_GAP_X = 36;
export const FILE_GAP_Y = 28;

export type SymbolFileBox = {
  id: string;
  filePath: string;
  group: string;
  x: number;
  y: number;
  w: number;
  h: number;
};

export type SymbolPos = {
  parentId: string;
  x: number;
  y: number;
};

/**
 * Lay out symbols grouped by their containing file. File containers flow
 * into columns; symbols stack vertically inside each file. We keep the
 * group containers from `layoutFiles` for a familiar visual envelope.
 */
export function layoutSymbols(
  symbols: RepoSymbol[],
  files: RepoFile[],
): {
  fileBoxes: SymbolFileBox[];
  symbolPositions: Map<string, SymbolPos>;
} {
  const symbolsByFile = new Map<string, RepoSymbol[]>();
  for (const s of symbols) {
    const arr = symbolsByFile.get(s.file) ?? [];
    arr.push(s);
    symbolsByFile.set(s.file, arr);
  }
  symbolsByFile.forEach((arr) => arr.sort((a, b) => a.line - b.line));

  // Only include files that have at least one symbol.
  const filesWithSymbols = files.filter((f) => symbolsByFile.has(f.path));
  filesWithSymbols.sort((a, b) => {
    if (a.group !== b.group) return a.group.localeCompare(b.group);
    return a.path.localeCompare(b.path);
  });

  const fileW = SYMBOL_W + FILE_CONTAINER_PADDING * 2;
  const cols = Math.max(
    1,
    Math.min(6, Math.ceil(Math.sqrt(filesWithSymbols.length))),
  );
  const colHeights = new Array(cols).fill(0);

  const fileBoxes: SymbolFileBox[] = [];
  const symbolPositions = new Map<string, SymbolPos>();

  filesWithSymbols.forEach((f) => {
    const sigs = symbolsByFile.get(f.path) ?? [];
    const innerH =
      sigs.length * SYMBOL_H +
      Math.max(0, sigs.length - 1) * SYMBOL_GAP_Y;
    const h =
      FILE_CONTAINER_HEADER +
      FILE_CONTAINER_PADDING +
      innerH +
      FILE_CONTAINER_PADDING;

    let col = 0;
    for (let i = 1; i < cols; i++) {
      if (colHeights[i] < colHeights[col]) col = i;
    }
    const x = col * (fileW + FILE_GAP_X);
    const y = colHeights[col];
    colHeights[col] = y + h + FILE_GAP_Y;

    const id = `fileBox:${f.path}`;
    fileBoxes.push({
      id,
      filePath: f.path,
      group: f.group,
      x,
      y,
      w: fileW,
      h,
    });

    let cursor = FILE_CONTAINER_HEADER + FILE_CONTAINER_PADDING;
    for (const sig of sigs) {
      symbolPositions.set(sig.id, {
        parentId: id,
        x: FILE_CONTAINER_PADDING,
        y: cursor,
      });
      cursor += SYMBOL_H + SYMBOL_GAP_Y;
    }
  });

  return { fileBoxes, symbolPositions };
}

/**
 * File-level dagre layout. Positions files by their import-graph topology
 * so the canvas reads as a graph (the user's explicit ask: "floating files,
 * grouped together, linked with edges"). Group coloring is layered on top
 * visually by the caller; this function only computes positions.
 */
export type FileGraphPos = { x: number; y: number; w: number; h: number };

export function layoutFilesGraph(
  files: RepoFile[],
  edges: { source: string; target: string }[],
  heightFor: (path: string) => number = () => FILE_H,
): {
  positions: Map<string, FileGraphPos>;
  groupHulls: Array<{ group: string; x: number; y: number; w: number; h: number }>;
} {
  const g = new dagre.graphlib.Graph({ compound: false });
  g.setGraph({
    rankdir: "LR",
    nodesep: 24,
    ranksep: 110,
    marginx: 60,
    marginy: 60,
    ranker: "longest-path",
  });
  g.setDefaultEdgeLabel(() => ({}));

  const present = new Set<string>();
  for (const f of files) {
    g.setNode(f.path, { width: FILE_W, height: heightFor(f.path) });
    present.add(f.path);
  }
  for (const e of edges) {
    if (!present.has(e.source) || !present.has(e.target)) continue;
    if (e.source === e.target) continue;
    g.setEdge(e.source, e.target);
  }
  dagre.layout(g);

  const positions = new Map<string, FileGraphPos>();
  for (const f of files) {
    const dn = g.node(f.path);
    if (!dn) continue;
    positions.set(f.path, {
      x: dn.x - dn.width / 2,
      y: dn.y - dn.height / 2,
      w: dn.width,
      h: dn.height,
    });
  }

  // Group hulls: bounding box (with padding) around each group's files.
  const HULL_PAD = 18;
  const groupAcc = new Map<
    string,
    { minX: number; minY: number; maxX: number; maxY: number }
  >();
  for (const f of files) {
    const p = positions.get(f.path);
    if (!p) continue;
    const cur = groupAcc.get(f.group);
    if (!cur) {
      groupAcc.set(f.group, {
        minX: p.x,
        minY: p.y,
        maxX: p.x + p.w,
        maxY: p.y + p.h,
      });
    } else {
      cur.minX = Math.min(cur.minX, p.x);
      cur.minY = Math.min(cur.minY, p.y);
      cur.maxX = Math.max(cur.maxX, p.x + p.w);
      cur.maxY = Math.max(cur.maxY, p.y + p.h);
    }
  }
  const groupHulls = Array.from(groupAcc.entries()).map(([group, b]) => ({
    group,
    x: b.minX - HULL_PAD,
    y: b.minY - HULL_PAD,
    w: b.maxX - b.minX + 2 * HULL_PAD,
    h: b.maxY - b.minY + 2 * HULL_PAD,
  }));

  return { positions, groupHulls };
}

/**
 * Force-directed-ish symbol layout via dagre. Used when the user wants a
 * graph feel rather than the rigid file-grouped grid. Symbols are
 * positioned by their call-graph topology; the caller adds visual
 * group-coloring on top.
 */
export function layoutSymbolsGraph(
  symbols: RepoSymbol[],
  callEdges: SymbolCallEdge[],
  files: RepoFile[],
): { positions: Map<string, { x: number; y: number }> } {
  const fileToGroup = new Map<string, string>(
    files.map((f) => [f.path, f.group]),
  );

  const g = new dagre.graphlib.Graph({ compound: false });
  g.setGraph({
    rankdir: "LR",
    nodesep: 18,
    ranksep: 80,
    marginx: 40,
    marginy: 40,
    ranker: "longest-path",
  });
  g.setDefaultEdgeLabel(() => ({}));

  const present = new Set<string>();
  for (const sym of symbols) {
    g.setNode(sym.id, { width: SYMBOL_W, height: SYMBOL_H });
    present.add(sym.id);
  }
  for (const e of callEdges) {
    if (!present.has(e.source) || !present.has(e.target)) continue;
    if (e.source === e.target) continue;
    g.setEdge(e.source, e.target);
  }

  dagre.layout(g);

  // Group rows: dagre rank-orders well but we want a soft cluster-by-group
  // tilt to make groups feel visually adjacent. After dagre, nudge each node
  // by a small per-group y-offset (constant per group). This preserves the
  // call-graph flow on the X axis while making groups visually band.
  const groupBands = new Map<string, number>();
  for (const sym of symbols) {
    const grp = fileToGroup.get(sym.file) ?? "root";
    if (!groupBands.has(grp)) groupBands.set(grp, groupBands.size);
  }
  const BAND_HEIGHT = 28;

  const positions = new Map<string, { x: number; y: number }>();
  for (const sym of symbols) {
    const dn = g.node(sym.id);
    if (!dn) continue;
    const grp = fileToGroup.get(sym.file) ?? "root";
    const band = groupBands.get(grp) ?? 0;
    positions.set(sym.id, {
      x: dn.x - SYMBOL_W / 2,
      y: dn.y - SYMBOL_H / 2 + band * BAND_HEIGHT * 0.02, // very subtle tilt
    });
  }
  return { positions };
}

/** Limit which call edges we render to keep the canvas legible. */
export function visibleCallEdges(
  callEdges: SymbolCallEdge[],
  ids: Set<string>,
  cap = 600,
): SymbolCallEdge[] {
  const out: SymbolCallEdge[] = [];
  for (const e of callEdges) {
    if (!ids.has(e.source) || !ids.has(e.target)) continue;
    out.push(e);
    if (out.length >= cap) break;
  }
  return out;
}

// ───── Code level (each symbol = a body excerpt card) ─────

export const CODE_W = 360;
export const CODE_H = 196;
export const CODE_GAP_X = 48;
export const CODE_GAP_Y = 56;

export type CodePos = {
  x: number;
  y: number;
};

/**
 * Code-level layout: lay function-like symbols out in a grid clustered by
 * file. Cards are roomy on purpose so the body excerpt is legible.
 */
export function layoutCode(
  symbols: RepoSymbol[],
  files: RepoFile[],
): {
  positions: Map<string, CodePos>;
  symbolIds: string[];
} {
  // Only show symbols that have a meaningful body — functions, components,
  // classes. Const values + types are too small / structureless to be useful
  // at this granularity.
  const showable = symbols.filter(
    (s) =>
      s.kind === "function" ||
      s.kind === "component" ||
      s.kind === "default" ||
      s.kind === "class",
  );

  const fileOrder = new Map<string, number>(
    files.map((f, i) => [f.path, i]),
  );
  showable.sort((a, b) => {
    const fa = fileOrder.get(a.file) ?? 0;
    const fb = fileOrder.get(b.file) ?? 0;
    if (fa !== fb) return fa - fb;
    return a.line - b.line;
  });

  const cols = Math.max(1, Math.min(4, Math.ceil(Math.sqrt(showable.length / 3))));
  const positions = new Map<string, CodePos>();
  showable.forEach((s, i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    positions.set(s.id, {
      x: col * (CODE_W + CODE_GAP_X),
      y: row * (CODE_H + CODE_GAP_Y),
    });
  });
  return { positions, symbolIds: showable.map((s) => s.id) };
}

/**
 * Extract the body of a function-like symbol from a file's source. Returns
 * up to `maxLines` lines starting at the declaration line.
 *
 * Heuristic, not AST-perfect: we slice from the symbol's declaration line
 * to whichever comes first — `maxLines` lines later, or the next sibling
 * symbol's declaration. Good enough for a "what does this do" glance.
 */
export function extractSymbolBody(
  src: string,
  declarationLine: number,
  nextSiblingLine: number | null,
  maxLines = 14,
): string[] {
  const lines = src.split("\n");
  if (declarationLine < 1 || declarationLine > lines.length) return [];
  const start = declarationLine - 1; // → 0-indexed
  const upperBound =
    nextSiblingLine != null && nextSiblingLine > declarationLine
      ? Math.min(lines.length, nextSiblingLine - 1)
      : lines.length;
  const end = Math.min(start + maxLines, upperBound);
  return lines.slice(start, end);
}
