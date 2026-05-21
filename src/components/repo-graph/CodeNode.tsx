"use client";

import { Handle, Position, type NodeProps, type Node } from "@xyflow/react";
import { Loader2, Play } from "lucide-react";
import type { SymbolKind } from "@/lib/repo-graph/types";

export type CodeNodeData = {
  symbolId: string;
  symbolName: string;
  kind: SymbolKind;
  file: string;
  fileName: string;
  groupColor: string;
  /** Source lines for the symbol body. Empty array while loading. */
  bodyLines: string[];
  loading: boolean;
  touchedBy: { number: number; color: string }[];
  dimmed: boolean;
  onTrace: (symId: string) => void;
};

const KIND_COLOR: Record<SymbolKind, string> = {
  function: "#8b5cf6",
  component: "#ec4899",
  default: "#8b5cf6",
  class: "#0ea5e9",
  interface: "#0ea5e9",
  type: "#10b981",
  enum: "#f59e0b",
  const: "#64748b",
};

/**
 * Code-level node: shows ~12 lines of a symbol's body as syntax-free
 * monospace text. Lightweight on purpose — at 60+ visible nodes we can't
 * afford a full syntax-highlighter pass. The point is to give the user a
 * "is this what I expected?" glance without leaving the canvas.
 */
export function CodeNode({ data }: NodeProps<Node<CodeNodeData, "code">>) {
  const accent = KIND_COLOR[data.kind] ?? KIND_COLOR.function;
  const touched = data.touchedBy.length > 0;
  const headerAccent = touched ? data.touchedBy[0].color : accent;
  return (
    <div
      className="group relative flex h-full w-full flex-col overflow-hidden rounded-lg border text-foreground transition-colors"
      style={{
        borderColor: touched
          ? headerAccent
          : `color-mix(in srgb, ${accent} 30%, var(--border))`,
        background: "var(--subtle)",
        opacity: data.dimmed ? 0.25 : 1,
        boxShadow: touched
          ? `0 4px 18px color-mix(in srgb, ${headerAccent} 30%, transparent)`
          : "0 4px 18px rgba(0,0,0,0.10)",
      }}
    >
      <Handle type="target" position={Position.Left} style={handleStyle} />
      <Handle type="source" position={Position.Right} style={handleStyle} />

      <header
        className="flex h-7 items-center gap-1.5 border-b border-border/50 px-2"
        style={{
          background: `color-mix(in srgb, ${headerAccent} 10%, var(--background))`,
        }}
      >
        <span
          aria-hidden
          className="h-1.5 w-1.5 rounded-full"
          style={{ background: data.groupColor }}
        />
        <span
          className="min-w-0 truncate text-[10.5px] font-medium"
          style={{ fontFamily: "var(--font-mono), monospace" }}
          title={`${data.symbolName} — ${data.file}`}
        >
          <span style={{ color: accent }}>{data.symbolName}</span>
          <span className="text-muted">  ·  {data.fileName}</span>
        </span>
        {touched ? (
          <span
            className="ml-auto shrink-0 rounded-full px-1.5 text-[8.5px] font-medium"
            style={{
              background: `color-mix(in srgb, ${headerAccent} 22%, transparent)`,
              color: headerAccent,
            }}
          >
            #{data.touchedBy[0].number}
          </span>
        ) : null}
        <button
          type="button"
          onMouseDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            data.onTrace(data.symbolId);
          }}
          className="nodrag pointer-events-auto ml-1 flex h-4 w-4 shrink-0 items-center justify-center rounded text-muted opacity-0 transition-opacity hover:bg-foreground/10 hover:text-foreground group-hover:opacity-100"
          title="Trace data flow through this function"
          aria-label="Trace"
        >
          <Play className="h-2.5 w-2.5" strokeWidth={2} />
        </button>
      </header>

      <pre
        className="m-0 flex-1 overflow-hidden px-2 py-1.5 text-[9.5px] leading-[14px] text-foreground/85"
        style={{ fontFamily: "var(--font-mono), monospace" }}
      >
        {data.loading ? (
          <span className="inline-flex items-center gap-1.5 text-muted">
            <Loader2 className="h-3 w-3 animate-spin" />
            Reading source…
          </span>
        ) : data.bodyLines.length === 0 ? (
          <span className="text-muted">No source available.</span>
        ) : (
          data.bodyLines.map((line, i) => (
            <span key={i} className="flex">
              <span className="mr-2 inline-block w-5 shrink-0 text-right text-muted/55">
                {i + 1}
              </span>
              <span className="min-w-0 truncate">{line || " "}</span>
            </span>
          ))
        )}
      </pre>
    </div>
  );
}

const handleStyle = {
  opacity: 0,
  pointerEvents: "none" as const,
};
