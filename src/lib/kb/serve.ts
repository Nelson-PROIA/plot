import { and, desc, eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { edges, files, repos, snapshots, symbols } from "@/lib/db/schema";
import {
  groupOf,
  type FileKind,
  type RepoFile,
  type RepoGraph,
  type RepoGraphEdge,
  type RepoSymbol,
  type SymbolCallEdge,
  type SymbolKind,
} from "@/lib/repo-graph/types";

// Snapshot → RepoGraph payload projection. The shape is the compat contract
// with RepoGraphView (see MVP_PLAN §4): symbol.id === stableKey (path::name),
// file-edge endpoints are paths, call-edge endpoints are stableKeys.

const SYMBOL_KINDS = new Set<string>([
  "function",
  "component",
  "class",
  "interface",
  "type",
  "enum",
  "const",
  "default",
]);

/** Same heuristic as lib/repo-graph/symbols.ts — payload-only kinds. */
function classify(kind: string, name: string, fileKind: FileKind): SymbolKind {
  let k: SymbolKind = SYMBOL_KINDS.has(kind) ? (kind as SymbolKind) : "const";
  if (k === "function" || k === "const" || k === "default") {
    if ((fileKind === "tsx" || fileKind === "jsx") && /^[A-Z]/.test(name)) {
      k = "component";
    }
  }
  return k;
}

export type ServedGraph = RepoGraph & {
  /** Additive (frontend ignores unknown fields): proves Postgres serving. */
  stats: {
    snapshotSha: string;
    snapshotId: number;
    files: number;
    symbols: number;
    importEdges: number;
    callEdges: number;
  };
};

export async function serveGraph(
  owner: string,
  repo: string,
): Promise<ServedGraph | null> {
  const db = getDb();

  const repoRows = await db
    .select({ id: repos.id, name: repos.name, defaultBranch: repos.defaultBranch })
    .from(repos)
    .where(and(eq(repos.owner, owner), eq(repos.name, repo)));
  if (repoRows.length === 0) return null;
  const repoRow = repoRows[0];

  const snapRows = await db
    .select({
      id: snapshots.id,
      commitSha: snapshots.commitSha,
      indexedAt: snapshots.indexedAt,
    })
    .from(snapshots)
    .where(and(eq(snapshots.repoId, repoRow.id), eq(snapshots.status, "ready")))
    .orderBy(desc(snapshots.indexedAt))
    .limit(1);
  if (snapRows.length === 0) return null;
  const snap = snapRows[0];

  const [fileRows, symbolRows, edgeRows] = await Promise.all([
    db
      .select({
        id: files.id,
        path: files.path,
        lang: files.lang,
        size: files.size,
        hash: files.hash,
      })
      .from(files)
      .where(eq(files.snapshotId, snap.id))
      .orderBy(files.id),
    db
      .select({
        id: symbols.id,
        fileId: symbols.fileId,
        name: symbols.name,
        kind: symbols.kind,
        startLine: symbols.startLine,
        signature: symbols.signature,
        exported: symbols.exported,
        stableKey: symbols.stableKey,
      })
      .from(symbols)
      .where(eq(symbols.snapshotId, snap.id)),
    db
      .select({
        srcFileId: edges.srcFileId,
        dstFileId: edges.dstFileId,
        srcSymbolId: edges.srcSymbolId,
        dstSymbolId: edges.dstSymbolId,
        kind: edges.kind,
      })
      .from(edges)
      .where(eq(edges.snapshotId, snap.id)),
  ]);

  const fileById = new Map<number, { path: string; kind: FileKind }>();
  const payloadFiles: RepoFile[] = [];
  const groups: string[] = [];
  const seenGroups = new Set<string>();
  for (const f of fileRows) {
    const kind = (f.lang ?? "other") as FileKind;
    const group = groupOf(f.path);
    if (!seenGroups.has(group)) {
      seenGroups.add(group);
      groups.push(group);
    }
    fileById.set(f.id, { path: f.path, kind });
    payloadFiles.push({
      path: f.path,
      sha: f.hash ?? "",
      size: f.size ?? 0,
      kind,
      group,
    });
  }

  const symbolKeyById = new Map<number, string>();
  const payloadSymbols: RepoSymbol[] = [];
  for (const s of symbolRows) {
    const file = fileById.get(s.fileId);
    if (!file) continue;
    symbolKeyById.set(s.id, s.stableKey);
    payloadSymbols.push({
      id: s.stableKey,
      file: file.path,
      name: s.name,
      kind: classify(s.kind, s.name, file.kind),
      line: s.startLine,
      params: s.signature ?? undefined,
      exported: s.exported,
    });
  }

  const payloadEdges: RepoGraphEdge[] = [];
  const callEdges: SymbolCallEdge[] = [];
  for (const e of edgeRows) {
    if (e.kind === "import" && e.srcFileId && e.dstFileId) {
      const src = fileById.get(e.srcFileId)?.path;
      const dst = fileById.get(e.dstFileId)?.path;
      if (!src || !dst) continue;
      payloadEdges.push({
        id: `${src}->${dst}:import`,
        source: src,
        target: dst,
        kind: "import",
      });
    } else if (e.kind === "call" && e.srcSymbolId && e.dstSymbolId) {
      const src = symbolKeyById.get(e.srcSymbolId);
      const dst = symbolKeyById.get(e.dstSymbolId);
      if (!src || !dst) continue;
      callEdges.push({ id: `call:${src}->${dst}`, source: src, target: dst });
    }
  }

  return {
    rootName: repoRow.name,
    defaultBranch: repoRow.defaultBranch,
    fetchedAt: snap.indexedAt ? snap.indexedAt.getTime() : Date.now(),
    files: payloadFiles,
    groups,
    edges: payloadEdges,
    symbols: payloadSymbols,
    callEdges,
    stats: {
      snapshotSha: snap.commitSha,
      snapshotId: snap.id,
      files: payloadFiles.length,
      symbols: payloadSymbols.length,
      importEdges: payloadEdges.length,
      callEdges: callEdges.length,
    },
  };
}
