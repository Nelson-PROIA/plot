"use client";

import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  BackgroundVariant,
  BaseEdge,
  Handle,
  MarkerType,
  Position,
  getSmoothStepPath,
  type Edge,
  type EdgeProps,
  type Node,
  type NodeProps,
} from "@xyflow/react";
import {
  ArrowLeftRight,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Pause,
  Play,
  Sparkles,
  X,
} from "lucide-react";
import type {
  FunctionTrace,
  TracedCall,
} from "@/app/api/ai/function-trace/route";
import type { Signature } from "@/app/api/repo/signatures/route";

const NODE_W = 240;
const SIDE_NODE_H = 92;
const CENTER_NODE_H = 116;
const COL_GAP_X = 220;
const ROW_GAP_Y = 22;

type Target = {
  owner: string;
  repo: string;
  ref?: string;
  path: string;
  signature: Signature;
};

type CallNodeData = {
  call: TracedCall;
  role: "caller" | "callee";
  /** True when the file is in the repo graph so we can re-trace from it. */
  drillable: boolean;
};

type FunctionNodeData = {
  name: string;
  params?: string;
  file: string;
  description: string;
};

function CallNode({ data }: NodeProps<Node<CallNodeData, "call">>) {
  const accent = data.role === "caller" ? "#0ea5e9" : "#8b5cf6";
  const isCaller = data.role === "caller";
  return (
    <div
      className={`flex h-full w-full flex-col gap-0.5 overflow-hidden rounded-lg border bg-subtle px-2.5 py-2 text-foreground transition-colors ${
        data.drillable ? "cursor-pointer hover:border-foreground/60" : ""
      }`}
      style={{
        width: NODE_W,
        borderColor: `color-mix(in srgb, ${accent} 35%, var(--border))`,
        background: `color-mix(in srgb, ${accent} 6%, var(--subtle))`,
      }}
    >
      {isCaller ? (
        <Handle
          type="source"
          position={Position.Right}
          style={{ background: accent, width: 6, height: 6, border: "none" }}
        />
      ) : (
        <Handle
          type="target"
          position={Position.Left}
          style={{ background: accent, width: 6, height: 6, border: "none" }}
        />
      )}
      <span
        className="truncate text-[11.5px] font-medium"
        style={{ color: accent, fontFamily: "var(--font-mono), monospace" }}
      >
        {data.call.name}
      </span>
      {data.call.file ? (
        <span
          className="truncate text-[9.5px] text-muted"
          style={{ fontFamily: "var(--font-mono), monospace" }}
        >
          {data.call.file}
        </span>
      ) : null}
      {data.call.purpose ? (
        <span
          className="text-[10.5px] leading-snug text-foreground/80"
          style={{
            display: "-webkit-box",
            WebkitLineClamp: 2,
            WebkitBoxOrient: "vertical",
            overflow: "hidden",
          }}
        >
          {data.call.purpose}
        </span>
      ) : null}
    </div>
  );
}

function FunctionNode({
  data,
}: NodeProps<Node<FunctionNodeData, "function">>) {
  return (
    <div
      className="flex h-full w-full flex-col gap-1 overflow-hidden rounded-lg border-2 bg-background px-3 py-2 shadow-[0_4px_18px_rgba(0,0,0,0.16)]"
      style={{
        width: NODE_W,
        borderColor: "var(--fg)",
      }}
    >
      <Handle
        type="target"
        position={Position.Left}
        style={{ background: "var(--fg)", width: 6, height: 6, border: "none" }}
      />
      <Handle
        type="source"
        position={Position.Right}
        style={{ background: "var(--fg)", width: 6, height: 6, border: "none" }}
      />
      <span
        className="truncate text-[12.5px] font-semibold"
        style={{ fontFamily: "var(--font-mono), monospace" }}
      >
        {data.name}
        {data.params !== undefined ? (
          <span className="font-normal text-muted">({data.params})</span>
        ) : null}
      </span>
      <span
        className="truncate text-[9.5px] text-muted"
        style={{ fontFamily: "var(--font-mono), monospace" }}
      >
        {data.file}
      </span>
      {data.description ? (
        <span
          className="text-[10.5px] leading-snug text-foreground/85"
          style={{
            display: "-webkit-box",
            WebkitLineClamp: 3,
            WebkitBoxOrient: "vertical",
            overflow: "hidden",
          }}
        >
          {data.description}
        </span>
      ) : null}
    </div>
  );
}

