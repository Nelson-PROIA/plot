"use client";

import { motion, AnimatePresence } from "framer-motion";
import {
  ChevronLeft,
  ChevronRight,
  Pause,
  Play,
  RotateCcw,
  X,
} from "lucide-react";
import type { TourStop } from "@/lib/types";
import { cn } from "@/lib/utils";

type TourBarProps = {
  stops: TourStop[];
  index: number;
  isPlaying: boolean;
  onPlay: () => void;
  onPause: () => void;
  onNext: () => void;
  onPrev: () => void;
  onRestart: () => void;
  onExit: () => void;
};

function CtrlButton({
  onClick,
  label,
  disabled,
  children,
  primary,
}: {
  onClick: () => void;
  label: string;
  disabled?: boolean;
  children: React.ReactNode;
  primary?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={label}
      aria-label={label}
      className={cn(
        "flex h-7 w-7 items-center justify-center rounded-md border transition-colors disabled:cursor-not-allowed disabled:opacity-40",
        primary
          ? "border-foreground/0 bg-foreground text-background hover:bg-foreground/90"
          : "border-border/60 bg-subtle/40 text-muted hover:border-border hover:bg-subtle hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}

export function TourBar({
  stops,
  index,
  isPlaying,
  onPlay,
  onPause,
  onNext,
  onPrev,
  onRestart,
  onExit,
}: TourBarProps) {
  const stop = stops[index];
  if (!stop) return null;

  const isLast = index === stops.length - 1;
  const isFirst = index === 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 18 }}
      transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
      className="pointer-events-auto w-[min(640px,calc(100vw-48px))] overflow-hidden rounded-lg border border-border/60 bg-background/85 shadow-[0_10px_36px_rgba(0,0,0,0.25)] backdrop-blur"
    >
      <div className="flex items-center gap-3 px-3 py-2.5">
        <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted">
          {String(index + 1).padStart(2, "0")}
          <span className="opacity-50"> / {String(stops.length).padStart(2, "0")}</span>
        </span>
        <div className="h-4 w-px bg-border/70" aria-hidden />
        <div className="min-w-0 flex-1">
          <AnimatePresence mode="wait">
            <motion.div
              key={stop.nodeId}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.22 }}
            >
              <p className="truncate text-[12.5px] font-medium leading-tight text-foreground">
                {stop.title}
              </p>
              <p className="mt-0.5 line-clamp-2 text-[11.5px] leading-snug text-muted">
                {stop.caption}
              </p>
            </motion.div>
          </AnimatePresence>
        </div>
        <div className="flex items-center gap-1.5">
          <CtrlButton onClick={onPrev} label="Previous" disabled={isFirst}>
            <ChevronLeft className="h-3.5 w-3.5" strokeWidth={1.6} />
          </CtrlButton>
          {isPlaying ? (
            <CtrlButton onClick={onPause} label="Pause" primary>
              <Pause className="h-3.5 w-3.5" strokeWidth={1.6} />
            </CtrlButton>
          ) : (
            <CtrlButton onClick={onPlay} label="Play" primary>
              <Play className="h-3.5 w-3.5" strokeWidth={1.6} />
            </CtrlButton>
          )}
          <CtrlButton onClick={onNext} label="Next" disabled={isLast}>
            <ChevronRight className="h-3.5 w-3.5" strokeWidth={1.6} />
          </CtrlButton>
          <CtrlButton onClick={onRestart} label="Restart">
            <RotateCcw className="h-3.5 w-3.5" strokeWidth={1.6} />
          </CtrlButton>
          <span className="mx-0.5 h-4 w-px bg-border/60" aria-hidden />
          <CtrlButton onClick={onExit} label="Exit tour">
            <X className="h-3.5 w-3.5" strokeWidth={1.6} />
          </CtrlButton>
        </div>
      </div>
      <div className="flex h-[3px] w-full">
        {stops.map((_, i) => (
          <span
            key={i}
            className={cn(
              "flex-1 transition-colors duration-500",
              i < index
                ? "bg-foreground/70"
                : i === index
                  ? "bg-foreground"
                  : "bg-border/60",
            )}
          />
        ))}
      </div>
    </motion.div>
  );
}
