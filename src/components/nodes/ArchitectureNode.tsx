"use client";

import { useCallback, useMemo, useState } from "react";
import type { NodeProps } from "@xyflow/react";
import { Maximize2 } from "lucide-react";
import type { ArchitectureNodeType } from "@/lib/types";
import { useNodeAccents } from "@/components/useNodeAccents";
import { NodeShell } from "./NodeShell";
import { Sheet } from "@/components/ui/Sheet";

const NODE_WIDTH = 240;

type LayoutScale = "compact" | "expanded";

function MiniArchSVG({
  data,
  scale,
}: {
  data: ArchitectureNodeType["data"];
  scale: LayoutScale;
}) {
  const isExp = scale === "expanded";
  const SVG_W = isExp ? 640 : 208;
  const SVG_H = isExp ? 480 : 200;
  const MOD_W = isExp ? 200 : 86;
  const MOD_H = isExp ? 60 : 26;

  const moduleById = useMemo(() => {
    const map = new Map<string, (typeof data.modules)[number]>();
    data.modules.forEach((m) => map.set(m.id, m));
    return map;
  }, [data.modules]);

  // Scale module positions if expanded — the original positions assume the 208×200 SVG.
  const scaleX = isExp ? SVG_W / 208 : 1;
  const scaleY = isExp ? SVG_H / 200 : 1;

  return (
    <svg
      width={SVG_W}
      height={SVG_H}
      viewBox={`0 0 ${SVG_W} ${SVG_H}`}
      className="block rounded-inner"
      style={{ background: "var(--arch-bg)" }}
    >
      <defs>
        <pattern
          id={`arch-grid-${scale}`}
          width={isExp ? 24 : 12}
          height={isExp ? 24 : 12}
          patternUnits="userSpaceOnUse"
        >
          <circle cx={1} cy={1} r={0.5} fill="var(--arch-grid-dot)" />
        </pattern>
      </defs>
      <rect
        width={SVG_W}
        height={SVG_H}
        fill={`url(#arch-grid-${scale})`}
      />

      {data.connections.map((c, idx) => {
        const from = moduleById.get(c.from);
        const to = moduleById.get(c.to);
        if (!from || !to) return null;
        const x1 = (from.x + MOD_W / scaleX / 2) * scaleX;
        const y1 = (from.y + MOD_H / scaleY / 2) * scaleY;
        const x2 = (to.x + MOD_W / scaleX / 2) * scaleX;
        const y2 = (to.y + MOD_H / scaleY / 2) * scaleY;
        const bothTouched = from.touched && to.touched;
        return (
          <line
            key={idx}
            x1={x1}
            y1={y1}
            x2={x2}
            y2={y2}
            stroke={
              bothTouched
                ? "var(--arch-connection-touched)"
                : "var(--arch-connection-default)"
            }
            strokeWidth={bothTouched ? (isExp ? 1.6 : 1.2) : (isExp ? 1 : 0.8)}
            strokeDasharray={bothTouched ? undefined : "3 3"}
            opacity={bothTouched ? 0.85 : 0.7}
          />
        );
      })}

      {data.modules.map((m) => (
        <g
          key={m.id}
          transform={`translate(${m.x * scaleX}, ${m.y * scaleY})`}
          className={m.touched ? "mod-glow" : undefined}
        >
          <rect
            width={MOD_W}
            height={MOD_H}
            rx={isExp ? 8 : 4}
            fill={
              m.touched
                ? "var(--arch-touched-fill)"
                : "var(--arch-untouched-fill)"
            }
            stroke={
              m.touched
                ? "var(--arch-touched-stroke)"
                : "var(--arch-untouched-stroke)"
            }
            strokeWidth={m.touched ? 1 : 0.7}
          />
          <text
            x={MOD_W / 2}
            y={MOD_H / 2 + (isExp ? 5 : 3)}
            textAnchor="middle"
            fontFamily="var(--font-mono), monospace"
            fontSize={isExp ? 14 : 9}
            fill={
              m.touched
                ? "var(--arch-touched-text)"
                : "var(--arch-untouched-text)"
            }
          >
            {m.label}
          </text>
        </g>
      ))}
    </svg>
  );
}

export function ArchitectureNode({
  id,
  data,
  selected,
}: NodeProps<ArchitectureNodeType>) {
  const ACCENT = useNodeAccents().architecture;
  const [sheetOpen, setSheetOpen] = useState(false);
  const touchedCount = data.modules.filter((m) => m.touched).length;

  const openSheet = useCallback(() => setSheetOpen(true), []);

  return (
    <>
      <NodeShell
        nodeId={id}
        accent={ACCENT}
        label="ARCHITECTURE"
        width={NODE_WIDTH}
        selected={selected}
      >
        <div className="px-4 pb-3">
          <div className="relative">
            <MiniArchSVG data={data} scale="compact" />
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                openSheet();
              }}
              aria-label="Expand architecture"
              title="Expand"
              className="nodrag absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-md border border-border/60 bg-background/80 text-muted backdrop-blur hover:bg-background hover:text-foreground"
            >
              <Maximize2 className="h-3 w-3" strokeWidth={1.8} />
            </button>
          </div>
          <p className="mt-2 text-[11px] text-muted">
            <span className="text-foreground">{touchedCount}</span> of{" "}
            {data.modules.length} modules touched
          </p>
        </div>
      </NodeShell>

      <Sheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        title="Architecture"
        subtitle={`${touchedCount} of ${data.modules.length} modules touched`}
        accent={ACCENT}
        widthClass="w-[min(760px,calc(100vw-32px))]"
      >
        <div className="flex flex-col gap-3">
          <MiniArchSVG data={data} scale="expanded" />
          <p className="text-[12px] leading-relaxed text-muted">
            Highlighted modules are touched by this PR. Solid red lines show
            dependencies between two changed modules; dashed gray lines are
            untouched dependencies that still cross the change boundary.
          </p>
        </div>
      </Sheet>
    </>
  );
}
