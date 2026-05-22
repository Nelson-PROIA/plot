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
  /** Starting line number in the source file (1-indexed). */
  startLine: number;
  loading: boolean;
  touchedBy: { number: number; color: string }[];
  dimmed: boolean;
  onTrace: (symId: string) => void;
};

const KIND_LABEL: Record<SymbolKind, string> = {
  function: "fn",
  component: "ui",
  default: "fn",
  class: "cls",
  interface: "ifc",
  type: "type",
  enum: "enum",
  const: "const",
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
 * Code-level node: a clean source excerpt card.
 *
 * Visual goals: read as a tiny editor snippet, not a chunky badge. Single
 * thin accent bar on the left for kind+group, minimal header, gutter for
 * line numbers, no boxy chrome inside the body.
 */
export function CodeNode({ data }: NodeProps<Node<CodeNodeData, "code">>) {
  const kindColor = KIND_COLOR[data.kind] ?? KIND_COLOR.function;
  const touched = data.touchedBy.length > 0;
  const accent = touched ? data.touchedBy[0].color : kindColor;

  return (
    <div
      className="group relative flex h-full w-full overflow-hidden rounded-lg border bg-background text-foreground transition-all hover:border-foreground/40"
      style={{
        borderColor: touched
          ? accent
          : "color-mix(in srgb, var(--border) 90%, transparent)",
        opacity: data.dimmed ? 0.22 : 1,
        boxShadow: touched
          ? `0 0 0 1px ${accent}, 0 6px 24px color-mix(in srgb, ${accent} 22%, transparent)`
          : "0 2px 10px rgba(0, 0, 0, 0.08)",
      }}
    >
      <Handle type="target" position={Position.Left} style={handleStyle} />
      <Handle type="source" position={Position.Right} style={handleStyle} />

      {/* Group-color accent bar */}
      <span
        aria-hidden
        className="h-full w-[3px] shrink-0"
        style={{ background: data.groupColor }}
      />

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Compact header */}
        <header className="flex h-6 items-center gap-1.5 border-b border-border/40 bg-subtle/35 px-2">
          <span
            className="inline-flex h-[14px] shrink-0 items-center rounded px-1 text-[8.5px] font-medium uppercase tracking-wide"
            style={{
              background: `color-mix(in srgb, ${kindColor} 16%, transparent)`,
              color: kindColor,
              fontFamily: "var(--font-mono), monospace",
            }}
          >
            {KIND_LABEL[data.kind] ?? "fn"}
          </span>
          <span
            className="min-w-0 truncate text-[11px] font-medium"
            style={{ fontFamily: "var(--font-mono), monospace" }}
            title={`${data.symbolName} — ${data.file}`}
          >
            {data.symbolName}
          </span>
          <span
            className="ml-auto shrink-0 truncate text-[9.5px] text-muted"
            style={{
              fontFamily: "var(--font-mono), monospace",
              maxWidth: 110,
            }}
            title={data.file}
          >
            {data.fileName}
          </span>
          {touched ? (
            <span
              className="shrink-0 rounded-full px-1 text-[8.5px] font-medium"
              style={{
                background: `color-mix(in srgb, ${accent} 22%, transparent)`,
                color: accent,
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
            className="nodrag pointer-events-auto flex h-4 w-4 shrink-0 items-center justify-center rounded text-muted opacity-0 transition-opacity hover:bg-foreground/10 hover:text-foreground group-hover:opacity-100"
            title="Trace data flow"
            aria-label="Trace"
          >
            <Play className="h-2.5 w-2.5" strokeWidth={2.2} />
          </button>
        </header>

        {/* Source body */}
        <div
          className="relative flex-1 overflow-hidden"
          style={{ background: "var(--subtle)" }}
        >
          {data.loading ? (
            <div className="flex h-full items-center gap-1.5 px-2 text-[10.5px] text-muted">
              <Loader2 className="h-3 w-3 animate-spin" />
              reading source…
            </div>
          ) : data.bodyLines.length === 0 ? (
            <div className="flex h-full items-center px-2 text-[10.5px] text-muted/80">
              no source available
            </div>
          ) : (
            <pre
              className="m-0 h-full overflow-hidden px-1 py-1 text-[9.5px] leading-[13px]"
              style={{
                fontFamily: "var(--font-mono), monospace",
                color: "color-mix(in srgb, var(--fg) 85%, transparent)",
              }}
            >
              {data.bodyLines.map((line, i) => (
                <div key={i} className="flex">
                  <span
                    className="mr-2 inline-block w-6 shrink-0 select-none text-right tabular-nums"
                    style={{
                      color: "color-mix(in srgb, var(--muted) 60%, transparent)",
                    }}
                  >
                    {data.startLine + i}
                  </span>
                  <span className="min-w-0 flex-1 truncate">
                    {line.length === 0 ? " " : line}
                  </span>
                </div>
              ))}
            </pre>
          )}
        </div>
      </div>
    </div>
  );
}

const handleStyle = {
  opacity: 0,
  pointerEvents: "none" as const,
};
