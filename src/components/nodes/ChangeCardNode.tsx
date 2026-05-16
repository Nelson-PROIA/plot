"use client";

import { useCallback, useEffect, useRef } from "react";
import { useReactFlow, type NodeProps } from "@xyflow/react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown, FileCode2, ArrowRight } from "lucide-react";
import type { ChangeCardNodeType } from "@/lib/types";
import { useNodeAccents } from "@/components/useNodeAccents";
import { NodeShell } from "./NodeShell";
import { MermaidDiagram } from "@/components/MermaidDiagram";
import { useRelayout } from "@/components/RelayoutContext";
import { cn } from "@/lib/utils";

const COLLAPSED_WIDTH = 220;
const EXPANDED_WIDTH = 600;
const EXPAND_ANIMATION_MS = 320;

export function ChangeCardNode({
  id,
  data,
  selected,
}: NodeProps<ChangeCardNodeType>) {
  const ACCENT = useNodeAccents().change;
  const expanded = data.expanded ?? false;
  const { updateNodeData } = useReactFlow();
  const { onNodeResize } = useRelayout();
  const refitTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef(false);

  // After every expand/collapse animation completes, tell the canvas to refit
  // (in tour mode → camera; otherwise → relayout + fit-all).
  useEffect(() => {
    if (!mountedRef.current) {
      mountedRef.current = true;
      return;
    }
    if (refitTimer.current) clearTimeout(refitTimer.current);
    refitTimer.current = setTimeout(onNodeResize, EXPAND_ANIMATION_MS + 30);
    return () => {
      if (refitTimer.current) clearTimeout(refitTimer.current);
    };
  }, [expanded, onNodeResize]);

  const toggle = useCallback(() => {
    updateNodeData(id, { expanded: !expanded });
  }, [id, expanded, updateNodeData]);

  const delta = data.afterSteps - data.beforeSteps;

  return (
    <NodeShell
      nodeId={id}
      accent={ACCENT}
      label="CHANGE"
      width={expanded ? EXPANDED_WIDTH : COLLAPSED_WIDTH}
      selected={selected}
      onClick={toggle}
      className="transition-[width] duration-300 ease-out"
    >
      <div className="px-4 pb-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h3
              className="truncate font-mono text-[13px] font-medium text-foreground"
              style={{ fontFamily: "var(--font-mono), monospace" }}
            >
              {data.symbol}
              <span className="text-muted">()</span>
            </h3>
            <div className="mt-0.5 flex items-center gap-1 text-[10.5px] text-muted">
              <FileCode2 className="h-3 w-3" />
              <span className="truncate font-mono">{data.file}</span>
            </div>
          </div>
          <motion.div
            animate={{ rotate: expanded ? 180 : 0 }}
            transition={{ duration: 0.2 }}
            className="shrink-0 text-muted"
          >
            <ChevronDown className="h-4 w-4" />
          </motion.div>
        </div>

        <AnimatePresence initial={false}>
          {expanded ? (
            <motion.div
              key="expanded"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
              className="overflow-hidden"
            >
              <div className="mt-3 flex items-center gap-2">
                <Pill count={data.beforeSteps} label="before" tone="muted" />
                <ArrowRight className="h-3 w-3 text-muted" />
                <Pill
                  count={data.afterSteps}
                  label="after"
                  tone={delta > 0 ? "added" : delta < 0 ? "removed" : "muted"}
                />
                {delta !== 0 ? (
                  <span
                    className={cn(
                      "ml-auto font-mono text-[10.5px]",
                      delta > 0
                        ? "text-emerald-700 dark:text-emerald-300"
                        : "text-rose-700 dark:text-rose-300",
                    )}
                  >
                    {delta > 0 ? `+${delta}` : delta} step
                    {Math.abs(delta) === 1 ? "" : "s"}
                  </span>
                ) : null}
              </div>

              <div className="mt-3 grid grid-cols-2 gap-2">
                <div
                  className="rounded-inner border p-2"
                  style={{
                    background: "var(--tint-removed-bg)",
                    borderColor: "var(--tint-removed-border)",
                  }}
                  onClick={(e) => e.stopPropagation()}
                >
                  <div
                    className="mb-1.5 flex items-center justify-between text-[10px] font-medium uppercase tracking-wider"
                    style={{ color: "var(--tint-removed-fg)" }}
                  >
                    <span>before</span>
                    <span className="font-mono">
                      {data.beforeSteps} step
                      {data.beforeSteps === 1 ? "" : "s"}
                    </span>
                  </div>
                  {data.beforeMermaid ? (
                    <MermaidDiagram source={data.beforeMermaid} tone="removed" />
                  ) : (
                    <p className="text-[11px] italic text-muted">new symbol</p>
                  )}
                </div>
                <div
                  className="rounded-inner border p-2"
                  style={{
                    background: "var(--tint-added-bg)",
                    borderColor: "var(--tint-added-border)",
                  }}
                  onClick={(e) => e.stopPropagation()}
                >
                  <div
                    className="mb-1.5 flex items-center justify-between text-[10px] font-medium uppercase tracking-wider"
                    style={{ color: "var(--tint-added-fg)" }}
                  >
                    <span>after</span>
                    <span className="font-mono">
                      {data.afterSteps} step
                      {data.afterSteps === 1 ? "" : "s"}
                    </span>
                  </div>
                  {data.afterMermaid ? (
                    <MermaidDiagram source={data.afterMermaid} tone="added" />
                  ) : (
                    <p className="text-[11px] italic text-muted">removed</p>
                  )}
                </div>
              </div>
            </motion.div>
          ) : (
            <div className="mt-2 flex items-center gap-2">
              <Pill count={data.beforeSteps} label="" tone="muted" />
              <ArrowRight className="h-3 w-3 text-muted" />
              <Pill
                count={data.afterSteps}
                label=""
                tone={delta > 0 ? "added" : delta < 0 ? "removed" : "muted"}
              />
              {delta !== 0 ? (
                <span
                  className={cn(
                    "ml-auto font-mono text-[10.5px]",
                    delta > 0
                      ? "text-emerald-700 dark:text-emerald-300"
                      : "text-rose-700 dark:text-rose-300",
                  )}
                >
                  {delta > 0 ? `+${delta}` : delta}
                </span>
              ) : null}
            </div>
          )}
        </AnimatePresence>
      </div>
    </NodeShell>
  );
}

function Pill({
  count,
  label,
  tone,
}: {
  count: number;
  label: string;
  tone: "muted" | "added" | "removed";
}) {
  const style: React.CSSProperties =
    tone === "added"
      ? {
          background: "var(--tint-added-bg)",
          borderColor: "var(--tint-added-border)",
          color: "var(--tint-added-fg)",
        }
      : tone === "removed"
        ? {
            background: "var(--tint-removed-bg)",
            borderColor: "var(--tint-removed-border)",
            color: "var(--tint-removed-fg)",
          }
        : {
            background: "transparent",
            borderColor: "var(--border)",
            color: "var(--muted)",
          };
  return (
    <span
      className="flex items-center gap-1 rounded-full border px-2 py-[3px] text-[10.5px] leading-none"
      style={style}
    >
      <span className="font-mono">{count}</span>
      {label ? <span className="opacity-80">{label}</span> : null}
    </span>
  );
}
