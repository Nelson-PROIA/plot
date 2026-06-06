import { and, desc, eq, ne } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { edges, files, repos, snapshots, symbols } from "@/lib/db/schema";
import {
  extToKind,
  groupOf,
  shouldInclude,
  type FileKind,
  type RepoFile,
} from "@/lib/repo-graph/types";
import {
  parseTsconfigAliases,
  resolveSpec,
  type AliasScope,
} from "@/lib/repo-graph/imports";
import { downloadTarball, fetchRepoMeta, resolveCommitSha } from "./github";
import { getParserFor, PARSEABLE_KINDS } from "./grammar";
import { parseFile, type ParsedFile } from "./parse";

// M1 indexer: tarball → tree-sitter → Postgres snapshot keyed by commit SHA.
//
// neon-http has no transactions. Idempotency model: a snapshot that isn't
// `ready` is wiped and rebuilt on the next index call; readers only ever see
// `ready` snapshots. Incremental: files whose hash matches the previous ready
// snapshot are copied row-wise instead of re-parsed.

const MAX_FILES = 3000;
const MAX_PARSE_BYTES = 512 * 1024;
const INSERT_BATCH = 300;

const TEST_PATH_RX = /(\.(test|spec)\.[tj]sx?$|(^|\/)__(tests|mocks)__\/)/;

export type IndexOptions = {
  owner: string;
  repo: string;
  ref?: string;
  /** Optional path prefix to scope indexing (e.g. "packages/zod"). */
  scope?: string;
  force?: boolean;
};

export type IndexResult = {
  snapshotId: number;
  commitSha: string;
  status: "ready" | "reused";
  stats: {
    files: number;
    symbols: number;
    importEdges: number;
    callEdges: number;
    parsedFiles: number;
    copiedFiles: number;
    droppedFiles: number;
  };
};

type KbFile = {
  path: string;
  kind: FileKind;
  size: number;
  hash: string;
  content: Buffer;
};

function chunk<T>(arr: T[], n: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n));
  return out;
}

export async function indexRepo(opts: IndexOptions): Promise<IndexResult> {
  const db = getDb();
  const meta = await fetchRepoMeta(opts.owner, opts.repo);
  const ref = opts.ref ?? meta.defaultBranch;
  const commitSha = await resolveCommitSha(opts.owner, opts.repo, ref);

  // repo + snapshot rows (idempotency anchors)
  const [repoRow] = await db
    .insert(repos)
    .values({ owner: opts.owner, name: meta.name, defaultBranch: meta.defaultBranch })
    .onConflictDoUpdate({
      target: [repos.owner, repos.name],
      set: { defaultBranch: meta.defaultBranch },
    })
    .returning({ id: repos.id });

  const existing = await db
    .select({ id: snapshots.id, status: snapshots.status })
    .from(snapshots)
    .where(and(eq(snapshots.repoId, repoRow.id), eq(snapshots.commitSha, commitSha)));

  let snapshotId: number;
  if (existing.length > 0) {
    if (existing[0].status === "ready" && !opts.force) {
      const stats = await snapshotStats(existing[0].id);
      return { snapshotId: existing[0].id, commitSha, status: "reused", stats };
    }
    snapshotId = existing[0].id;
    // wipe partial/forced snapshot: files cascade symbols; edges explicit
    await db.delete(edges).where(eq(edges.snapshotId, snapshotId));
    await db.delete(files).where(eq(files.snapshotId, snapshotId));
    await db
      .update(snapshots)
      .set({ status: "indexing", indexedAt: null, fileCount: null })
      .where(eq(snapshots.id, snapshotId));
  } else {
    const [row] = await db
      .insert(snapshots)
      .values({ repoId: repoRow.id, commitSha, status: "indexing" })
      .returning({ id: snapshots.id });
    snapshotId = row.id;
  }

  try {
    const result = await buildSnapshot({
      db,
      repoId: repoRow.id,
      snapshotId,
      commitSha,
      opts,
    });
    return result;
  } catch (err) {
    await db
      .update(snapshots)
      .set({ status: "failed" })
      .where(eq(snapshots.id, snapshotId))
      .catch(() => {});
    throw err;
  }
}

