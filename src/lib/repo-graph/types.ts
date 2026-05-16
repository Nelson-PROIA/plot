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
  /** "import" / "require" / "html-script" / "html-link" — for future styling */
  kind: "import" | "require" | "html-script" | "html-link" | "css-import";
};

export type RepoGraph = {
  rootName: string;
  defaultBranch: string;
  fetchedAt: number;
  /** Filtered list of code-ish files we want to surface in the graph. */
  files: RepoFile[];
  /** All distinct top-level groups in the order they appear. */
  groups: string[];
  /** File → file dependency edges parsed from imports. */
  edges: RepoGraphEdge[];
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

export function groupOf(path: string): string {
  const parts = path.split("/");
  if (parts.length === 1) return "root";
  return parts[0];
}
