"use client";

import { Handle, Position, type NodeProps, type Node } from "@xyflow/react";
import { GitPullRequest, Sparkles, MousePointerClick } from "lucide-react";

export type SystemGroupNodeData = {
  label: string;
  color: string;
  fileCount: number;
  symbolCount: number;
  touchedBy: { number: number; color: string; title: string }[];
  outDeg: number;
  inDeg: number;
  dimmed: boolean;
  focused: boolean;
  onOpenPR: (n: number) => void;
  onDescribe: (g: string) => void;
  onToggleFocus: (g: string) => void;
};

export function SystemGroupNode({
  data,
}: NodeProps<Node<SystemGroupNodeData, "systemGroup">>) {
  const accent = data.color;
  return (
    <div
      className="relative flex h-full w-full flex-col overflow-hidden rounded-2xl border transition-all"
      style={{
        borderColor: data.focused
          ? accent
          : `color-mix(in srgb, ${accent} 32%, var(--border))`,
        background: `color-mix(in srgb, ${accent} 8%, var(--subtle))`,
        boxShadow: data.focused
          ? `0 0 0 2px ${accent}, 0 8px 28px rgba(0,0,0,0.18)`
          : "0 4px 18px rgba(0,0,0,0.12)",
        opacity: data.dimmed ? 0.35 : 1,
      }}
    >
      <Handle type="target" position={Position.Left} style={handleStyle} />
      <Handle type="source" position={Position.Right} style={handleStyle} />
      <Handle type="target" position={Position.Top} style={handleStyle} />
      <Handle type="source" position={Position.Bottom} style={handleStyle} />

      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          data.onToggleFocus(data.label);
        }}
        className="flex flex-col gap-1 px-4 pt-3.5 text-left"
        title={
          data.focused ? "Unfocus" : "Focus the rest of the canvas on this group"
        }
      >
        <div className="flex items-center gap-2">
          <span
            aria-hidden
            className="h-2 w-2 rounded-full"
            style={{ background: accent }}
          />
          <span
            className="font-mono text-[12.5px] font-medium text-foreground"
            style={{ fontFamily: "var(--font-mono), monospace" }}
          >
            {data.label}
          </span>
        </div>
        <div className="flex items-center gap-3 text-[10px] uppercase tracking-wider text-muted">
          <span>{data.fileCount} files</span>
          {data.symbolCount > 0 ? (
            <span>{data.symbolCount} symbols</span>
          ) : null}
        </div>
      </button>

      <div className="mt-auto flex items-center justify-between gap-2 px-4 pb-3">
        <div className="flex items-center gap-1">
          {data.touchedBy.slice(0, 4).map((pr) => (
            <button
              key={pr.number}
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                data.onOpenPR(pr.number);
              }}
              title={`#${pr.number} ${pr.title}`}
              className="flex h-5 items-center gap-1 rounded-full px-1.5 text-[9.5px] font-medium transition-transform hover:scale-110"
              style={{
                background: `color-mix(in srgb, ${pr.color} 18%, transparent)`,
                color: pr.color,
              }}
            >
              <GitPullRequest className="h-2.5 w-2.5" strokeWidth={2} />
              {pr.number}
            </button>
          ))}
          {data.touchedBy.length > 4 ? (
            <span className="text-[9.5px] text-muted">
              +{data.touchedBy.length - 4}
            </span>
          ) : null}
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              data.onDescribe(data.label);
            }}
            className="flex h-5 w-5 items-center justify-center rounded-md text-muted transition-colors hover:bg-foreground/10 hover:text-foreground"
            title="Describe this group with AI"
          >
            <Sparkles className="h-3 w-3" strokeWidth={1.8} />
          </button>
        </div>
      </div>

      {!data.focused && (data.outDeg > 0 || data.inDeg > 0) ? (
        <span className="pointer-events-none absolute right-3 top-3 inline-flex items-center gap-0.5 rounded-full bg-background/70 px-1.5 py-0.5 text-[8.5px] font-medium text-muted backdrop-blur">
          <MousePointerClick className="h-2.5 w-2.5" strokeWidth={1.8} />
          {data.outDeg}→ · ←{data.inDeg}
        </span>
      ) : null}
    </div>
  );
}

const handleStyle = {
  opacity: 0,
  pointerEvents: "none" as const,
};
