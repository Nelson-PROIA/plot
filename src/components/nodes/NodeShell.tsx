"use client";

import { Handle, Position } from "@xyflow/react";
import { motion } from "framer-motion";
import { Plus } from "lucide-react";
import { useRelayout } from "@/components/RelayoutContext";
import { cn } from "@/lib/utils";

type NodeShellProps = {
  /** Real node id — used to look up hidden successors for the reveal bubble. */
  nodeId?: string;
  accent: string;
  label: string;
  width?: number;
  glow?: boolean;
  pulse?: boolean;
  selected?: boolean;
  className?: string;
  children: React.ReactNode;
  onClick?: () => void;
};

const HANDLE_STYLE: React.CSSProperties = {
  width: 6,
  height: 6,
  background: "transparent",
  border: "none",
  opacity: 0,
};

export function NodeShell({
  nodeId,
  accent,
  label,
  width,
  glow,
  pulse,
  selected,
  className,
  children,
  onClick,
}: NodeShellProps) {
  const { hiddenSuccessorOf, revealNode } = useRelayout();
  const hidden = nodeId ? hiddenSuccessorOf(nodeId) : null;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.94 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
      style={{ width }}
      className="relative"
    >
      <div
        onClick={onClick}
        style={{
          borderColor: selected ? accent : undefined,
          boxShadow: glow
            ? `0 0 0 1px ${accent}33, 0 8px 32px ${accent}1a`
            : undefined,
        }}
        className={cn(
          "group relative overflow-hidden rounded-card border border-border/70 bg-subtle transition-all duration-300 ease-out hover:border-border",
          onClick && "cursor-pointer",
          pulse && "node-pulse",
          className,
        )}
      >
        <div
          aria-hidden
          className="absolute left-0 top-0 h-full w-[3px]"
          style={{ backgroundColor: accent }}
        />
        <Handle
          type="target"
          position={Position.Left}
          style={HANDLE_STYLE}
          isConnectable={false}
        />
        <Handle
          type="target"
          position={Position.Top}
          style={HANDLE_STYLE}
          isConnectable={false}
        />
        <Handle
          type="source"
          position={Position.Right}
          style={HANDLE_STYLE}
          isConnectable={false}
        />
        <Handle
          type="source"
          position={Position.Bottom}
          style={HANDLE_STYLE}
          isConnectable={false}
        />
        <div className="px-4 pt-3 pb-2">
          <span
            className="text-[10px] font-medium uppercase tracking-[0.14em]"
            style={{ color: accent }}
          >
            {label}
          </span>
        </div>
        {children}
      </div>
      {hidden ? (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            revealNode(hidden);
          }}
          aria-label="Reveal next"
          title="Reveal next"
          style={{
            position: "absolute",
            top: "calc(50% - 12px)",
            right: -12,
            width: 24,
            height: 24,
            borderRadius: "50%",
            border: `1.5px solid ${accent}`,
            background: "var(--subtle)",
            color: accent,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
            zIndex: 10,
            boxShadow: "0 1px 4px rgba(0,0,0,0.10)",
            transition: "transform 180ms ease-out, box-shadow 180ms ease-out",
            transformOrigin: "center center",
          }}
          className="reveal-bubble hover:scale-110"
        >
          <Plus size={12} strokeWidth={2.4} />
        </button>
      ) : null}
    </motion.div>
  );
}
