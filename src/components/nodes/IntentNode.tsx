"use client";

import { useState } from "react";
import type { NodeProps } from "@xyflow/react";
import { ChevronRight, Hash } from "lucide-react";
import type { IntentNodeData, IntentNodeType } from "@/lib/types";
import { useNodeAccents } from "@/components/useNodeAccents";
import { Markdown } from "@/components/Markdown";
import { NodeShell } from "./NodeShell";
import { Sheet } from "@/components/ui/Sheet";
import { cn } from "@/lib/utils";

const PREVIEW_LIMIT = 240;

const KIND_LABEL: Record<IntentNodeData["kind"], string> = {
  feature: "feature",
  fix: "fix",
  refactor: "refactor",
};

const SURFACE_LABEL: Record<IntentNodeData["surface"], string> = {
  frontend: "frontend",
  backend: "backend",
  fullstack: "fullstack",
};

function Badge({
  children,
  tone = "default",
  accent,
}: {
  children: React.ReactNode;
  tone?: "default" | "accent";
  accent: string;
}) {
  return (
    <span
      className={cn(
        "rounded-full border px-1.5 py-[2px] text-[10px] font-medium leading-none",
        tone === "accent"
          ? "border-transparent"
          : "border-border/70 text-muted",
      )}
      style={
        tone === "accent"
          ? {
              background: `color-mix(in srgb, ${accent} 16%, transparent)`,
              color: accent,
            }
          : undefined
      }
    >
      {children}
    </span>
  );
}

export function IntentNode({ id, data, selected }: NodeProps<IntentNodeType>) {
  const ACCENT = useNodeAccents().intent;
  const [open, setOpen] = useState(false);
  const summary = data.summary ?? "";
  const details = data.details ?? "";
  // Show the full summary inline — card auto-grows. Only show "Show full intent"
  // when `details` has more material than the summary (multi-paragraph body).
  const hasMore =
    details.length > 0 && details.length > summary.length + 8;
  const preview = summary;
  return (
    <>
      <NodeShell
        nodeId={id}
        accent={ACCENT}
        label="INTENT"
        width={240}
        selected={selected}
        onClick={hasMore ? () => setOpen(true) : undefined}
      >
        <div className="px-4 pb-3">
          <div className="text-[13px] font-medium leading-snug text-foreground">
            <Markdown variant="tight">{preview}</Markdown>
          </div>
          {hasMore ? (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setOpen(true);
              }}
              className="mt-2 flex items-center gap-0.5 text-[10.5px] font-medium text-muted transition-colors hover:text-foreground"
            >
              Show full intent
              <ChevronRight className="h-3 w-3" strokeWidth={1.8} />
            </button>
          ) : null}
          <div className="mt-3 flex flex-wrap items-center gap-1">
            <Badge tone="accent" accent={ACCENT}>
              {KIND_LABEL[data.kind]}
            </Badge>
            <Badge accent={ACCENT}>{SURFACE_LABEL[data.surface]}</Badge>
            <Badge accent={ACCENT}>scope {data.scope}</Badge>
            {data.ticket ? (
              <span className="ml-auto inline-flex items-center gap-0.5 rounded-full border border-border/70 px-1.5 py-[2px] font-mono text-[10px] text-muted">
                <Hash className="h-2.5 w-2.5" />
                {data.ticket}
              </span>
            ) : null}
          </div>
        </div>
      </NodeShell>

      <Sheet
        open={open}
        onClose={() => setOpen(false)}
        title="Intent"
        subtitle={data.ticket ?? undefined}
        accent={ACCENT}
        widthClass="w-[min(540px,calc(100vw-32px))]"
      >
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center gap-1.5">
            <Badge tone="accent" accent={ACCENT}>
              {KIND_LABEL[data.kind]}
            </Badge>
            <Badge accent={ACCENT}>{SURFACE_LABEL[data.surface]}</Badge>
            <Badge accent={ACCENT}>scope {data.scope}</Badge>
          </div>
          <div className="text-[13.5px] leading-relaxed text-foreground">
            <Markdown>{data.details && data.details.length > summary.length ? data.details : summary}</Markdown>
          </div>
        </div>
      </Sheet>
    </>
  );
}
