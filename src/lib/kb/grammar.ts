import { readFile } from "node:fs/promises";
import path from "node:path";
import { Language, Parser } from "web-tree-sitter";
import type { FileKind } from "@/lib/repo-graph/types";

// WASM loading pattern proven by the M0 spike (/api/spike/parse):
// - grammars from @vscode/tree-sitter-wasm (tree-sitter-wasms ships
//   legacy-dylink wasm, incompatible with web-tree-sitter 0.26)
// - resolve from process.cwd()/node_modules — createRequire subpath
//   resolution fails under the package's exports map in the traced bundle
// - next.config.ts outputFileTracingIncludes ships the .wasm files

const WASM_DIR = path.join(
  process.cwd(),
  "node_modules",
  "@vscode",
  "tree-sitter-wasm",
  "wasm",
);

const GRAMMAR_BY_KIND: Partial<Record<FileKind, string>> = {
  ts: "tree-sitter-typescript.wasm",
  tsx: "tree-sitter-tsx.wasm",
  jsx: "tree-sitter-tsx.wasm", // tsx grammar is a superset, handles jsx fine
  js: "tree-sitter-javascript.wasm",
};

export const PARSEABLE_KINDS = new Set<FileKind>(["ts", "tsx", "js", "jsx"]);

// Cache across warm invocations: init once, one Language per grammar file,
// one Parser instance reused via setLanguage.
let initPromise: Promise<void> | null = null;
const languageCache = new Map<string, Promise<Language>>();
let parser: Parser | null = null;

async function loadLanguage(wasmFile: string): Promise<Language> {
  let cached = languageCache.get(wasmFile);
  if (!cached) {
    cached = readFile(path.join(WASM_DIR, wasmFile)).then((bytes) =>
      Language.load(new Uint8Array(bytes)),
    );
    languageCache.set(wasmFile, cached);
  }
  return cached;
}

/** Returns a ready-to-use parser for the file kind, or null if unparseable. */
export async function getParserFor(kind: FileKind): Promise<Parser | null> {
  const wasmFile = GRAMMAR_BY_KIND[kind];
  if (!wasmFile) return null;
  initPromise ??= Parser.init();
  await initPromise;
  const language = await loadLanguage(wasmFile);
  parser ??= new Parser();
  parser.setLanguage(language);
  return parser;
}
