"use client";

import { useEffect, useRef } from "react";
import { Sparkles } from "lucide-react";
import type { Node } from "@xyflow/react";

export type CanvasContextMenuState = {
  x: number;
  y: number;
  node: Node;
} | null;

export function buildAssistantPrompt(node: Node): string {
  const data = (node.data ?? {}) as Record<string, unknown>;
  switch (node.type) {
    case "intent":
      return `Explain the intent of this PR in plain English. Why is the team doing this, and what's the user-facing outcome?`;
    case "architecture":
      return `Walk me through the architecture of this PR — which modules are affected, in what order does data flow between them, and what's the riskiest seam?`;
    case "alternatives":
      return `Explain why the chosen alternative ("${data["question"] ?? ""}") was picked over the others, with the real trade-offs.`;
    case "change":
      return `Explain the change to ${data["symbol"] ?? ""}() in ${data["file"] ?? ""} — what was the behaviour before vs after, and why does it matter?`;
    case "risk":
      return `Explain this risk in detail: "${data["rule"] ?? ""}". Why is it dangerous, when does it actually trigger, and what's the smallest fix?`;
    case "diff":
      return `Summarize the diff: which files moved the most, what's the dominant theme of the change, and is anything suspicious?`;
    case "preview":
      return `What should I check inside the live preview deployment before merging this PR? Map UI surfaces to the changes in this PR.`;
    default:
      return `Explain this canvas node and its role in the review.`;
  }
}

type Props = {
  state: NonNullable<CanvasContextMenuState>;
  onExplain: () => void;
  onClose: () => void;
};

export function CanvasContextMenu({ state, onExplain, onClose }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      const target = e.target as globalThis.Node | null;
      if (target && ref.current && !ref.current.contains(target)) onClose();
    };
    window.addEventListener("click", onDoc);
    window.addEventListener("contextmenu", onDoc);
    return () => {
      window.removeEventListener("click", onDoc);
      window.removeEventListener("contextmenu", onDoc);
    };
  }, [onClose]);

  const data = state.node.data as Record<string, unknown> | undefined;
  const subtitle =
    typeof data?.symbol === "string"
      ? `${data.symbol}()`
      : typeof data?.rule === "string"
        ? data.rule
        : typeof data?.question === "string"
          ? data.question
          : state.node.type
            ? state.node.type.toUpperCase()
            : "";

  return (
    <div
      ref={ref}
      className="fixed z-50 flex flex-col rounded-lg border border-border/70 bg-background py-1 shadow-2xl"
      style={{ top: state.y, left: state.x, minWidth: 240 }}
    >
      <div
        className="border-b border-border/40 px-3 py-1.5 text-[10.5px] uppercase tracking-wider text-muted"
        style={{ fontFamily: "var(--font-mono), monospace" }}
      >
        {state.node.type} · {subtitle}
      </div>
      <button
        type="button"
        onClick={onExplain}
        className="flex items-center gap-2 px-3 py-1.5 text-left text-[12px] text-foreground hover:bg-subtle"
      >
        <Sparkles
          className="h-3 w-3"
          strokeWidth={2}
          style={{ color: "var(--accent-alternatives)" }}
        />
        Ask AI to explain this {state.node.type}
      </button>
    </div>
  );
}
