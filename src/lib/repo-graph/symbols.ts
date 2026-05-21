import type {
  RepoFile,
  RepoSymbol,
  SymbolCallEdge,
  SymbolKind,
} from "./types";

/**
 * Tag a const-arrow export as a component when its name starts uppercase and
 * lives in a JSX-eligible file. Heuristic, not AST-perfect, but it does the
 * job for graph clustering.
 */
function classify(
  kind: SymbolKind,
  name: string,
  fileKind: RepoFile["kind"],
): SymbolKind {
  if (kind === "function" || kind === "const" || kind === "default") {
    if ((fileKind === "tsx" || fileKind === "jsx") && /^[A-Z]/.test(name)) {
      return "component";
    }
  }
  return kind;
}

function lineOfIndex(src: string, idx: number): number {
  let line = 1;
  for (let i = 0; i < idx && i < src.length; i++) {
    if (src[i] === "\n") line++;
  }
  return line;
}

/**
 * Extract exported symbols from a single TypeScript/JavaScript file.
 *
 * Regex-based and intentionally lenient — we'd rather over-include than miss
 * a top-level export. Each match records the source line so we can later
 * approximate "which symbol contains this call?".
 */
export function extractSymbols(file: RepoFile, src: string): RepoSymbol[] {
  if (
    file.kind !== "ts" &&
    file.kind !== "tsx" &&
    file.kind !== "js" &&
    file.kind !== "jsx"
  ) {
    return [];
  }

  const out: RepoSymbol[] = [];
  const seen = new Set<string>();

  const push = (
    rawKind: SymbolKind,
    name: string,
    line: number,
    params?: string,
  ) => {
    const kind = classify(rawKind, name, file.kind);
    const id = `${file.path}::${name}`;
    if (seen.has(id)) return;
    seen.add(id);
    out.push({
      id,
      file: file.path,
      name,
      kind,
      line,
      params,
      exported: true,
    });
  };

  // export function foo(args) — capture line
  for (const m of src.matchAll(
    /^export\s+(?:async\s+)?function\s+(\w+)\s*\(([^)]*)\)/gm,
  )) {
    push("function", m[1], lineOfIndex(src, m.index ?? 0), m[2].trim());
  }
  // export default function [foo](args)
  for (const m of src.matchAll(
    /^export\s+default\s+(?:async\s+)?function\s+(\w+)?\s*\(([^)]*)\)/gm,
  )) {
    push(
      "default",
      m[1] ?? "default",
      lineOfIndex(src, m.index ?? 0),
      m[2].trim(),
    );
  }
  // export const foo = (args) =>
  for (const m of src.matchAll(
    /^export\s+(?:const|let|var)\s+(\w+)\s*(?::\s*[^=]+)?\s*=\s*(?:async\s*)?\(([^)]*)\)\s*(?:=>|:)/gm,
  )) {
    push("function", m[1], lineOfIndex(src, m.index ?? 0), m[2].trim());
  }
  // export const foo = <non-paren> (object/value/etc.) — falls back to "const"
  for (const m of src.matchAll(
    /^export\s+(?:const|let|var)\s+(\w+)\s*=\s*[^(]/gm,
  )) {
    push("const", m[1], lineOfIndex(src, m.index ?? 0));
  }
  // export class/interface/type/enum X
  for (const m of src.matchAll(
    /^export\s+(class|interface|type|enum)\s+(\w+)/gm,
  )) {
    push(
      m[1] as SymbolKind,
      m[2],
      lineOfIndex(src, m.index ?? 0),
    );
  }

  out.sort((a, b) => a.line - b.line);
  return out;
}

/**
 * One file's view of where each imported identifier resolves to.
 * Filled in during edge extraction (we already resolve specifiers there).
 */
export type FileImportBinding = {
  localName: string;
  /** Resolved source file path. */
  fromFile: string;
  /** Original exported name (handles `import { foo as bar }`). */
  importedName: string;
};

const NAMED_IMPORTS_RX =
  /^\s*import\s+(?:type\s+)?\{([^}]+)\}\s+from\s+["']([^"'\n]+)["']/gm;
const DEFAULT_IMPORT_RX =
  /^\s*import\s+(?:type\s+)?(\w+)\s*(?:,\s*\{[^}]*\})?\s+from\s+["']([^"'\n]+)["']/gm;

/**
 * Extract named + default imports from a file, paired with the raw specifier.
 * Caller resolves the specifier to an actual file path via the existing
 * alias-aware resolver in `imports.ts`.
 */
