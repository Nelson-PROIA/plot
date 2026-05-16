"use client";

import { useCallback, useMemo, useState } from "react";
import { AnimatePresence, motion, type PanInfo } from "framer-motion";
import { ChevronLeft, ChevronRight, Check, Plus, Minus } from "lucide-react";
import type { NodeProps } from "@xyflow/react";
import type { AlternativesNodeType } from "@/lib/types";
import { useNodeAccents } from "@/components/useNodeAccents";
import { NodeShell } from "./NodeShell";
import { cn } from "@/lib/utils";

const NODE_WIDTH = 320;
const SWIPE_THRESHOLD = 70;

const slideVariants = {
  enter: (dir: number) => ({ x: dir > 0 ? 60 : -60, opacity: 0 }),
  center: { x: 0, opacity: 1 },
  exit: (dir: number) => ({ x: dir > 0 ? -60 : 60, opacity: 0 }),
};

export function AlternativesNode({
  id,
  data,
  selected,
}: NodeProps<AlternativesNodeType>) {
  const ACCENT = useNodeAccents().alternatives;
  const { question, options, chosenIndex } = data;
  const [[index, direction], setState] = useState<[number, number]>([
    chosenIndex,
    0,
  ]);

  const total = options.length;
  const current = options[index];
  const isChosen = index === chosenIndex;

  const go = useCallback(
    (dir: number) => {
      setState(([cur]) => [(cur + dir + total) % total, dir]);
    },
    [total],
  );

  const handleDragEnd = useCallback(
    (_: unknown, info: PanInfo) => {
      if (info.offset.x < -SWIPE_THRESHOLD) go(1);
      else if (info.offset.x > SWIPE_THRESHOLD) go(-1);
    },
    [go],
  );

  const cardStyle = useMemo<React.CSSProperties>(() => {
    if (isChosen) {
      return {
        background: "var(--chosen-bg)",
        borderColor: "var(--chosen-border)",
      };
    }
    return {
      background: "transparent",
      borderColor: "var(--border)",
    };
  }, [isChosen]);

  return (
    <NodeShell
      nodeId={id}
      accent={ACCENT}
      label="ALTERNATIVES"
      width={NODE_WIDTH}
      selected={selected}
      glow
    >
      <div className="px-4 pb-2">
        <p className="text-[13px] font-medium leading-snug text-foreground">
          {question}
        </p>
      </div>

      <div className="relative px-4 pb-3">
        <div className="relative overflow-hidden rounded-inner">
          <AnimatePresence custom={direction} mode="wait" initial={false}>
            <motion.div
              key={index}
              custom={direction}
              variants={slideVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
              drag="x"
              dragConstraints={{ left: 0, right: 0 }}
              dragElastic={0.2}
              onDragEnd={handleDragEnd}
              className="rounded-inner border p-3"
              style={cardStyle}
            >
              <div className="mb-1.5 flex items-center justify-between gap-2">
                <h3 className="text-[13px] font-medium tracking-tight text-foreground">
                  {current.name}
                </h3>
                {isChosen ? (
                  <span
                    className="flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wider"
                    style={{
                      background: "var(--chosen-pill-bg)",
                      color: ACCENT,
                    }}
                  >
                    <Check className="h-2.5 w-2.5" strokeWidth={3} />
                    chosen
                  </span>
                ) : (
                  <span className="rounded-full border border-border/70 px-1.5 py-0.5 text-[9px] uppercase tracking-wider text-muted">
                    alt
                  </span>
                )}
              </div>

              <p className="mb-2.5 text-[11.5px] leading-relaxed text-muted">
                {current.summary}
              </p>

              <div className="mb-2.5 flex flex-col gap-1">
                {current.pros.map((p) => (
                  <div
                    key={p}
                    className="flex items-start gap-1.5 text-[11px] leading-snug text-foreground"
                  >
                    <Plus
                      className="mt-[3px] h-2.5 w-2.5 shrink-0 text-emerald-600 dark:text-emerald-400"
                      strokeWidth={3}
                    />
                    <span>{p}</span>
                  </div>
                ))}
                {current.cons.map((c) => (
                  <div
                    key={c}
                    className="flex items-start gap-1.5 text-[11px] leading-snug text-muted"
                  >
                    <Minus
                      className="mt-[3px] h-2.5 w-2.5 shrink-0 text-rose-600 dark:text-rose-400"
                      strokeWidth={3}
                    />
                    <span>{c}</span>
                  </div>
                ))}
              </div>

              <pre
                className="mb-2 max-h-[120px] overflow-hidden rounded-[4px] border px-2 py-1.5 font-mono text-[10px] leading-[1.45]"
                style={{
                  fontFamily: "var(--font-mono), monospace",
                  background: "var(--code-bg)",
                  color: "var(--code-fg)",
                  borderColor: "var(--code-border)",
                }}
              >
                {current.code}
              </pre>

              <p className="text-[10.5px] italic leading-snug text-muted">
                When to use: {current.whenToUse}
              </p>
            </motion.div>
          </AnimatePresence>
        </div>

        <div className="mt-2.5 flex items-center justify-between">
          <button
            onClick={(e) => {
              e.stopPropagation();
              go(-1);
            }}
            className="flex h-6 w-6 items-center justify-center rounded-full border border-border/70 text-muted transition-colors hover:border-border hover:bg-subtle hover:text-foreground"
            aria-label="Previous"
          >
            <ChevronLeft className="h-3 w-3" />
          </button>

          <div className="flex items-center gap-1.5">
            {options.map((_, i) => {
              const isCurrent = i === index;
              const dotBg = isCurrent
                ? i === chosenIndex
                  ? ACCENT
                  : "var(--fg)"
                : "var(--border)";
              return (
                <button
                  key={i}
                  onClick={(e) => {
                    e.stopPropagation();
                    setState(([cur]) => [i, i > cur ? 1 : -1]);
                  }}
                  className={cn(
                    "h-1.5 rounded-full transition-all duration-300",
                    isCurrent ? "w-4" : "w-1.5",
                  )}
                  style={{ background: dotBg }}
                  aria-label={`Go to ${options[i].name}`}
                />
              );
            })}
          </div>

          <button
            onClick={(e) => {
              e.stopPropagation();
              go(1);
            }}
            className="flex h-6 w-6 items-center justify-center rounded-full border border-border/70 text-muted transition-colors hover:border-border hover:bg-subtle hover:text-foreground"
            aria-label="Next"
          >
            <ChevronRight className="h-3 w-3" />
          </button>
        </div>
      </div>
    </NodeShell>
  );
}