function prettyPayload(raw: string): string {
  const s = raw.trim();
  if (!s) return "";
  // Try strict JSON first.
  try {
    return JSON.stringify(JSON.parse(s), null, 2);
  } catch {
    /* fall through */
  }
  // Try lenient parse: model often emits single-quoted TS-ish literals.
  // Convert ' → ", quote bare keys → re-attempt parse. If it fails, return raw.
  try {
    const lenient = s
      // Convert single-quoted string values to double-quoted.
      .replace(/'([^'\\]*(?:\\.[^'\\]*)*)'/g, (_m, body: string) => {
        return '"' + body.replace(/"/g, '\\"') + '"';
      })
      // Quote bare object keys (foo: → "foo":).
      .replace(/([{,]\s*)([A-Za-z_$][\w$]*)\s*:/g, '$1"$2":');
    return JSON.stringify(JSON.parse(lenient), null, 2);
  } catch {
    return s;
  }
}

type FlowEdgeData = {
  payload: string;
  accent: string;
  /** Cycle duration in seconds — vary per edge so packets don't all sync. */
  durationSeconds: number;
  /** "play" = sequential lifecycle; "step" = static, only active edge shows. */
  mode: "play" | "step";
  /** Step mode: true when this is the user-selected step. */
  isActive: boolean;
  /** Play mode: true when this edge currently has the in-flight packet. */
  inFlight: boolean;
};

function FlowEdge(props: EdgeProps<Edge<FlowEdgeData, "flow">>) {
  const {
    id,
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
    markerEnd,
    style,
    data,
  } = props;
  const [edgePath] = getSmoothStepPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
    borderRadius: 14,
  });

  const accent = data?.accent ?? "var(--fg)";
  const payload = data?.payload ?? "";
  const dur = data?.durationSeconds ?? 2.8;
  const mode = data?.mode ?? "play";
  const isStepping = mode === "step";
  const isStepActive = !!data?.isActive;
  const inFlight = !!data?.inFlight;
  // In play mode, only the currently-in-flight edge is "lit".
  // In step mode, only the user-selected step's edge is "lit".
  const lit = isStepping ? isStepActive : inFlight;
  const dimmed = !lit;

  // Strip whitespace for the chip label (compact, single line).
  const inline = payload.replace(/\s+/g, " ").trim();
  const short = inline.length > 24 ? inline.slice(0, 24) + "…" : inline;
  const label = short || "{ }";
  const labelW = Math.max(28, label.length * 5.6 + 14);
  const labelH = 16;

  const midX = (sourceX + targetX) / 2;
  const midY = (sourceY + targetY) / 2;

  const baseStrokeWidth =
    typeof style?.strokeWidth === "number" ? style.strokeWidth : 1.2;
  const edgeStyle: React.CSSProperties = {
    ...style,
    opacity: dimmed ? 0.18 : 1,
    strokeWidth: lit ? 2.4 : baseStrokeWidth,
    transition: "opacity 180ms, stroke-width 180ms",
  };

  // Show the chip whenever the edge is lit (either flow step or flight).
  const showChip = lit;

  return (
    <>
      <BaseEdge id={id} path={edgePath} markerEnd={markerEnd} style={edgeStyle} />
      {showChip ? (
        <g
          pointerEvents="none"
          {...(isStepping ? { transform: `translate(${midX}, ${midY})` } : {})}
        >
          <rect
            x={-labelW / 2}
            y={-labelH / 2}
            width={labelW}
            height={labelH}
            rx={5}
            style={{
              fill: accent,
              stroke: accent,
              strokeWidth: 1,
              fillOpacity: 0.95,
              filter: lit
                ? `drop-shadow(0 0 6px color-mix(in srgb, ${accent} 70%, transparent))`
                : undefined,
            }}
          />
          <text
            x={0}
            y={1}
            textAnchor="middle"
            dominantBaseline="middle"
            style={{
              fontSize: 9.5,
              fill: "#ffffff",
              fontFamily: "var(--font-mono), monospace",
              fontWeight: 500,
            }}
          >
            {label}
          </text>
          {!isStepping && inFlight ? (
            <animateMotion
              dur={`${dur}s`}
              repeatCount="indefinite"
              rotate="0"
              path={edgePath}
            />
          ) : null}
        </g>
      ) : null}
    </>
  );
}

const nodeTypes = { call: CallNode, function: FunctionNode };
const edgeTypes = { flow: FlowEdge };

export function FunctionTracePanel({
  open,
  target,
  history,
  knownPaths,
  onNavigate,
  onBack,
  onClose,
  openaiKey,
  githubToken,
}: {
  open: boolean;
  target: Target | null;
  /** Stack of previously-traced targets, oldest first. */
  history: Target[];
  /** Paths known to the repo graph — used to decide whether a chip can drill. */
  knownPaths: Set<string>;
  /** Push a new target onto the stack. */
  onNavigate: (next: { path: string; signature: Signature }) => void;
  /** Pop back to a specific level (`idx === -1` to go all the way to root). */
  onBack: (idx: number) => void;
  onClose: () => void;
  openaiKey: string | null;
  githubToken: string | null;
}) {
  const [trace, setTrace] = useState<FunctionTrace | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);
  const [playerMode, setPlayerMode] = useState<"play" | "step">("play");
  const [stepIdx, setStepIdx] = useState(0);
  const [flightIdx, setFlightIdx] = useState(0);

  useEffect(() => {
    if (!open || !target) {
      setTrace(null);
      setError(null);
      setSelectedEdgeId(null);
      setStepIdx(0);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    setTrace(null);
    setSelectedEdgeId(null);
    setStepIdx(0);
    fetch("/api/ai/function-trace", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(openaiKey ? { "x-openai-key": openaiKey } : {}),
        ...(githubToken ? { "x-github-token": githubToken } : {}),
      },
      body: JSON.stringify({
        owner: target.owner,
        repo: target.repo,
        ref: target.ref,
        path: target.path,
        signature: target.signature,
      }),
    })
      .then(async (res) => {
        if (!res.ok) {
          const j = (await res.json().catch(() => ({}))) as { error?: string };
          throw new Error(j.error ?? `HTTP ${res.status}`);
        }
        return res.json() as Promise<FunctionTrace>;
      })
      .then((t) => {
        if (!cancelled) setTrace(t);
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, target, openaiKey, githubToken]);

  const orderedEdgeIds = useMemo(() => {
    if (!trace) return [] as string[];
    return [
      ...trace.callers.map((_, i) => `e-caller-${i}`),
      ...trace.callees.map((_, i) => `e-callee-${i}`),
    ];
  }, [trace]);

  const activeEdgeId =
    playerMode === "step" && orderedEdgeIds.length > 0
      ? orderedEdgeIds[Math.min(stepIdx, orderedEdgeIds.length - 1)]
      : null;

  // Sequential lifecycle in play mode: cycle one packet at a time through
  // callers (incoming) → callees (outgoing).
  useEffect(() => {
    if (playerMode !== "play" || orderedEdgeIds.length === 0) return;
    setFlightIdx(0);
    const HOP_MS = 1800;
    const id = setInterval(() => {
      setFlightIdx((i) => (i + 1) % orderedEdgeIds.length);
    }, HOP_MS);
    return () => clearInterval(id);
  }, [playerMode, orderedEdgeIds.length]);

  const flightEdgeId =
    playerMode === "play" && orderedEdgeIds.length > 0
      ? orderedEdgeIds[flightIdx % orderedEdgeIds.length]
      : null;

  useEffect(() => {
    if (playerMode === "step" && activeEdgeId) {
      setSelectedEdgeId(activeEdgeId);
    }
  }, [playerMode, activeEdgeId]);

  const { nodes, edges, selectedEdge } = useMemo(() => {
    if (!trace) {
      return { nodes: [] as Node[], edges: [] as Edge[], selectedEdge: null };
    }
    const callers = trace.callers;
    const callees = trace.callees;
    const callersH = callers.length * SIDE_NODE_H + Math.max(0, callers.length - 1) * ROW_GAP_Y;
    const calleesH = callees.length * SIDE_NODE_H + Math.max(0, callees.length - 1) * ROW_GAP_Y;
    const centerY = Math.max(callersH, calleesH, CENTER_NODE_H) / 2;
    const centerX = NODE_W + COL_GAP_X;

    const nodes: Node[] = [];
    const edges: Edge[] = [];

    callers.forEach((c, i) => {
      const y = (callersH - callers.length * SIDE_NODE_H - Math.max(0, callers.length - 1) * ROW_GAP_Y) / 2 +
        i * (SIDE_NODE_H + ROW_GAP_Y) + (centerY - callersH / 2);
      nodes.push({
        id: `caller-${i}`,
        type: "call",
        position: { x: 0, y },
        data: {
          call: c,
          role: "caller",
          drillable: !!c.file && knownPaths.has(c.file),
        } satisfies CallNodeData,
        style: { width: NODE_W, height: SIDE_NODE_H },
        draggable: false,
      });
      edges.push({
        id: `e-caller-${i}`,
        source: `caller-${i}`,
        target: "fn",
        type: "flow",
        data: {
          payload: c.example,
          accent: "#0ea5e9",
          // Match dur to the hop window so the packet completes one pass per hop.
          durationSeconds: 1.6,
          mode: playerMode,
          isActive: `e-caller-${i}` === activeEdgeId,
          inFlight: `e-caller-${i}` === flightEdgeId,
        } satisfies FlowEdgeData,
        style: { stroke: "#0ea5e9", strokeWidth: 1.2 },
        markerEnd: {
          type: MarkerType.ArrowClosed,
          color: "#0ea5e9",
          width: 12,
          height: 12,
        },
      });
    });

    nodes.push({
      id: "fn",
      type: "function",
      position: { x: centerX, y: centerY - CENTER_NODE_H / 2 },
      data: {
        name: trace.function.name,
        params: trace.function.params,
        file: trace.function.file,
        description: trace.description,
      } satisfies FunctionNodeData,
      style: { width: NODE_W, height: CENTER_NODE_H },
      draggable: false,
    });

    callees.forEach((c, i) => {
      const y = (calleesH - callees.length * SIDE_NODE_H - Math.max(0, callees.length - 1) * ROW_GAP_Y) / 2 +
        i * (SIDE_NODE_H + ROW_GAP_Y) + (centerY - calleesH / 2);
      nodes.push({
        id: `callee-${i}`,
        type: "call",
        position: { x: centerX + NODE_W + COL_GAP_X, y },
        data: {
          call: c,
          role: "callee",
          drillable: !!c.file && knownPaths.has(c.file),
        } satisfies CallNodeData,
        style: { width: NODE_W, height: SIDE_NODE_H },
        draggable: false,
      });
      edges.push({
        id: `e-callee-${i}`,
        source: "fn",
        target: `callee-${i}`,
        type: "flow",
        data: {
          payload: c.example,
          accent: "#8b5cf6",
          durationSeconds: 1.6,
          mode: playerMode,
          isActive: `e-callee-${i}` === activeEdgeId,
          inFlight: `e-callee-${i}` === flightEdgeId,
        } satisfies FlowEdgeData,
        style: { stroke: "#8b5cf6", strokeWidth: 1.2 },
        markerEnd: {
          type: MarkerType.ArrowClosed,
          color: "#8b5cf6",
          width: 12,
          height: 12,
        },
      });
    });

    const selectedEdge = selectedEdgeId
      ? (() => {
          if (selectedEdgeId.startsWith("e-caller-")) {
            const i = parseInt(selectedEdgeId.slice("e-caller-".length), 10);
            return callers[i] ? { role: "caller" as const, call: callers[i] } : null;
          }
          if (selectedEdgeId.startsWith("e-callee-")) {
            const i = parseInt(selectedEdgeId.slice("e-callee-".length), 10);
            return callees[i] ? { role: "callee" as const, call: callees[i] } : null;
          }
          return null;
        })()
      : null;

    return { nodes, edges, selectedEdge };
  }, [trace, selectedEdgeId, knownPaths, playerMode, activeEdgeId, flightEdgeId]);

  return (
    <AnimatePresence>
      {open && target ? (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="fixed inset-0 z-40 bg-background/40 backdrop-blur-[2px]"
            onClick={onClose}
          />
          <motion.aside
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", stiffness: 240, damping: 30 }}
            className="fixed right-0 top-0 z-50 flex h-full w-[min(880px,90vw)] flex-col border-l border-border/70 bg-background shadow-[-12px_0_40px_rgba(0,0,0,0.22)]"
          >
            <header className="flex h-12 shrink-0 items-center gap-2 border-b border-border/60 px-4">
              <Sparkles className="h-4 w-4 text-foreground/80" strokeWidth={1.8} />
              <h2 className="text-sm font-semibold">Function trace</h2>
              <button
                type="button"
                aria-label="Close"
                onClick={onClose}
                className="ml-auto flex h-7 w-7 items-center justify-center rounded-md text-muted hover:bg-subtle hover:text-foreground"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </header>
            {history.length > 0 || target ? (
              <div
                className="flex items-center gap-1 overflow-x-auto border-b border-border/40 bg-subtle/30 px-3 py-1.5 text-[11px]"
                style={{ fontFamily: "var(--font-mono), monospace" }}
              >
                {history.map((h, i) => (
                  <span key={`${i}-${h.signature.name}`} className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => onBack(i)}
                      className="truncate rounded-sm px-1 py-0.5 text-muted transition-colors hover:bg-foreground/10 hover:text-foreground"
                      title={h.path}
                    >
                      {h.signature.name}
                    </button>
                    <span className="text-muted/70">›</span>
                  </span>
                ))}
                <span className="truncate font-medium text-foreground">
                  {target.signature.name}
                  {target.signature.params !== undefined
                    ? `(${target.signature.params})`
                    : ""}
                </span>
                <span className="ml-2 truncate text-muted">· {target.path}</span>
              </div>
            ) : null}

            <div className="relative flex-1">
              {loading ? (
                <div className="absolute inset-0 flex items-center justify-center gap-2 text-sm text-muted">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Tracing calls…
                </div>
              ) : error ? (
                <div className="absolute inset-0 flex items-center justify-center p-6">
                  <p className="max-w-md rounded-md border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-[12px] text-rose-700 dark:text-rose-300">
                    {error}
                  </p>
                </div>
              ) : trace ? (
                <ReactFlowProvider>
                  <ReactFlow
                    nodes={nodes}
                    edges={edges}
                    nodeTypes={nodeTypes}
                    edgeTypes={edgeTypes}
                    fitView
                    fitViewOptions={{ padding: 0.18, duration: 0 }}
                    minZoom={0.4}
                    maxZoom={1.6}
                    nodesDraggable={false}
                    nodesConnectable={false}
                    proOptions={{ hideAttribution: true }}
                    onEdgeClick={(_, e) =>
                      setSelectedEdgeId((cur) => (cur === e.id ? null : e.id))
                    }
                    onNodeClick={(_, node) => {
                      if (node.type !== "call") return;
                      const d = node.data as CallNodeData | undefined;
                      if (!d || !d.drillable) return;
                      onNavigate({
                        path: d.call.file,
                        signature: {
                          kind: "function",
                          name: d.call.name,
                        },
                      });
                    }}
                  >
                    <Background
                      variant={BackgroundVariant.Dots}
                      gap={24}
                      size={1}
                      color="var(--rf-grid)"
                    />
                  </ReactFlow>
                  <div className="pointer-events-none absolute left-3 top-3 flex items-center gap-2 rounded-full border border-border/60 bg-background/85 px-2.5 py-1 text-[10px] text-muted shadow-sm backdrop-blur">
                    <ArrowLeftRight className="h-3 w-3" strokeWidth={1.8} />
                    <span>
                      callers ({trace.callers.length}) · callees (
                      {trace.callees.length})
                    </span>
                  </div>
                  {orderedEdgeIds.length > 0 ? (
                    <div className="absolute right-3 top-3 flex items-center gap-1 rounded-full border border-border/60 bg-background/90 px-1.5 py-1 shadow-sm backdrop-blur">
                      {playerMode === "play" ? (
                        <button
                          type="button"
                          onClick={() => {
                            setPlayerMode("step");
                            setStepIdx(0);
                          }}
                          className="flex h-7 items-center gap-1.5 rounded-full px-2.5 text-[10.5px] font-medium text-foreground hover:bg-subtle"
                          title="Step through the request lifecycle"
                        >
                          <Pause className="h-3 w-3" strokeWidth={2} />
                          step through
                        </button>
                      ) : (
                        <>
                          <button
                            type="button"
                            onClick={() =>
                              setStepIdx((i) => Math.max(0, i - 1))
                            }
                            disabled={stepIdx === 0}
                            className="flex h-7 w-7 items-center justify-center rounded-full text-muted hover:bg-subtle hover:text-foreground disabled:opacity-30"
                            title="Previous step"
                          >
                            <ChevronLeft className="h-3.5 w-3.5" />
                          </button>
                          <span className="min-w-[40px] text-center font-mono text-[10.5px] tabular-nums text-foreground">
                            {stepIdx + 1}/{orderedEdgeIds.length}
                          </span>
                          <button
                            type="button"
                            onClick={() =>
                              setStepIdx((i) =>
                                Math.min(orderedEdgeIds.length - 1, i + 1),
                              )
                            }
                            disabled={stepIdx >= orderedEdgeIds.length - 1}
                            className="flex h-7 w-7 items-center justify-center rounded-full text-muted hover:bg-subtle hover:text-foreground disabled:opacity-30"
                            title="Next step"
                          >
                            <ChevronRight className="h-3.5 w-3.5" />
                          </button>
                          <div className="mx-0.5 h-4 w-px bg-border/60" />
                          <button
                            type="button"
                            onClick={() => {
                              setPlayerMode("play");
                              setSelectedEdgeId(null);
                            }}
                            className="flex h-7 items-center gap-1 rounded-full px-2 text-[10.5px] font-medium text-foreground hover:bg-subtle"
                            title="Resume continuous flow"
                          >
                            <Play className="h-3 w-3" strokeWidth={2} />
                            resume
                          </button>
                        </>
                      )}
                    </div>
                  ) : null}
                </ReactFlowProvider>
              ) : null}
            </div>

            {selectedEdge ? (
              <motion.div
                initial={{ y: 16, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: 16, opacity: 0 }}
                className="border-t border-border/60 bg-subtle/30 p-3"
              >
                <div className="mb-1 flex items-center gap-2 text-[10.5px] uppercase tracking-wider text-muted">
                  <span
                    className="rounded-full px-1.5 py-0.5"
                    style={{
                      background:
                        selectedEdge.role === "caller"
                          ? "color-mix(in srgb, #0ea5e9 16%, transparent)"
                          : "color-mix(in srgb, #8b5cf6 16%, transparent)",
                      color:
                        selectedEdge.role === "caller" ? "#0ea5e9" : "#8b5cf6",
                    }}
                  >
                    {selectedEdge.role === "caller" ? "in" : "out"}
                  </span>
                  <span>{selectedEdge.call.name}</span>
                  {selectedEdge.call.file ? (
                    <span
                      className="text-foreground/60"
                      style={{ fontFamily: "var(--font-mono), monospace" }}
                    >
                      · {selectedEdge.call.file}
                    </span>
                  ) : null}
                </div>
                <pre
                  className="overflow-x-auto rounded-md border border-border/50 bg-background p-2 text-[11px] leading-snug text-foreground"
                  style={{ fontFamily: "var(--font-mono), monospace" }}
                >
                  {prettyPayload(selectedEdge.call.example)}
                </pre>
              </motion.div>
            ) : null}
          </motion.aside>
        </>
      ) : null}
    </AnimatePresence>
  );
}
