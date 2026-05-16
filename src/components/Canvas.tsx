"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  BackgroundVariant,
  MiniMap,
  Panel,
  useNodesState,
  useEdgesState,
  useReactFlow,
  useStore,
  type Edge,
  type Node,
  type NodeTypes,
  type EdgeTypes,
  MarkerType,
} from "@xyflow/react";
import { nodeTypes as defaultNodeTypes } from "./nodes";
import { useNodeAccents } from "./useNodeAccents";
import type { NodeAccentKey } from "@/lib/colors";
import { autoLayout, type LayoutDirection } from "@/lib/layout";
import { CanvasToolbar } from "./CanvasToolbar";
import { RelayoutContext } from "./RelayoutContext";
import { TourBar } from "./TourBar";
import { CanvasContextMenu, buildAssistantPrompt } from "./CanvasContextMenu";
import { useAssistant } from "./Assistant";
import type { TourStop } from "@/lib/types";
import { AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

type CanvasProps = {
  nodes: Node[];
  edges: Edge[];
  tour?: TourStop[];
  nodeTypes?: NodeTypes;
  edgeTypes?: EdgeTypes;
};

const TOUR_AUTOPLAY_MS = 5500;

const defaultEdgeOptions = {
  type: "default",
  animated: true,
  style: {
    strokeDasharray: "4 4",
  },
  markerEnd: {
    type: MarkerType.ArrowClosed,
    color: "var(--rf-edge)",
    width: 16,
    height: 16,
  },
};

function MinimapNode({
  x,
  y,
  width,
  height,
  color,
}: {
  x: number;
  y: number;
  width: number;
  height: number;
  color?: string;
}) {
  const fill = color ?? "#888780";
  return (
    <g>
      <rect
        x={x}
        y={y}
        width={width}
        height={height}
        rx={6}
        ry={6}
        fill={fill}
        fillOpacity={0.85}
        stroke="var(--rf-node-stroke)"
        strokeWidth={1}
      />
      <rect
        x={x}
        y={y}
        width={Math.min(8, width * 0.06)}
        height={height}
        rx={3}
        ry={3}
        fill={fill}
      />
    </g>
  );
}

function CanvasInner({
  nodes: initialNodes,
  edges: initialEdges,
  tour,
  nodeTypes = defaultNodeTypes,
  edgeTypes,
}: CanvasProps) {
  const accents = useNodeAccents();
  const styledEdges = useMemo<Edge[]>(
    () =>
      initialEdges.map((edge) => {
        const relationship =
          (edge.data as { relationship?: string } | undefined)?.relationship ??
          "default";
        if (relationship === "risk") {
          return {
            ...edge,
            animated: false,
            className: "edge-risk",
            style: undefined,
            markerEnd: {
              type: MarkerType.ArrowClosed,
              color: "var(--rf-edge-risk)",
              width: 16,
              height: 16,
            },
          };
        }
        const label = (edge.data as { label?: string } | undefined)?.label;
        return label
          ? {
              ...edge,
              label,
              labelBgPadding: [4, 2] as [number, number],
              labelBgBorderRadius: 4,
            }
          : edge;
      }),
    [initialEdges],
  );

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, _setEdges, onEdgesChange] = useEdgesState(styledEdges);

  // Mirror useNodesState's full state so callbacks (which see only RF's filtered
  // store via getNodes) can still read every real node, including hidden ones.
  const nodesRef = useRef(nodes);
  useEffect(() => {
    nodesRef.current = nodes;
  }, [nodes]);

  const { fitView, getNodes, zoomIn, zoomOut, updateNodeData } = useReactFlow();
  const didInitialLayout = useRef(false);

  // ─── Progressive reveal ───
  // Reveal order: tour stop order (if present), then any leftover nodes in JSON order.
  const revealOrder = useMemo<string[]>(() => {
    if (tour && tour.length > 0) {
      const seen = new Set<string>();
      const order: string[] = [];
      for (const s of tour) {
        if (!seen.has(s.nodeId)) {
          seen.add(s.nodeId);
          order.push(s.nodeId);
        }
      }
      for (const n of initialNodes) {
        if (!seen.has(n.id)) {
          order.push(n.id);
          seen.add(n.id);
        }
      }
      return order;
    }
    return initialNodes.map((n) => n.id);
  }, [tour, initialNodes]);

  const [revealedCount, setRevealedCount] = useState(1);
  const totalNodes = revealOrder.length;

  const revealedSet = useMemo(
    () => new Set(revealOrder.slice(0, revealedCount)),
    [revealOrder, revealedCount],
  );

  const revealNext = useCallback(() => {
    setRevealedCount((c) => Math.min(c + 1, totalNodes));
  }, [totalNodes]);
  const revealPrev = useCallback(() => {
    setRevealedCount((c) => Math.max(1, c - 1));
  }, []);
  const revealAll = useCallback(() => setRevealedCount(totalNodes), [
    totalNodes,
  ]);
  const resetReveal = useCallback(() => setRevealedCount(1), []);
  const revealNode = useCallback(
    (nodeId: string) => {
      const idx = revealOrder.indexOf(nodeId);
      if (idx >= 0) {
        setRevealedCount((c) => Math.max(c, idx + 1));
      }
    },
    [revealOrder],
  );

  // Re-read current nodes (with measured dims) from React Flow's internal store.
  // useStore is reactive so this triggers when measurements arrive.
  const measuredReadyCount = useStore(
    (s) =>
      Array.from(s.nodeLookup.values()).filter(
        (n) => n.measured?.width && n.measured?.height,
      ).length,
  );

  // Relayout the currently-visible real nodes only. The + bubble is rendered
  // inside each node by NodeShell — no separate placeholder nodes needed.
  const layoutVisible = useCallback(
    (opts: { duration?: number; focusId?: string | null } = {}) => {
      const allReal = nodesRef.current;
      const visible = allReal.filter((n) => revealedSet.has(n.id));
      if (visible.length === 0) return;
      const visibleEdges = styledEdges.filter(
        (e) => revealedSet.has(e.source) && revealedSet.has(e.target),
      );
      const laidOut = autoLayout(visible, visibleEdges, "LR");
      const posMap = new Map(laidOut.map((n) => [n.id, n.position]));
      setNodes((prev) =>
        prev.map((n) => {
          const pos = posMap.get(n.id);
          return pos ? { ...n, position: pos } : n;
        }),
      );
      requestAnimationFrame(() => {
        if (opts.focusId) {
          fitView({
            nodes: [{ id: opts.focusId }],
            padding: 0.42,
            duration: opts.duration ?? 500,
            minZoom: 0.7,
            maxZoom: 1.5,
          });
        } else {
          fitView({
            nodes: laidOut.map((n) => ({ id: n.id })),
            padding: 0.2,
            duration: opts.duration ?? 500,
          });
        }
      });
    },
    [setNodes, styledEdges, revealedSet, fitView],
  );

  // Track which revealedCount we last laid out for, so we don't re-fire as
  // measurements settle or as positions update from layoutVisible itself.
  const lastLayoutForReveal = useRef(-1);

  // Initial + on-reveal layout. Wait for currently-visible nodes to be
  // measured before laying out. Runs once per revealedCount.
  useEffect(() => {
    if (lastLayoutForReveal.current === revealedCount) return;
    if (measuredReadyCount === 0) return;
    const all = getNodes();
    const visible = all.filter((n) => revealedSet.has(n.id));
    if (visible.length === 0) return;
    if (!visible.every((n) => n.measured?.width && n.measured?.height)) return;
    lastLayoutForReveal.current = revealedCount;
    didInitialLayout.current = true;
    layoutVisible();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [revealedCount, measuredReadyCount]);

  const relayout = useCallback(
    (_direction: LayoutDirection = "LR") => {
      layoutVisible();
    },
    [layoutVisible],
  );

  const reset = useCallback(() => {
    setNodes(initialNodes);
    setRevealedCount(1);
    didInitialLayout.current = false;
    lastLayoutForReveal.current = -1;
  }, [initialNodes, setNodes]);

  const onFit = useCallback(() => {
    fitView({ padding: 0.18, duration: 500 });
  }, [fitView]);

  const onZoomIn = useCallback(() => zoomIn({ duration: 220 }), [zoomIn]);
  const onZoomOut = useCallback(() => zoomOut({ duration: 220 }), [zoomOut]);

  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [contextMenu, setContextMenu] = useState<
    { x: number; y: number; node: Node } | null
  >(null);
  const assistant = useAssistant();

  // ─── Tour state ───
  const [tourActive, setTourActive] = useState(false);
  const [tourIndex, setTourIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const stops = tour ?? [];
  const currentStop = tourActive ? (stops[tourIndex] ?? null) : null;
  const focusId = currentStop?.nodeId ?? hoveredId;

  const startTour = useCallback(() => {
    if (stops.length === 0) return;
    setTourIndex(0);
    setTourActive(true);
    setIsPlaying(true);
    setRevealedCount(1);
  }, [stops.length]);
  const exitTour = useCallback(() => {
    setTourActive(false);
    setIsPlaying(false);
  }, []);
  const playTour = useCallback(() => setIsPlaying(true), []);
  const pauseTour = useCallback(() => setIsPlaying(false), []);
  const nextStop = useCallback(() => {
    setTourIndex((i) => {
      if (i >= stops.length - 1) {
        setIsPlaying(false);
        return i;
      }
      return i + 1;
    });
  }, [stops.length]);
  const prevStop = useCallback(() => {
    setTourIndex((i) => Math.max(0, i - 1));
  }, []);
  const restartTour = useCallback(() => {
    setTourIndex(0);
    setIsPlaying(true);
  }, []);

  const focusCamera = useCallback(
    (nodeId: string, opts: { duration?: number } = {}) => {
      fitView({
        nodes: [{ id: nodeId }],
        padding: 0.42,
        duration: opts.duration ?? 700,
        minZoom: 0.7,
        maxZoom: 1.5,
      });
    },
    [fitView],
  );

  // As the tour advances, reveal the corresponding node (if not already).
  useEffect(() => {
    if (!tourActive || !currentStop) return;
    const idx = revealOrder.indexOf(currentStop.nodeId);
    if (idx >= 0) {
      setRevealedCount((c) => Math.max(c, idx + 1));
    }
  }, [tourActive, currentStop, revealOrder]);

  // Camera focus on the current stop.
  useEffect(() => {
    if (!tourActive || !currentStop) return;
    focusCamera(currentStop.nodeId);
  }, [tourActive, currentStop, focusCamera]);

  // While the tour is active, force the focused ChangeCard expanded and
  // collapse any other ChangeCards. Outside the tour we leave user state alone.
  useEffect(() => {
    if (!tourActive) return;
    const targetId = currentStop?.nodeId ?? null;
    const all = getNodes();
    for (const n of all) {
      if (n.type !== "change") continue;
      const want = n.id === targetId;
      const cur = (n.data as { expanded?: boolean })?.expanded === true;
      if (want !== cur) {
        updateNodeData(n.id, { expanded: want });
      }
    }
  }, [tourActive, currentStop, getNodes, updateNodeData]);

  // Autoplay timer.
  useEffect(() => {
    if (!tourActive || !isPlaying) return;
    const handle = setTimeout(nextStop, TOUR_AUTOPLAY_MS);
    return () => clearTimeout(handle);
  }, [tourActive, isPlaying, tourIndex, nextStop]);

  // Called by a node when its rendered size changes (e.g. ChangeCard expand).
  // Relayout the visible subset so neighbours move out of the way; in tour
  // mode the camera stays on the focused stop.
  const onNodeResize = useCallback(() => {
    layoutVisible({
      focusId: tourActive && currentStop ? currentStop.nodeId : undefined,
      duration: 500,
    });
  }, [layoutVisible, tourActive, currentStop]);

  const connectedIds = useMemo(() => {
    if (!focusId) return null;
    const set = new Set<string>([focusId]);
    for (const e of edges) {
      if (e.source === focusId) set.add(e.target);
      if (e.target === focusId) set.add(e.source);
    }
    return set;
  }, [focusId, edges]);

  // For each revealed node, find its first hidden direct successor (if any).
  const hiddenSuccessorMap = useMemo<Map<string, string>>(() => {
    const map = new Map<string, string>();
    for (const e of edges) {
      if (!revealedSet.has(e.source)) continue;
      if (revealedSet.has(e.target)) continue;
      if (map.has(e.source)) continue;
      map.set(e.source, e.target);
    }
    return map;
  }, [edges, revealedSet]);

  const hiddenSuccessorOf = useCallback(
    (nodeId: string) => hiddenSuccessorMap.get(nodeId) ?? null,
    [hiddenSuccessorMap],
  );

  const displayNodes = useMemo(() => {
    const visibleReal = nodes.filter((n) => revealedSet.has(n.id));
    if (!focusId || !connectedIds) return visibleReal;
    return visibleReal.map((n) => {
      if (n.id === focusId && tourActive) {
        return { ...n, className: cn(n.className, "tour-spotlight") };
      }
      return connectedIds.has(n.id)
        ? n
        : { ...n, className: cn(n.className, "is-dim") };
    });
  }, [nodes, revealedSet, focusId, connectedIds, tourActive]);

  const displayEdges = useMemo(() => {
    const visible = edges.filter(
      (e) => revealedSet.has(e.source) && revealedSet.has(e.target),
    );
    if (!focusId) return visible;
    return visible.map((e) =>
      e.source === focusId || e.target === focusId
        ? e
        : { ...e, className: cn(e.className, "is-dim") },
    );
  }, [edges, revealedSet, focusId]);

  const onNodeMouseEnter = useCallback(
    (_: React.MouseEvent, node: Node) => {
      if (tourActive) return;
      setHoveredId(node.id);
    },
    [tourActive],
  );
  const onNodeMouseLeave = useCallback(() => {
    if (tourActive) return;
    setHoveredId(null);
  }, [tourActive]);

  const contextValue = useMemo(
    () => ({ relayout, onNodeResize, revealNode, hiddenSuccessorOf }),
    [relayout, onNodeResize, revealNode, hiddenSuccessorOf],
  );

  // ─── Keyboard shortcuts ───
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const t = e.target as HTMLElement | null;
      const tag = t?.tagName;
      if (
        tag === "INPUT" ||
        tag === "TEXTAREA" ||
        t?.isContentEditable
      )
        return;

      if (e.key === "f" || e.key === "F") {
        e.preventDefault();
        onFit();
        return;
      }
      if (e.key === "r" || e.key === "R") {
        e.preventDefault();
        reset();
        return;
      }
      if (e.key === "e" || e.key === "E") {
        e.preventDefault();
        revealAll();
        return;
      }
      if (e.key === "c" || e.key === "C") {
        e.preventDefault();
        resetReveal();
        return;
      }
      if (e.key === "n" || e.key === "N" || e.key === "+" || e.key === "=") {
        e.preventDefault();
        revealNext();
        return;
      }
      if (e.key === "p" || e.key === "P" || e.key === "-") {
        e.preventDefault();
        revealPrev();
        return;
      }
      if (e.key === "Escape") {
        if (tourActive) {
          e.preventDefault();
          exitTour();
        }
        return;
      }
      if (!tourActive) {
        if (e.key === "t" || e.key === "T") {
          if (stops.length > 0) {
            e.preventDefault();
            startTour();
          }
        }
        return;
      }
      if (e.key === " ") {
        e.preventDefault();
        if (isPlaying) pauseTour();
        else playTour();
        return;
      }
      if (e.key === "ArrowRight") {
        e.preventDefault();
        nextStop();
        return;
      }
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        prevStop();
        return;
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [
    onFit,
    reset,
    tourActive,
    isPlaying,
    exitTour,
    playTour,
    pauseTour,
    nextStop,
    prevStop,
    startTour,
    stops.length,
    revealAll,
    resetReveal,
    revealNext,
    revealPrev,
  ]);

  return (
    <RelayoutContext.Provider value={contextValue}>
      <div className="h-full w-full">
        <ReactFlow
          nodes={displayNodes}
          edges={displayEdges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onNodeMouseEnter={onNodeMouseEnter}
          onNodeMouseLeave={onNodeMouseLeave}
          onNodeContextMenu={(e, node) => {
            e.preventDefault();
            setContextMenu({ x: e.clientX, y: e.clientY, node });
          }}
          onPaneClick={() => setContextMenu(null)}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          defaultEdgeOptions={defaultEdgeOptions}
          fitView
          fitViewOptions={{ padding: 0.18, duration: 0 }}
          minZoom={0.2}
          maxZoom={2}
          proOptions={{ hideAttribution: true }}
          nodesDraggable
          nodesConnectable={false}
        >
          <Background
            variant={BackgroundVariant.Dots}
            gap={24}
            size={1}
            color="var(--rf-grid)"
          />
          <MiniMap
            position="top-right"
            pannable
            zoomable
            nodeColor={(node) =>
              accents[(node.type ?? "diff") as NodeAccentKey] ?? "#888780"
            }
            nodeComponent={MinimapNode}
            ariaLabel="Canvas minimap"
          />
          <Panel position="top-left">
            <CanvasToolbar
              revealedCount={revealedCount}
              totalNodes={totalNodes}
              onRevealNext={revealNext}
              onRevealPrev={revealPrev}
              onRevealAll={revealAll}
              onResetReveal={resetReveal}
              onAutoLayout={() => relayout("LR")}
              onReset={reset}
              onFit={onFit}
              onZoomIn={onZoomIn}
              onZoomOut={onZoomOut}
              onStartTour={
                stops.length > 0 && !tourActive ? startTour : undefined
              }
            />
          </Panel>
          {stops.length > 0 ? (
            <Panel position="bottom-center" className="!pointer-events-none">
              <AnimatePresence>
                {tourActive ? (
                  <TourBar
                    key="tourbar"
                    stops={stops}
                    index={tourIndex}
                    isPlaying={isPlaying}
                    onPlay={playTour}
                    onPause={pauseTour}
                    onNext={nextStop}
                    onPrev={prevStop}
                    onRestart={restartTour}
                    onExit={exitTour}
                  />
                ) : null}
              </AnimatePresence>
            </Panel>
          ) : null}
        </ReactFlow>
        {contextMenu ? (
          <CanvasContextMenu
            state={contextMenu}
            onExplain={() => {
              assistant.open(buildAssistantPrompt(contextMenu.node));
              setContextMenu(null);
            }}
            onClose={() => setContextMenu(null)}
          />
        ) : null}
      </div>
    </RelayoutContext.Provider>
  );
}

export function Canvas(props: CanvasProps) {
  return (
    <ReactFlowProvider>
      <CanvasInner {...props} />
    </ReactFlowProvider>
  );
}
