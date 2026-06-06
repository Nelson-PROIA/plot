import { NextResponse } from "next/server";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";
import { Language, Parser } from "web-tree-sitter";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// M0 spike (go/no-go): prove web-tree-sitter parses TypeScript inside a
// route handler on Vercel. Throwaway — delete when the M1 indexer lands.

const SAMPLE_TS = `
import { neon } from "@neondatabase/serverless";
import type { RepoGraph } from "./types";

export interface Snapshot {
  id: number;
  commitSha: string;
}

const cache = new Map<string, Snapshot>();

export function snapshotKey(repoId: number, sha: string): string {
  return repoId + "::" + sha;
}

export async function loadSnapshot(repoId: number, sha: string) {
  const key = snapshotKey(repoId, sha);
  if (cache.has(key)) return cache.get(key);
  const sql = neon(process.env.DATABASE_URL!);
  const rows = await sql\`select id, commit_sha from snapshots\`;
  return rows[0];
}

export class Indexer {
  constructor(private graph: RepoGraph) {}
  run(): number {
    return this.graph.nodes.length;
  }
}
`;

// Grammar .wasm candidates — record which one works, M1 will rely on it.
async function loadGrammarBytes(): Promise<{
  bytes: Uint8Array;
  via: string;
  wasmPath: string;
}> {
  const candidates: Array<{ wasmPath: string; via: string }> = [];
  try {
    const require_ = createRequire(import.meta.url);
    const pkgJson = require_.resolve("@vscode/tree-sitter-wasm/package.json");
    candidates.push({
      wasmPath: path.join(
        path.dirname(pkgJson),
        "wasm",
        "tree-sitter-typescript.wasm",
      ),
      via: "createRequire",
    });
  } catch {
    // resolution can fail in the traced bundle; cwd fallback below
  }
  candidates.push({
    wasmPath: path.join(
      process.cwd(),
      "node_modules",
      "@vscode",
      "tree-sitter-wasm",
      "wasm",
      "tree-sitter-typescript.wasm",
    ),
    via: "cwd",
  });

  const failures: string[] = [];
  for (const c of candidates) {
    try {
      const bytes = await readFile(c.wasmPath);
      return { bytes, ...c };
    } catch (err) {
      failures.push(
        `${c.via}: ${c.wasmPath}: ${err instanceof Error ? err.message : err}`,
      );
    }
  }
  throw new Error(`grammar wasm not found:\n${failures.join("\n")}`);
}

export async function GET() {
  const t0 = Date.now();
  try {
    await Parser.init();
    const tInit = Date.now();

    const grammar = await loadGrammarBytes();
    const language = await Language.load(grammar.bytes);
    const tGrammar = Date.now();

    const parser = new Parser();
    parser.setLanguage(language);
    const tree = parser.parse(SAMPLE_TS);
    const tParse = Date.now();
    if (!tree) throw new Error("parser.parse returned null");

    const root = tree.rootNode;
    const topLevel = root.namedChildren
      .filter((n) => n !== null)
      .map((n) => {
        // unwrap `export const/function/class ...`
        const decl =
          n.type === "export_statement"
            ? (n.childForFieldName("declaration") ?? n)
            : n;
        return {
          type: decl.type,
          name: decl.childForFieldName("name")?.text ?? null,
          line: n.startPosition.row + 1,
          exported: n.type === "export_statement",
        };
      });

    return NextResponse.json({
      ok: true,
      verdict: "web-tree-sitter parsed TypeScript in this route handler",
      grammar: { via: grammar.via, path: grammar.wasmPath },
      parse: {
        rootType: root.type,
        nodeCount: root.descendantCount,
        hasError: root.hasError,
        topLevel,
      },
      timingsMs: {
        init: tInit - t0,
        grammarLoad: tGrammar - tInit,
        parse: tParse - tGrammar,
        total: tParse - t0,
      },
      env: {
        node: process.version,
        platform: process.platform,
        region: process.env.VERCEL_REGION ?? "local",
      },
    });
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        error: err instanceof Error ? (err.stack ?? err.message) : String(err),
      },
      { status: 500 },
    );
  }
}
