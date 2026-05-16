"use client";

import { useState } from "react";
import type { NodeProps } from "@xyflow/react";
import { AlertTriangle } from "lucide-react";
import type { RiskNodeData, RiskNodeType } from "@/lib/types";
import { useNodeAccents } from "@/components/useNodeAccents";
import { Markdown } from "@/components/Markdown";
import { NodeShell } from "./NodeShell";
import { Sheet } from "@/components/ui/Sheet";

const SEVERITY_LABEL: Record<RiskNodeData["severity"], string> = {
  high: "high",
  medium: "medium",
  low: "low",
};

function severityStyle(severity: RiskNodeData["severity"]): React.CSSProperties {
  switch (severity) {
    case "high":
      return {
        background: "var(--severity-high-bg)",
        borderColor: "var(--severity-high-border)",
        color: "var(--severity-high-fg)",
      };
    case "medium":
      return {
        background: "var(--severity-medium-bg)",
        borderColor: "var(--severity-medium-border)",
        color: "var(--severity-medium-fg)",
      };
    default:
      return {
        background: "var(--severity-low-bg)",
        borderColor: "var(--severity-low-border)",
        color: "var(--severity-low-fg)",
      };
  }
}

export function RiskNode({ id, data, selected }: NodeProps<RiskNodeType>) {
  const ACCENT = useNodeAccents().risk;
  const [open, setOpen] = useState(false);

  return (
    <>
      <NodeShell
        nodeId={id}
        accent={ACCENT}
        label="RISK"
        width={220}
        selected={selected}
        pulse={data.severity === "high"}
        onClick={() => setOpen(true)}
      >
        <div className="px-4 pb-3">
          <div className="flex items-start gap-2">
            <AlertTriangle
              className="mt-[2px] h-3.5 w-3.5 shrink-0"
              style={{ color: ACCENT }}
              strokeWidth={2.2}
            />
            <div className="min-w-0">
              <p className="text-[12.5px] font-medium leading-snug text-foreground">
                {data.rule}
              </p>
              <p
                className="mt-1 truncate font-mono text-[10.5px] text-muted"
                style={{ fontFamily: "var(--font-mono), monospace" }}
              >
                {data.file}:{data.line}
              </p>
              <div className="mt-1.5 text-[11px] leading-snug text-muted">
                <Markdown variant="tight">{data.rationale}</Markdown>
              </div>
              <span
                className="mt-2 inline-flex items-center gap-1 rounded-full border px-1.5 py-[2px] text-[10px] font-medium uppercase tracking-wider"
                style={severityStyle(data.severity)}
              >
                {SEVERITY_LABEL[data.severity]}
              </span>
            </div>
          </div>
        </div>
      </NodeShell>

      <Sheet
        open={open}
        onClose={() => setOpen(false)}
        title={data.rule}
        subtitle={`${data.file}:${data.line}`}
        accent={ACCENT}
      >
        <div className="flex flex-col gap-4">
          <div>
            <h4 className="mb-1 text-[11px] font-medium uppercase tracking-wider text-muted">
              Why this is flagged
            </h4>
            <div className="text-sm leading-relaxed text-foreground">
              <Markdown>{data.rationale}</Markdown>
            </div>
          </div>
          {data.codeExcerpt ? (
            <div>
              <h4 className="mb-2 text-[11px] font-medium uppercase tracking-wider text-muted">
                Code excerpt
              </h4>
              <pre
                className="overflow-x-auto rounded-inner border px-3 py-2.5 font-mono text-[11.5px] leading-relaxed"
                style={{
                  fontFamily: "var(--font-mono), monospace",
                  background: "var(--tint-removed-bg)",
                  borderColor: "var(--tint-removed-border)",
                  color: "var(--code-fg)",
                }}
              >
                {data.codeExcerpt}
              </pre>
              <p
                className="mt-1.5 font-mono text-[10.5px] text-muted"
                style={{ fontFamily: "var(--font-mono), monospace" }}
              >
                {data.file}:{data.line}
              </p>
            </div>
          ) : null}
          <div className="flex items-center gap-2">
            <span className="text-[11px] uppercase tracking-wider text-muted">
              severity
            </span>
            <span
              className="rounded-full border px-2 py-[2px] text-[10.5px] font-medium uppercase tracking-wider"
              style={severityStyle(data.severity)}
            >
              {SEVERITY_LABEL[data.severity]}
            </span>
          </div>
        </div>
      </Sheet>
    </>
  );
}
