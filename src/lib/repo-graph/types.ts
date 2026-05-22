export type FileKind =
  | "ts"
  | "tsx"
  | "js"
  | "jsx"
  | "json"
  | "html"
  | "css"
  | "md"
  | "yml"
  | "prisma"
  | "sh"
  | "other";

export type RepoFile = {
  path: string;
  sha: string;
  size: number;
  kind: FileKind;
  /** Top-level directory the file belongs to (or "root"). */
  group: string;
};

export type RepoGraphEdge = {
  id: string;
  source: string;
  target: string;
  kind: "import" | "require" | "html-script" | "html-link" | "css-import";
};

export type SymbolKind =
  | "function"
  | "component"
  | "class"
  | "interface"
  | "type"
  | "enum"
  | "const"
  | "default";

/**
 * A top-level export from a file — function, React component, class, type, etc.
 * Stable ID is `<file path>::<name>` (one file can only have one export with a
 * given name, with the exception of `default` which we surface as "default").
 */
export type RepoSymbol = {
  id: string;
  file: string;
  name: string;
  kind: SymbolKind;
  /** 1-indexed source line of the declaration. Used to slice symbol scopes. */
  line: number;
  /** Parameter list as it appears in source, when applicable. */
  params?: string;
  exported: boolean;
};

/**
 * Symbol-to-symbol call edge inferred from import + usage analysis.
 * `source` and `target` are both `RepoSymbol.id`s.
 */
export type SymbolCallEdge = {
  id: string;
  source: string;
  target: string;
};

export type RepoGraph = {
  rootName: string;
  defaultBranch: string;
  fetchedAt: number;
  files: RepoFile[];
  groups: string[];
  /** File → file dependency edges parsed from imports. */
  edges: RepoGraphEdge[];
  /** Exported symbols across all parseable files. */
  symbols: RepoSymbol[];
  /** Inferred symbol → symbol call edges. */
  callEdges: SymbolCallEdge[];
};

export function extToKind(path: string): FileKind {
  const ext = path.split(".").pop()?.toLowerCase() ?? "";
  if (ext === "ts") return "ts";
  if (ext === "tsx") return "tsx";
  if (ext === "js" || ext === "mjs" || ext === "cjs") return "js";
  if (ext === "jsx") return "jsx";
  if (ext === "json") return "json";
  if (ext === "html" || ext === "htm") return "html";
  if (ext === "css") return "css";
  if (ext === "md" || ext === "mdx") return "md";
  if (ext === "yml" || ext === "yaml") return "yml";
  if (ext === "prisma") return "prisma";
  if (ext === "sh") return "sh";
  return "other";
}

const INCLUDE_KINDS = new Set<FileKind>([
  "ts",
  "tsx",
  "js",
  "jsx",
  "html",
  "css",
  "prisma",
  "json",
]);
const EXCLUDE_GROUPS = new Set([
  "node_modules",
  ".next",
  ".git",
  "dist",
  "build",
  ".turbo",
  ".vercel",
]);
const EXCLUDE_FILENAMES = new Set([
  "package-lock.json",
  "pnpm-lock.yaml",
  "yarn.lock",
]);

export function shouldInclude(path: string): boolean {
  const parts = path.split("/");
  const top = parts[0];
  if (EXCLUDE_GROUPS.has(top)) return false;
  const name = parts[parts.length - 1];
  if (EXCLUDE_FILENAMES.has(name)) return false;
  return INCLUDE_KINDS.has(extToKind(path));
}

/**
 * Logical group a file belongs to.
 *
 * For repos where most code lives under a single root (e.g. `src/`), the
 * naive "first directory" rule produces a single bucket that swallows
 * everything — no cross-group structure to visualize at the system level.
 * For monorepos with a top-level `packages/`, ditto. So we treat those two
 * specifically: dive into their immediate children and surface those as
 * the group. The rest stays at the top level.
 */
const DESCEND_INTO = new Set(["src", "packages", "apps", "lib"]);

export function groupOf(path: string): string {
  const parts = path.split("/");
  if (parts.length === 1) return "root";
  const top = parts[0];
  if (DESCEND_INTO.has(top) && parts.length >= 3) {
    return `${top}/${parts[1]}`;
  }
  return top;
}
