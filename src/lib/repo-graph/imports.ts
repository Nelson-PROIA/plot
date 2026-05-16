import type { RepoGraphEdge, RepoFile } from "./types";

/**
 * One tsconfig.json's compiler-options view, scoped to its directory.
 * `baseDir` is the directory of the tsconfig (relative to repo root).
 * `baseUrl` is `compilerOptions.baseUrl` resolved relative to `baseDir`.
 * `paths` maps wildcard keys to target patterns.
 */
export type AliasScope = {
  baseDir: string;
  baseUrl: string;
  paths: Record<string, string[]>;
};

/** Strip // and /* * / comments so tsconfig JSON-with-comments parses cleanly. */
export function stripJsonComments(src: string): string {
  let out = "";
  let i = 0;
  let inString: '"' | "'" | null = null;
  while (i < src.length) {
    const c = src[i];
    const next = src[i + 1];
    if (inString) {
      if (c === "\\") {
        out += c + (next ?? "");
        i += 2;
        continue;
      }
      if (c === inString) inString = null;
      out += c;
      i++;
      continue;
    }
    if (c === '"' || c === "'") {
      inString = c as '"' | "'";
      out += c;
      i++;
      continue;
    }
    if (c === "/" && next === "/") {
      while (i < src.length && src[i] !== "\n") i++;
      continue;
    }
    if (c === "/" && next === "*") {
      i += 2;
      while (i < src.length && !(src[i] === "*" && src[i + 1] === "/")) i++;
      i += 2;
      continue;
    }
    out += c;
    i++;
  }
  return out;
}

export function parseTsconfigAliases(
  tsconfigPath: string,
  raw: string,
): AliasScope | null {
  try {
    const json = JSON.parse(stripJsonComments(raw)) as {
      compilerOptions?: { baseUrl?: string; paths?: Record<string, string[]> };
    };
    const co = json.compilerOptions ?? {};
    if (!co.paths || Object.keys(co.paths).length === 0) return null;
    const dir = tsconfigPath.includes("/")
      ? tsconfigPath.slice(0, tsconfigPath.lastIndexOf("/"))
      : "";
    const rawBase = co.baseUrl ?? ".";
    const baseUrl = normalizePath(joinPath(dir, rawBase));
    return { baseDir: dir, baseUrl, paths: co.paths };
  } catch {
    return null;
  }
}

function joinPath(a: string, b: string): string {
  if (!a) return b;
  if (!b || b === ".") return a;
  if (b.startsWith("/")) return b.replace(/^\/+/, "");
  return `${a}/${b}`;
}

function normalizePath(p: string): string {
  const parts = p.split("/");
  const stack: string[] = [];
  for (const part of parts) {
    if (!part || part === ".") continue;
    if (part === "..") stack.pop();
    else stack.push(part);
  }
  return stack.join("/");
}

/** Pick the most-specific alias scope whose baseDir is a prefix of fromFile. */
function scopeFor(
  fromFile: string,
  scopes: AliasScope[],
): AliasScope | null {
  let best: AliasScope | null = null;
  for (const s of scopes) {
    if (s.baseDir === "" || fromFile.startsWith(s.baseDir + "/")) {
      if (!best || s.baseDir.length > best.baseDir.length) best = s;
    }
  }
  return best;
}

/** Expand a path pattern like "@/*" -> ["src/*"] for a concrete spec. */
function expandAlias(
  spec: string,
  scope: AliasScope,
  files: Map<string, RepoFile>,
): string | null {
  for (const [pattern, targets] of Object.entries(scope.paths)) {
    const star = pattern.indexOf("*");
    if (star >= 0) {
      const head = pattern.slice(0, star);
      const tail = pattern.slice(star + 1);
      if (!spec.startsWith(head) || !spec.endsWith(tail)) continue;
      const captured = spec.slice(head.length, spec.length - tail.length);
      for (const target of targets) {
        const targetStar = target.indexOf("*");
        const candidateRel =
          targetStar >= 0
            ? target.slice(0, targetStar) +
              captured +
              target.slice(targetStar + 1)
            : target;
        const fullPath = normalizePath(joinPath(scope.baseUrl, candidateRel));
        const resolved = tryExtensions(fullPath, files);
        if (resolved) return resolved;
      }
    } else if (spec === pattern) {
      for (const target of targets) {
        const fullPath = normalizePath(joinPath(scope.baseUrl, target));
        const resolved = tryExtensions(fullPath, files);
        if (resolved) return resolved;
      }
    }
  }
  return null;
}

