"use client";

import { useMemo, useState } from "react";
import type { NodeProps } from "@xyflow/react";
import { ChevronRight, FileDiff } from "lucide-react";
import type { DiffNodeType, DiffFileEntry } from "@/lib/types";
import { useNodeAccents } from "@/components/useNodeAccents";
import { NodeShell } from "./NodeShell";
import { Sheet } from "@/components/ui/Sheet";
import { DiffViewer } from "@/components/DiffViewer";
import { cn } from "@/lib/utils";

export function DiffNode({ id, data, selected }: NodeProps<DiffNodeType>) {
  const ACCENT = useNodeAccents().diff;
  const [open, setOpen] = useState(false);
  const [activePath, setActivePath] = useState<string | null>(null);

  const total = useMemo(
    () => ({
      additions: data.additions,
      deletions: data.deletions,
      files: data.files.length,
    }),
    [data],
  );

  const activeFile = useMemo(
    () => data.files.find((f) => f.path === activePath) ?? null,
    [data.files, activePath],
  );

  return (
    <>
      <NodeShell
        nodeId={id}
        accent={ACCENT}
        label="DIFF"
        width={200}
        selected={selected}
        onClick={() => {
          setActivePath(data.files[0]?.path ?? null);
          setOpen(true);
        }}
      >
        <div className="px-4 pb-3">
          <div className="flex items-center gap-2.5">
            <FileDiff className="h-4 w-4 text-muted" strokeWidth={1.6} />
            <div className="flex flex-col">
              <div
                className="flex items-baseline gap-2 font-mono text-[13px]"
                style={{ fontFamily: "var(--font-mono), monospace" }}
              >
                <span className="text-emerald-700 dark:text-emerald-400">
                  +{total.additions}
                </span>
                <span className="text-rose-700 dark:text-rose-400">
                  −{total.deletions}
                </span>
              </div>
              <span className="text-[10.5px] text-muted">
                {total.files} file{total.files === 1 ? "" : "s"}
              </span>
            </div>
          </div>

          <div
            className="mt-2.5 flex h-1.5 overflow-hidden rounded-full"
            style={{ background: "var(--border)" }}
          >
            <div
              className="h-full bg-emerald-500"
              style={{
                width: `${
                  (total.additions / (total.additions + total.deletions || 1)) *
                  100
                }%`,
              }}
            />
            <div
              className="h-full bg-rose-500"
              style={{
                width: `${
                  (total.deletions / (total.additions + total.deletions || 1)) *
                  100
                }%`,
              }}
            />
          </div>
        </div>
      </NodeShell>

      <Sheet
        open={open}
        onClose={() => setOpen(false)}
        title="Files changed"
        subtitle={`+${total.additions} additions · −${total.deletions} deletions`}
        accent={ACCENT}
        widthClass="w-[min(1100px,calc(100vw-96px))]"
      >
        <div className="flex flex-col gap-4">
          <ul className="flex flex-col rounded-card border border-border/60 bg-subtle/60">
            {data.files.map((f) => (
              <FileRow
                key={f.path}
                file={f}
                active={f.path === activePath}
                onSelect={() =>
                  setActivePath((p) => (p === f.path ? null : f.path))
                }
              />
            ))}
          </ul>

          {activeFile?.unifiedDiff ? (
            <div className="flex flex-col gap-2">
              <div className="flex items-baseline justify-between gap-3 px-1">
                <h4
                  className="truncate font-mono text-[12px] font-medium text-foreground"
                  style={{ fontFamily: "var(--font-mono), monospace" }}
                >
                  {activeFile.path}
                </h4>
                <span
                  className="shrink-0 font-mono text-[10.5px]"
                  style={{ fontFamily: "var(--font-mono), monospace" }}
                >
                  <span className="text-emerald-700 dark:text-emerald-400">
                    +{activeFile.additions}
                  </span>{" "}
                  <span className="text-rose-700 dark:text-rose-400">
                    −{activeFile.deletions}
                  </span>
                </span>
              </div>
              <DiffViewer source={activeFile.unifiedDiff} />
            </div>
          ) : activePath ? (
            <p className="px-1 text-[12px] italic text-muted">
              Diff not captured for this file.
            </p>
          ) : null}
        </div>
      </Sheet>
    </>
  );
}

function FileRow({
  file,
  active,
  onSelect,
}: {
  file: DiffFileEntry;
  active: boolean;
  onSelect: () => void;
}) {
  const sumPerFile = file.additions + file.deletions || 1;
  return (
    <li
      className={cn(
        "border-b border-border/40 last:border-b-0",
        active && "bg-subtle",
      )}
    >
      <button
        onClick={onSelect}
        type="button"
        className={cn(
          "group flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors",
          !active && "hover:bg-subtle/70",
        )}
        aria-expanded={active}
      >
        <ChevronRight
          className={cn(
            "h-3 w-3 shrink-0 text-muted transition-transform",
            active && "rotate-90 text-foreground",
          )}
          strokeWidth={1.8}
        />
        <FileDiff className="h-3.5 w-3.5 shrink-0 text-muted" />
        <span
          className="min-w-0 flex-1 truncate font-mono text-[12px] text-foreground"
          style={{ fontFamily: "var(--font-mono), monospace" }}
        >
          {file.path}
        </span>
        <div
          className="flex items-baseline gap-2 font-mono text-[11px]"
          style={{ fontFamily: "var(--font-mono), monospace" }}
        >
          <span className="text-emerald-700 dark:text-emerald-400">
            +{file.additions}
          </span>
          <span className="text-rose-700 dark:text-rose-400">
            −{file.deletions}
          </span>
        </div>
        <div
          className="flex h-1 w-20 shrink-0 overflow-hidden rounded-full"
          style={{ background: "var(--border)" }}
        >
          <div
            className="h-full bg-emerald-500"
            style={{ width: `${(file.additions / sumPerFile) * 100}%` }}
          />
          <div
            className="h-full bg-rose-500"
            style={{ width: `${(file.deletions / sumPerFile) * 100}%` }}
          />
        </div>
      </button>
    </li>
  );
}
