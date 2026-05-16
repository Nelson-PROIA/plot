"use client";

import {
  Eye,
  EyeOff,
  LayoutGrid,
  Maximize,
  Minus,
  Play,
  Plus,
  RotateCcw,
} from "lucide-react";
import { ThemeToggle } from "./ThemeToggle";
import { cn } from "@/lib/utils";

type ToolbarProps = {
  revealedCount: number;
  totalNodes: number;
  onRevealNext: () => void;
  onRevealPrev: () => void;
  onRevealAll: () => void;
  onResetReveal: () => void;
  onAutoLayout: () => void;
  onReset: () => void;
  onFit: () => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onStartTour?: () => void;
  className?: string;
};

function ToolButton({
  onClick,
  label,
  disabled,
  children,
}: {
  onClick: () => void;
  label: string;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={label}
      aria-label={label}
      className="flex h-7 w-7 items-center justify-center rounded-md border border-border/60 bg-subtle/40 text-muted transition-colors hover:border-border hover:bg-subtle hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-subtle/40 disabled:hover:text-muted"
    >
      {children}
    </button>
  );
}

function Divider() {
  return <span aria-hidden className="mx-0.5 h-4 w-px bg-border/60" />;
}

export function CanvasToolbar({
  revealedCount,
  totalNodes,
  onRevealNext,
  onRevealPrev,
  onRevealAll,
  onResetReveal,
  onAutoLayout,
  onReset,
  onFit,
  onZoomIn,
  onZoomOut,
  onStartTour,
  className,
}: ToolbarProps) {
  const allRevealed = revealedCount >= totalNodes;
  const atFirst = revealedCount <= 1;
  return (
    <div
      className={cn(
        "flex items-center gap-1.5 rounded-lg border border-border/60 bg-background/80 px-1.5 py-1.5 shadow-[0_4px_24px_rgba(0,0,0,0.18)] backdrop-blur",
        className,
      )}
    >
      {onStartTour ? (
        <>
          <button
            onClick={onStartTour}
            title="Start guided tour (T)"
            aria-label="Start guided tour"
            className="flex h-7 items-center gap-1.5 rounded-md border border-foreground/0 bg-foreground px-2 text-[11px] font-medium text-background transition-colors hover:bg-foreground/90"
          >
            <Play className="h-3 w-3" strokeWidth={2} />
            Tour
          </button>
          <Divider />
        </>
      ) : null}

      <ToolButton
        onClick={onRevealPrev}
        label="Hide last revealed (P)"
        disabled={atFirst}
      >
        <Minus className="h-3.5 w-3.5" strokeWidth={1.8} />
      </ToolButton>
      <span
        className="select-none px-1.5 font-mono text-[11px] tabular-nums text-muted"
        title="Revealed nodes"
      >
        {revealedCount}
        <span className="opacity-60"> / {totalNodes}</span>
      </span>
      <ToolButton
        onClick={onRevealNext}
        label="Reveal next node (N or +)"
        disabled={allRevealed}
      >
        <Plus className="h-3.5 w-3.5" strokeWidth={1.8} />
      </ToolButton>
      <ToolButton
        onClick={onResetReveal}
        label="Hide all but the first (C)"
        disabled={atFirst}
      >
        <EyeOff className="h-3.5 w-3.5" strokeWidth={1.6} />
      </ToolButton>
      <ToolButton
        onClick={onRevealAll}
        label="Reveal everything (E)"
        disabled={allRevealed}
      >
        <Eye className="h-3.5 w-3.5" strokeWidth={1.6} />
      </ToolButton>

      <Divider />
      <ToolButton onClick={onAutoLayout} label="Auto layout">
        <LayoutGrid className="h-3.5 w-3.5" strokeWidth={1.6} />
      </ToolButton>
      <ToolButton onClick={onReset} label="Reset (R)">
        <RotateCcw className="h-3.5 w-3.5" strokeWidth={1.6} />
      </ToolButton>
      <Divider />
      <ToolButton onClick={onZoomIn} label="Zoom in">
        <Plus className="h-3.5 w-3.5" strokeWidth={1.6} />
      </ToolButton>
      <ToolButton onClick={onZoomOut} label="Zoom out">
        <Minus className="h-3.5 w-3.5" strokeWidth={1.6} />
      </ToolButton>
      <ToolButton onClick={onFit} label="Fit view (F)">
        <Maximize className="h-3.5 w-3.5" strokeWidth={1.6} />
      </ToolButton>
      <Divider />
      <ThemeToggle />
    </div>
  );
}