function tryExtensions(target: string, files: Map<string, RepoFile>): string | null {
  const candidates = [
    target,
    `${target}.ts`,
    `${target}.tsx`,
    `${target}.js`,
    `${target}.jsx`,
    `${target}.mjs`,
    `${target}.cjs`,
    `${target}/index.ts`,
    `${target}/index.tsx`,
    `${target}/index.js`,
    `${target}/index.jsx`,
  ];
  for (const c of candidates) if (files.has(c)) return c;
  return null;
}

const IMPORT_FROM_RX =
  /(?:^|\n|;)\s*(?:import|export)\s+(?:[\s\S]*?\sfrom\s+)?["']([^"'\n]+)["']/g;
const SIDE_IMPORT_RX = /(?:^|\n|;)\s*import\s+["']([^"'\n]+)["']/g;
const REQUIRE_RX = /\brequire\s*\(\s*["']([^"'\n]+)["']\s*\)/g;
const DYNAMIC_IMPORT_RX = /\bimport\s*\(\s*["']([^"'\n]+)["']\s*\)/g;

const HTML_SRC_RX = /<script\b[^>]*\bsrc\s*=\s*["']([^"'\s>]+)["']/gi;
const HTML_HREF_RX = /<link\b[^>]*\bhref\s*=\s*["']([^"'\s>]+)["']/gi;
const CSS_IMPORT_RX = /@import\s+(?:url\()?\s*["']([^"'\n]+)["']/g;

function collectMatches(re: RegExp, content: string): string[] {
  const out: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(content)) !== null) out.push(m[1]);
  return out;
}

/** Resolves a relative import specifier to an actual file id in `files`. */
function resolveRelative(
  fromFile: string,
  spec: string,
  files: Map<string, RepoFile>,
): string | null {
  if (!spec.startsWith(".") && !spec.startsWith("/")) return null;
  const fromDir =
    fromFile.includes("/") ? fromFile.slice(0, fromFile.lastIndexOf("/")) : "";
  const combined = spec.startsWith("/")
    ? spec.replace(/^\/+/, "")
    : `${fromDir}/${spec}`;
  const target = normalizePath(combined);
  return tryExtensions(target, files);
}

/** Try relative first, then path-alias resolution for bare specifiers. */
function resolveSpec(
  fromFile: string,
  spec: string,
  files: Map<string, RepoFile>,
  aliases: AliasScope[],
): string | null {
  const rel = resolveRelative(fromFile, spec, files);
  if (rel) return rel;
  if (spec.startsWith(".") || spec.startsWith("/")) return null;
  const scope = scopeFor(fromFile, aliases);
  if (!scope) return null;
  return expandAlias(spec, scope, files);
}

export type EdgeExtraction = {
  edges: RepoGraphEdge[];
};

/**
 * Parse imports/requires/html refs out of a single file's content and emit
 * edges to other files in the graph that they resolve to.
 */
export function extractEdgesFromFile(
  file: RepoFile,
  content: string,
  files: Map<string, RepoFile>,
  aliases: AliasScope[] = [],
): RepoGraphEdge[] {
  const edges: RepoGraphEdge[] = [];
  const seen = new Set<string>();
  const push = (
    targetId: string | null,
    kind: RepoGraphEdge["kind"],
  ) => {
    if (!targetId || targetId === file.path) return;
    const id = `${file.path}->${targetId}:${kind}`;
    if (seen.has(id)) return;
    seen.add(id);
    edges.push({ id, source: file.path, target: targetId, kind });
  };

  if (file.kind === "html") {
    for (const spec of collectMatches(HTML_SRC_RX, content)) {
      push(resolveRelative(file.path, spec, files), "html-script");
    }
    for (const spec of collectMatches(HTML_HREF_RX, content)) {
      push(resolveRelative(file.path, spec, files), "html-link");
    }
    return edges;
  }
  if (file.kind === "css") {
    for (const spec of collectMatches(CSS_IMPORT_RX, content)) {
      push(resolveRelative(file.path, spec, files), "css-import");
    }
    return edges;
  }
  // JS/TS family
  const reFamily: Array<{ rx: RegExp; kind: RepoGraphEdge["kind"] }> = [
    { rx: IMPORT_FROM_RX, kind: "import" },
    { rx: SIDE_IMPORT_RX, kind: "import" },
    { rx: DYNAMIC_IMPORT_RX, kind: "import" },
    { rx: REQUIRE_RX, kind: "require" },
  ];
  for (const { rx, kind } of reFamily) {
    rx.lastIndex = 0;
    for (const spec of collectMatches(rx, content)) {
      push(resolveSpec(file.path, spec, files, aliases), kind);
    }
  }
  return edges;
}