async function buildSnapshot(ctx: {
  db: ReturnType<typeof getDb>;
  repoId: number;
  snapshotId: number;
  commitSha: string;
  opts: IndexOptions;
}): Promise<IndexResult> {
  const { db, repoId, snapshotId, commitSha, opts } = ctx;

  // ---- fetch + filter ----------------------------------------------------
  const entries = await downloadTarball(opts.owner, opts.repo, commitSha);

  // tsconfig aliases come from the WHOLE tarball (a scope filter must not
  // hide the root tsconfig that defines the aliases)
  const aliases: AliasScope[] = [];
  for (const e of entries) {
    if (e.path === "tsconfig.json" || e.path.endsWith("/tsconfig.json")) {
      const scope = parseTsconfigAliases(e.path, e.content.toString("utf8"));
      if (scope) aliases.push(scope);
    }
  }

  let dropped = 0;
  const kbFiles: KbFile[] = [];
  for (const e of entries) {
    if (opts.scope && !e.path.startsWith(opts.scope.replace(/\/$/, "") + "/")) continue;
    if (!shouldInclude(e.path) || TEST_PATH_RX.test(e.path)) continue;
    if (kbFiles.length >= MAX_FILES) {
      dropped++;
      continue;
    }
    kbFiles.push({
      path: e.path,
      kind: extToKind(e.path),
      size: e.content.length,
      hash: e.hash,
      content: e.content,
    });
  }

  await db
    .update(snapshots)
    .set({ fileCount: kbFiles.length })
    .where(eq(snapshots.id, snapshotId));

  // ---- incremental partition ----------------------------------------------
  const prev = await db
    .select({ id: snapshots.id })
    .from(snapshots)
    .where(
      and(
        eq(snapshots.repoId, repoId),
        eq(snapshots.status, "ready"),
        ne(snapshots.id, snapshotId),
      ),
    )
    .orderBy(desc(snapshots.indexedAt))
    .limit(1);

  const prevFilesByPath = new Map<string, { id: number; hash: string | null }>();
  if (prev.length > 0) {
    const prevFiles = await db
      .select({ id: files.id, path: files.path, hash: files.hash })
      .from(files)
      .where(eq(files.snapshotId, prev[0].id));
    for (const f of prevFiles) prevFilesByPath.set(f.path, f);
  }

  const unchanged: KbFile[] = [];
  const toParse: KbFile[] = [];
  for (const f of kbFiles) {
    const prevFile = prevFilesByPath.get(f.path);
    if (prevFile && prevFile.hash === f.hash) unchanged.push(f);
    else toParse.push(f);
  }

  // ---- write files (before parsing: the rows are the progress counter) -----
  const pathToFileId = new Map<string, number>();
  for (const batch of chunk(kbFiles, INSERT_BATCH)) {
    const rows = await db
      .insert(files)
      .values(
        batch.map((f) => ({
          snapshotId,
          path: f.path,
          lang: f.kind,
          size: f.size,
          hash: f.hash,
        })),
      )
      .returning({ id: files.id, path: files.path });
    for (const r of rows) pathToFileId.set(r.path, r.id);
  }

  // ---- parse (changed/new parseable files only) ----------------------------
  const parsedByPath = new Map<string, ParsedFile>();
  for (const f of toParse) {
    if (!PARSEABLE_KINDS.has(f.kind) || f.size > MAX_PARSE_BYTES) continue;
    const parser = await getParserFor(f.kind);
    if (!parser) continue;
    const parsed = parseFile(parser, f.path, f.content.toString("utf8"));
    if (parsed) parsedByPath.set(f.path, parsed);
  }

  // ---- write symbols (copied + fresh) ---------------------------------------
  type SymbolRow = {
    snapshotId: number;
    fileId: number;
    name: string;
    kind: string;
    startLine: number;
    endLine: number;
    signature: string | null;
    exported: boolean;
    stableKey: string;
  };
  const symbolRows: SymbolRow[] = [];

  // copied: previous snapshot's symbols for unchanged files
  const prevSymbolKeyById = new Map<number, string>(); // all prev symbols, for edge remap
  if (prev.length > 0) {
    const prevSymbols = await db
      .select({
        id: symbols.id,
        fileId: symbols.fileId,
        name: symbols.name,
        kind: symbols.kind,
        startLine: symbols.startLine,
        endLine: symbols.endLine,
        signature: symbols.signature,
        exported: symbols.exported,
        stableKey: symbols.stableKey,
      })
      .from(symbols)
      .where(eq(symbols.snapshotId, prev[0].id));

    const unchangedPrevFileIds = new Map<number, string>(); // prev fileId → path
    for (const f of unchanged) {
      const prevFile = prevFilesByPath.get(f.path);
      if (prevFile) unchangedPrevFileIds.set(prevFile.id, f.path);
    }
    for (const s of prevSymbols) {
      prevSymbolKeyById.set(s.id, s.stableKey);
      const path = unchangedPrevFileIds.get(s.fileId);
      if (!path) continue;
      const newFileId = pathToFileId.get(path);
      if (!newFileId) continue;
      symbolRows.push({
        snapshotId,
        fileId: newFileId,
        name: s.name,
        kind: s.kind,
        startLine: s.startLine,
        endLine: s.endLine,
        signature: s.signature,
        exported: s.exported,
        stableKey: s.stableKey,
      });
    }
  }

  // fresh: parsed symbols
  for (const [path, parsed] of parsedByPath) {
    const fileId = pathToFileId.get(path);
    if (!fileId) continue;
    for (const s of parsed.symbols) {
      symbolRows.push({
        snapshotId,
        fileId,
        name: s.name,
        kind: s.kind,
        startLine: s.startLine,
        endLine: s.endLine,
        signature: s.signature,
        exported: s.exported,
        stableKey: s.stableKey,
      });
    }
  }

  const keyToSymbolId = new Map<string, number>();
  for (const batch of chunk(symbolRows, INSERT_BATCH)) {
    const rows = await db
      .insert(symbols)
      .values(batch)
      .returning({ id: symbols.id, stableKey: symbols.stableKey });
    for (const r of rows) keyToSymbolId.set(r.stableKey, r.id);
  }

  // ---- edges -----------------------------------------------------------------
  // Strict builders: exactly one endpoint type per side, per the DB CHECKs.
  type EdgeRow = {
    snapshotId: number;
    srcFileId?: number;
    dstFileId?: number;
    srcSymbolId?: number;
    dstSymbolId?: number;
    kind: string;
  };
  const edgeRows: EdgeRow[] = [];
  const seenEdge = new Set<string>();

  const pushFileEdge = (srcPath: string, dstPath: string) => {
    if (srcPath === dstPath) return;
    const key = `${srcPath}->${dstPath}:import`;
    if (seenEdge.has(key)) return;
    const srcFileId = pathToFileId.get(srcPath);
    const dstFileId = pathToFileId.get(dstPath);
    if (!srcFileId || !dstFileId) return;
    seenEdge.add(key);
    edgeRows.push({ snapshotId, srcFileId, dstFileId, kind: "import" });
  };

  const pushCallEdge = (srcKey: string, dstKey: string) => {
    if (srcKey === dstKey) return;
    const key = `call:${srcKey}->${dstKey}`;
    if (seenEdge.has(key)) return;
    const srcSymbolId = keyToSymbolId.get(srcKey);
    const dstSymbolId = keyToSymbolId.get(dstKey);
    if (!srcSymbolId || !dstSymbolId) return;
    seenEdge.add(key);
    edgeRows.push({ snapshotId, srcSymbolId, dstSymbolId, kind: "call" });
  };

  // file map for the ported resolver (only `has`-membership is consulted)
  const fileMap = new Map<string, RepoFile>(
    kbFiles.map((f) => [
      f.path,
      { path: f.path, sha: f.hash, size: f.size, kind: f.kind, group: groupOf(f.path) },
    ]),
  );

  // copied edges: previous rows whose source lives in an unchanged file
  if (prev.length > 0) {
    const prevFilePathById = new Map<number, string>();
    for (const [path, f] of prevFilesByPath) prevFilePathById.set(f.id, path);
    const unchangedPaths = new Set(unchanged.map((f) => f.path));

    const prevEdges = await db
      .select({
        srcFileId: edges.srcFileId,
        dstFileId: edges.dstFileId,
        srcSymbolId: edges.srcSymbolId,
        dstSymbolId: edges.dstSymbolId,
        kind: edges.kind,
      })
      .from(edges)
      .where(eq(edges.snapshotId, prev[0].id));

    for (const e of prevEdges) {
      if (e.kind === "import" && e.srcFileId && e.dstFileId) {
        const srcPath = prevFilePathById.get(e.srcFileId);
        const dstPath = prevFilePathById.get(e.dstFileId);
        if (!srcPath || !dstPath || !unchangedPaths.has(srcPath)) continue;
        if (!pathToFileId.has(dstPath)) continue; // dst deleted this commit
        pushFileEdge(srcPath, dstPath);
      } else if (e.kind === "call" && e.srcSymbolId && e.dstSymbolId) {
        const srcKey = prevSymbolKeyById.get(e.srcSymbolId);
        const dstKey = prevSymbolKeyById.get(e.dstSymbolId);
        if (!srcKey || !dstKey) continue;
        const srcPath = srcKey.slice(0, srcKey.lastIndexOf("::"));
        if (!unchangedPaths.has(srcPath)) continue;
        pushCallEdge(srcKey, dstKey); // no-ops if dst key gone this commit
      }
    }
  }

  // fresh edges from parsed files
  for (const [path, parsed] of parsedByPath) {
    // file → file imports
    for (const spec of parsed.specifiers) {
      const target = resolveSpec(path, spec, fileMap, aliases);
      if (target) pushFileEdge(path, target);
    }

    // symbol → symbol calls
    const ownByName = new Map(parsed.symbols.map((s) => [s.name, s.stableKey]));
    const importTargets = new Map<string, string>(); // localName → stableKey
    for (const b of parsed.bindings) {
      const targetFile = resolveSpec(path, b.specifier, fileMap, aliases);
      if (!targetFile) continue;
      const key = `${targetFile}::${b.importedName}`;
      if (keyToSymbolId.has(key)) importTargets.set(b.localName, key);
    }
    const nsTargets = new Map<string, string>(); // localName → target file path
    for (const ns of parsed.namespaces) {
      const targetFile = resolveSpec(path, ns.specifier, fileMap, aliases);
      if (targetFile) nsTargets.set(ns.localName, targetFile);
    }

    for (const call of parsed.calls) {
      if (call.calleeName) {
        const dst =
          importTargets.get(call.calleeName) ?? ownByName.get(call.calleeName);
        if (dst) pushCallEdge(call.fromKey, dst);
      } else if (call.namespaceObject && call.namespaceProperty) {
        const nsFile = nsTargets.get(call.namespaceObject);
        if (nsFile) pushCallEdge(call.fromKey, `${nsFile}::${call.namespaceProperty}`);
      }
    }
  }

  for (const batch of chunk(edgeRows, INSERT_BATCH)) {
    await db.insert(edges).values(batch);
  }

  // ---- finalize ----------------------------------------------------------------
  await db
    .update(snapshots)
    .set({ status: "ready", indexedAt: new Date(), fileCount: kbFiles.length })
    .where(eq(snapshots.id, snapshotId));

  const importEdges = edgeRows.filter((e) => e.kind === "import").length;
  return {
    snapshotId,
    commitSha,
    status: "ready",
    stats: {
      files: kbFiles.length,
      symbols: symbolRows.length,
      importEdges,
      callEdges: edgeRows.length - importEdges,
      parsedFiles: parsedByPath.size,
      copiedFiles: unchanged.length,
      droppedFiles: dropped,
    },
  };
}

async function snapshotStats(snapshotId: number) {
  const db = getDb();
  const [fileRows, symbolRows, edgeRows] = await Promise.all([
    db.select({ id: files.id }).from(files).where(eq(files.snapshotId, snapshotId)),
    db.select({ id: symbols.id }).from(symbols).where(eq(symbols.snapshotId, snapshotId)),
    db.select({ kind: edges.kind }).from(edges).where(eq(edges.snapshotId, snapshotId)),
  ]);
  const importEdges = edgeRows.filter((e) => e.kind === "import").length;
  return {
    files: fileRows.length,
    symbols: symbolRows.length,
    importEdges,
    callEdges: edgeRows.length - importEdges,
    parsedFiles: 0,
    copiedFiles: fileRows.length,
    droppedFiles: 0,
  };
}
