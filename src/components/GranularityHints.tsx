"use client";

import { Layers3, Network, Code2 } from "lucide-react";
import type { Level } from "@/lib/repo-graph/levels";
import { cn } from "@/lib/utils";

/**
 * Mode-switch pill rendered as a Panel inside RepoGraphView.
 * Click to jump directly to a level; scroll-wheel also drives transitions.
 */
export function GranularityPill({
  level,
  onChange,
}: {
  level: Level;
  onChange: (next: Level) => void;
}) {
  const items: Array<{ k: Level; label: string; Icon: typeof Layers3 }> = [
    { k: "system", label: "System", Icon: Layers3 },
    { k: "file", label: "Files", Icon: Network },
    { k: "symbol", label: "Symbols", Icon: Code2 },
  ];
  return (
    <div className="flex items-center gap-1 rounded-full border border-border/60 bg-background/80 p-0.5 shadow-[0_4px_24px_rgba(0,0,0,0.18)] backdrop-blur">
      {items.map(({ k, label, Icon }) => (
        <button
          key={k}
          type="button"
          onClick={() => onChange(k)}
          className={cn(
            "flex h-6 items-center gap-1 rounded-full px-2.5 text-[10.5px] font-medium transition-colors",
            level === k
              ? "bg-foreground text-background"
              : "text-muted hover:bg-subtle hover:text-foreground",
          )}
          title={`${label} view`}
        >
          <Icon className="h-3 w-3" strokeWidth={1.8} />
          {label}
        </button>
      ))}
    </div>
  );
}

export function GranularityHint({ level }: { level: Level }) {
  const text: Record<Level, string> = {
    system:
      "Scroll down to go deeper — files, then symbols. Hold ⌘ + scroll to spatial-zoom.",
    file: "Scroll down for symbols, scroll up for the system view. Hold ⌘ + scroll to spatial-zoom.",
    symbol:
      "Scroll up to step back out. Right-click any symbol to trace its data flow.",
  };
  return (
    <span className="rounded-full bg-subtle/60 px-2 py-0.5 text-[10px] text-muted/90">
      {text[level]}
    </span>
  );
}
