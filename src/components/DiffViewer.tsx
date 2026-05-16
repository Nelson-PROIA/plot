"use client";

import { useMemo } from "react";
import {
  parseDiff,
  Diff,
  Hunk,
  tokenize,
  type FileData,
  type HunkTokens,
} from "react-diff-view";
import { refractor } from "refractor";
import "react-diff-view/style/index.css";

type DiffViewerProps = {
  source: string;
};

function detectLanguage(path: string | undefined): string {
  if (!path) return "text";
  const p = path.toLowerCase();
  if (p.endsWith(".ts") || p.endsWith(".tsx")) return "typescript";
  if (p.endsWith(".js") || p.endsWith(".mjs") || p.endsWith(".cjs"))
    return "javascript";
  if (p.endsWith(".jsx")) return "jsx";
  if (p.endsWith(".html") || p.endsWith(".htm")) return "html";
  if (p.endsWith(".css") || p.endsWith(".scss") || p.endsWith(".sass"))
    return "css";
  if (p.endsWith(".json")) return "json";
  if (p.endsWith(".md") || p.endsWith(".mdx")) return "markdown";
  if (p.endsWith(".yml") || p.endsWith(".yaml")) return "yaml";
  if (p.endsWith(".prisma")) return "graphql"; // similar-ish, gets close enough
  if (p.endsWith(".sh")) return "bash";
  return "text";
}

function tokenizeFile(file: FileData): HunkTokens | undefined {
  const lang = detectLanguage(file.newPath ?? file.oldPath);
  try {
    return tokenize(file.hunks, {
      refractor,
      language: lang,
      highlight: true,
    });
  } catch {
    return undefined;
  }
}

export function DiffViewer({ source }: DiffViewerProps) {
  const files = useMemo<FileData[]>(() => {
    try {
      return parseDiff(source);
    } catch {
      return [];
    }
  }, [source]);

  if (files.length === 0) {
    return (
      <pre
        className="overflow-x-auto rounded-inner border px-3 py-2.5 font-mono text-[11px] leading-relaxed"
        style={{
          fontFamily: "var(--font-mono), monospace",
          background: "var(--code-bg)",
          color: "var(--code-fg)",
          borderColor: "var(--code-border)",
        }}
      >
        {source}
      </pre>
    );
  }

  return (
    <div className="surface-diff overflow-x-auto rounded-inner border border-border/70">
      {files.map((file, idx) => {
        const tokens = tokenizeFile(file);
        return (
          <Diff
            key={idx}
            viewType="split"
            diffType={file.type}
            hunks={file.hunks}
            tokens={tokens}
          >
            {(hunks) =>
              hunks.map((h) => <Hunk key={h.content} hunk={h} />)
            }
          </Diff>
        );
      })}
    </div>
  );
}