export function parseImportBindings(src: string): Array<{
  localName: string;
  importedName: string;
  specifier: string;
}> {
  const out: Array<{
    localName: string;
    importedName: string;
    specifier: string;
  }> = [];
  for (const m of src.matchAll(NAMED_IMPORTS_RX)) {
    const list = m[1];
    const spec = m[2];
    for (const piece of list.split(",")) {
      const trimmed = piece.trim();
      if (!trimmed) continue;
      // `foo as bar` or `foo`
      const asMatch = trimmed.match(/^(\w+)(?:\s+as\s+(\w+))?$/);
      if (!asMatch) continue;
      out.push({
        importedName: asMatch[1],
        localName: asMatch[2] ?? asMatch[1],
        specifier: spec,
      });
    }
  }
  for (const m of src.matchAll(DEFAULT_IMPORT_RX)) {
    out.push({
      importedName: "default",
      localName: m[1],
      specifier: m[2],
    });
  }
  return out;
}

/**
 * Approximate symbol-scope = the source-line range from its declaration line
 * to (next symbol's line - 1), or end-of-file. Imperfect for nested closures
 * but works for top-level analysis which is what the canvas surfaces.
 */
function scopeBounds(
  fileSymbols: RepoSymbol[],
  totalLines: number,
): Array<{ symbol: RepoSymbol; start: number; end: number }> {
  return fileSymbols.map((sym, i) => ({
    symbol: sym,
    start: sym.line,
    end: i + 1 < fileSymbols.length ? fileSymbols[i + 1].line - 1 : totalLines,
  }));
}

/**
 * Detect call edges from `file`'s symbols → other symbols, using:
 *   1. imported identifiers resolved to (file, name) pairs by the caller
 *   2. local identifiers matching this file's own symbol names
 *
 * For each occurrence of a known identifier, we find which symbol-scope it
 * falls into in `file`, and emit `that symbol → target symbol`.
 */
export function extractCallEdges(
  file: RepoFile,
  src: string,
  fileSymbols: RepoSymbol[],
  resolvedImports: Array<{
    localName: string;
    target: RepoSymbol;
  }>,
): SymbolCallEdge[] {
  if (fileSymbols.length === 0) return [];
  const totalLines = src.split("\n").length;
  // Only function-like exports own a scope. Value `const` exports
  // (e.g. `export const runtime = "nodejs"`) would otherwise swallow every
  // call between their declaration and the next real function as their own.
  const scopeOwners = fileSymbols.filter(
    (s) =>
      s.kind === "function" ||
      s.kind === "component" ||
      s.kind === "default" ||
      s.kind === "class",
  );
  const scopes = scopeBounds(scopeOwners, totalLines);
  if (scopes.length === 0) return [];

  // Local symbols can also be called from each other within the file.
  const localTargets = fileSymbols.map((s) => ({
    localName: s.name,
    target: s,
  }));

  const targets = [...resolvedImports, ...localTargets];
  if (targets.length === 0) return [];

  // Build a single regex matching any target name as a whole identifier.
  const names = Array.from(new Set(targets.map((t) => t.localName))).filter(
    (n) => /^[A-Za-z_$][\w$]*$/.test(n),
  );
  if (names.length === 0) return [];
  const nameToTargets = new Map<string, RepoSymbol[]>();
  for (const t of targets) {
    const arr = nameToTargets.get(t.localName) ?? [];
    arr.push(t.target);
    nameToTargets.set(t.localName, arr);
  }

  // Whole-word search across the file.
  const big = new RegExp(`\\b(${names.map(escape).join("|")})\\b`, "g");
  const edges: SymbolCallEdge[] = [];
  const seen = new Set<string>();

  let m: RegExpExecArray | null;
  while ((m = big.exec(src)) !== null) {
    const name = m[1];
    const line = lineOfIndex(src, m.index);
    const scope = scopes.find((s) => line >= s.start && line <= s.end);
    if (!scope) continue;
    const possibleTargets = nameToTargets.get(name);
    if (!possibleTargets) continue;
    for (const target of possibleTargets) {
      if (target.id === scope.symbol.id) continue; // self-reference
      const id = `call:${scope.symbol.id}->${target.id}`;
      if (seen.has(id)) continue;
      // Skip the declaration line itself — that's the symbol naming itself.
      if (line === scope.symbol.line && name === scope.symbol.name) continue;
      seen.add(id);
      edges.push({ id, source: scope.symbol.id, target: target.id });
    }
  }

  return edges;
}

function escape(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
