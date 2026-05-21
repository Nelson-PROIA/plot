"use client";

import { Handle, Position, type NodeProps, type Node } from "@xyflow/react";
import { Play } from "lucide-react";
import type { SymbolKind } from "@/lib/repo-graph/types";

export type SymbolNodeData = {
  name: string;
  kind: SymbolKind;
  file: string;
  groupColor: string;
  touchedBy: { number: number; color: string }[];
  dimmed: boolean;
  onTrace: (symId: string) => void;
};

const KIND_STYLE: Record<SymbolKind, { label: string; color: string }> = {
  function: { label: "fn", color: "#8b5cf6" },
  component: { label: "ui", color: "#ec4899" },
  default: { label: "fn", color: "#8b5cf6" },
  class: { label: "cls", color: "#0ea5e9" },
  interface: { label: "iface", color: "#0ea5e9" },
  type: { label: "type", color: "#10b981" },
  enum: { label: "enum", color: "#f59e0b" },
  const: { label: "const", color: "#64748b" },
};

export function SymbolNode({ id, data }: NodeProps<Node<SymbolNodeData, "symbol">>) {
  const tag = KIND_STYLE[data.kind] ?? KIND_STYLE.function;
  const touched = data.touchedBy.length > 0;
  const accent = touched ? data.touchedBy[0].color : tag.color;
  return (
    <div
      className="group relative flex h-full w-full items-center gap-1.5 overflow-hidden rounded-md border px-1.5 text-[11px] text-foreground transition-colors hover:border-foreground/55"
      style={{
        borderColor: touched
          ? accent
          : `color-mix(in srgb, ${tag.color} 32%, var(--border))`,
        background: touched
          ? `color-mix(in srgb, ${accent} 12%, var(--subtle))`
          : "var(--subtle)",
        opacity: data.dimmed ? 0.22 : 1,
      }}
      onContextMenu={(e) => {
        e.preventDefault();
        data.onTrace(id);
      }}
    >
      <Handle type="target" position={Position.Left} style={handleStyle} />
      <Handle type="source" position={Position.Right} style={handleStyle} />

      <span
        aria-hidden
        className="absolute left-0 top-0 h-full w-[3px]"
        style={{ background: data.groupColor }}
      />
      <span
        className="ml-1 inline-flex h-[14px] shrink-0 items-center rounded px-1 text-[8.5px] font-medium uppercase tracking-wide"
        style={{
          background: `color-mix(in srgb, ${tag.color} 18%, transparent)`,
          color: tag.color,
          fontFamily: "var(--font-mono), monospace",
        }}
      >
        {tag.label}
      </span>
      <span
        className="min-w-0 flex-1 truncate font-mono"
        style={{ fontFamily: "var(--font-mono), monospace" }}
        title={`${data.name} · ${data.file}`}
      >
        {data.name}
      </span>
      {touched ? (
        <span
          className="shrink-0 rounded-full px-1.5 text-[8.5px] font-medium"
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
          data.onTrace(id);
        }}
        className="nodrag pointer-events-auto flex h-4 w-4 shrink-0 items-center justify-center rounded text-muted opacity-0 transition-opacity hover:bg-foreground/10 hover:text-foreground group-hover:opacity-100"
        title="Trace data flow through this function"
        aria-label="Trace data flow"
      >
        <Play className="h-2.5 w-2.5" strokeWidth={2} />
      </button>
    </div>
  );
}

export type SymbolFileContainerData = {
  filePath: string;
  fileName: string;
  groupColor: string;
};

export function SymbolFileContainer({
  data,
}: NodeProps<Node<SymbolFileContainerData, "symbolFileBox">>) {
  return (
    <div
      className="relative h-full w-full rounded-xl border border-dashed"
      style={{
        borderColor: `color-mix(in srgb, ${data.groupColor} 32%, var(--border))`,
        background: `color-mix(in srgb, ${data.groupColor} 4%, transparent)`,
      }}
    >
      <div
        className="flex h-[26px] items-center gap-1.5 rounded-t-xl border-b border-dashed px-3"
        style={{
          borderColor: `color-mix(in srgb, ${data.groupColor} 26%, var(--border))`,
          background: `color-mix(in srgb, ${data.groupColor} 7%, var(--background))`,
        }}
      >
        <span
          aria-hidden
          className="h-1.5 w-1.5 rounded-full"
          style={{ background: data.groupColor }}
        />
        <span
          className="truncate font-mono text-[10px] text-muted"
          style={{ fontFamily: "var(--font-mono), monospace" }}
          title={data.filePath}
        >
          {data.fileName}
        </span>
      </div>
    </div>
  );
}

const handleStyle = {
  opacity: 0,
  pointerEvents: "none" as const,
};
