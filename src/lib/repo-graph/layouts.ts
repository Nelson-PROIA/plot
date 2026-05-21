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
