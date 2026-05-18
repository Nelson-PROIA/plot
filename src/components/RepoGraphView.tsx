"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  BackgroundVariant,
  MarkerType,
  MiniMap,
  Panel,
  type Edge,
  type Node,
  type NodeProps,
} from "@xyflow/react";
import { getOctokit } from "@/lib/octokit-client";
import { motion } from "framer-motion";
import {
  ChevronLeft,
  ChevronsDownUp,
  ChevronsUpDown,
  ExternalLink,
  GitBranch,
  GitPullRequest,
  Loader2,
  Plus,
  RefreshCw,
  ShieldAlert,
  Sparkles,
} from "lucide-react";
import { useConfig } from "@/components/ConfigContext";
import { usePresentation } from "@/components/PresentationContext";
import { useAssistant, useAssistantContext } from "@/components/Assistant";
import { ThemeToggle } from "@/components/ThemeToggle";
import { AuditPanel } from "@/components/AuditPanel";
import { FunctionTracePanel } from "@/components/FunctionTracePanel";
import { getRepoSource } from "@/lib/repo-source/factory";
import type { PRSummary, RepoMeta } from "@/lib/repo-source/types";
import {
  buildRepoGraph,
  isStale,
  loadCachedGraph,
  saveGraph,
} from "@/lib/repo-graph/builder";
import type { RepoGraph } from "@/lib/repo-graph/types";
import { cn } from "@/lib/utils";

const PR_COLORS = [
  "#8b5cf6",
  "#0ea5e9",
  "#f59e0b",
  "#ec4899",
  "#10b981",
  "#ef4444",
];

const GROUP_COLORS = [
  "#a78bfa",
  "#2dd4bf",
  "#60a5fa",
  "#fbbf24",
  "#f87171",
  "#a8a29e",
  "#34d399",
  "#fb7185",
];

const FILE_W = 220;
const FILE_H = 26;
const FILE_GAP = 6;
const SIG_ROW_H = 22;
const SIG_PADDING_Y = 8;
const GROUP_PADDING = 14;
const GROUP_HEADER = 30;
const GROUP_GAP_X = 56;
const GROUP_GAP_Y = 40;

function fileHeight(
  path: string,
  expanded: Set<string>,
  signatures: Map<string, Signature[] | "loading" | "error">,
): number {
  if (!expanded.has(path)) return FILE_H;
  const sigs = signatures.get(path);
  const rows =
    sigs === undefined || sigs === "loading" || sigs === "error"
      ? 1
      : Math.max(1, sigs.length);
  return FILE_H + SIG_PADDING_Y * 2 + rows * SIG_ROW_H;
}

type FileNodeData = {
  fileName: string;
  fullPath: string;
  kind: string;
  group: string;
  groupColor: string;
  touchedBy: { number: number; title: string; color: string }[];
  onOpenPR: (n: number) => void;
  expanded: boolean;
  signatures: Signature[] | "loading" | "error" | null;
  onToggleExpand: (path: string) => void;
  onExploreSignature: (path: string, sig: Signature) => void;
};

type GroupNodeData = {
  label: string;
  color: string;
  count: number;
  dimmed: boolean;
};

function FileNode({ data, selected }: NodeProps<Node<FileNodeData, "file">>) {
  const accent = data.touchedBy[0]?.color ?? data.groupColor;
  const isTouched = data.touchedBy.length > 0;
  const sigs = data.signatures;
  return (
    <div
      style={{
        width: FILE_W,
        borderColor: selected
          ? "var(--fg)"
          : isTouched
            ? accent
            : "var(--border)",
        background: isTouched
          ? `color-mix(in srgb, ${accent} 8%, var(--subtle))`
          : "var(--subtle)",
      }}
      className="group relative flex flex-col overflow-hidden rounded-md border text-[10.5px] text-foreground transition-colors duration-200 hover:border-foreground/50"
    >
      <span
        aria-hidden
        className="absolute left-0 top-0 h-full w-[3px]"
        style={{ background: data.groupColor }}
      />
      <div className="flex h-[26px] shrink-0 items-center gap-1.5 pl-2 pr-1">
        <button
          type="button"
          onMouseDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            data.onToggleExpand(data.fullPath);
          }}
          className="nodrag flex h-4 w-4 shrink-0 items-center justify-center rounded text-muted hover:bg-foreground/10 hover:text-foreground"
          aria-label={data.expanded ? "Collapse signatures" : "Expand signatures"}
        >
          <Chevron expanded={data.expanded} />
        </button>
        <span
          className="ml-0.5 min-w-0 flex-1 truncate font-mono"
          style={{ fontFamily: "var(--font-mono), monospace" }}
        >
          {data.fileName}
        </span>
        {data.touchedBy.length > 0 ? (
          <button
            type="button"
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              if (data.touchedBy[0]) data.onOpenPR(data.touchedBy[0].number);
            }}
            className="nodrag shrink-0 rounded-full px-1.5 text-[9px] font-medium leading-[14px] transition-transform hover:scale-110"
            style={{
              background: `color-mix(in srgb, ${accent} 20%, transparent)`,
              color: accent,
            }}
          >
            {data.touchedBy.length === 1
              ? `#${data.touchedBy[0].number}`
              : `${data.touchedBy.length}prs`}
          </button>
        ) : null}
      </div>
      {data.expanded ? (
        <div
          className="flex flex-col gap-0.5 border-t border-border/40 px-2 py-1.5"
          style={{
            background:
              "color-mix(in srgb, var(--subtle) 75%, var(--background))",
          }}
        >
          {sigs === "loading" || sigs === null ? (
            <span className="inline-flex items-center gap-1.5 px-1 py-0.5 text-[10px] text-muted">
              <Loader2 className="h-3 w-3 animate-spin" />
              Reading…
            </span>
          ) : sigs === "error" ? (
            <span className="px-1 py-0.5 text-[10px] text-rose-500">
              Couldn't read this file.
            </span>
          ) : sigs.length === 0 ? (
            <span className="px-1 py-0.5 text-[10px] text-muted/80">
              No exports detected.
            </span>
          ) : (
            sigs.map((sig, i) => (
              <button
                key={`${sig.kind}-${sig.name}-${i}`}
                type="button"
                onMouseDown={(e) => e.stopPropagation()}
                onClick={(e) => {
                  e.stopPropagation();
                  data.onExploreSignature(data.fullPath, sig);
                }}
                className="nodrag flex items-center gap-1.5 rounded-sm px-1 py-0.5 text-left text-[10.5px] hover:bg-foreground/8"
                style={{ height: SIG_ROW_H }}
                title="Trace this function with AI"
              >
                <SignatureKindBadge kind={sig.kind} />
                <span
                  className="min-w-0 flex-1 truncate font-mono"
                  style={{ fontFamily: "var(--font-mono), monospace" }}
                >
                  <span className="text-foreground">{sig.name}</span>
                  {sig.params !== undefined ? (
                    <span className="text-muted">({sig.params})</span>
                  ) : null}
                </span>
              </button>
            ))
          )}
        </div>
      ) : null}
    </div>
  );
}

function Chevron({ expanded }: { expanded: boolean }) {
  return (
    <svg
      width="9"
      height="9"
      viewBox="0 0 9 9"
      fill="none"
      style={{
        transform: expanded ? "rotate(90deg)" : "rotate(0deg)",
        transition: "transform 120ms",
      }}
    >
      <path
        d="M2.5 1.5L6 4.5L2.5 7.5"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function SignatureKindBadge({ kind }: { kind: Signature["kind"] }) {
  const map: Record<Signature["kind"], { label: string; color: string }> = {
    function: { label: "fn", color: "#8b5cf6" },
    default: { label: "fn", color: "#8b5cf6" },
    class: { label: "cls", color: "#0ea5e9" },
    interface: { label: "iface", color: "#0ea5e9" },
    type: { label: "type", color: "#10b981" },
    enum: { label: "enum", color: "#f59e0b" },
    const: { label: "const", color: "#64748b" },
  };
  const { label, color } = map[kind];
  return (
    <span
      className="inline-flex h-[14px] shrink-0 items-center rounded px-1 text-[9px] font-medium uppercase tracking-wide"
      style={{
        background: `color-mix(in srgb, ${color} 18%, transparent)`,
        color,
        fontFamily: "var(--font-mono), monospace",
      }}
    >
      {label}
    </span>
  );
}

function GroupBoxNode({
  data,
}: NodeProps<Node<GroupNodeData, "groupBox">>) {
  const accent = data.color;
  return (
    <div
      className="relative h-full w-full rounded-xl border border-dashed transition-opacity"
      style={{
        borderColor: `color-mix(in srgb, ${accent} 38%, var(--border))`,
        background: `color-mix(in srgb, ${accent} 5%, transparent)`,
        opacity: data.dimmed ? 0.35 : 1,
      }}
    >
      <div
        className="flex h-[26px] items-center gap-2 rounded-t-xl border-b border-dashed px-3"
        style={{
          borderColor: `color-mix(in srgb, ${accent} 28%, var(--border))`,
          background: `color-mix(in srgb, ${accent} 9%, var(--background))`,
        }}
      >
        <span
          aria-hidden
          className="h-1.5 w-1.5 rounded-full"
          style={{ background: accent }}
        />
        <span
          className="text-[10px] font-medium uppercase tracking-[0.08em]"
          style={{
            color: accent,
            fontFamily: "var(--font-mono), monospace",
          }}
        >
          {data.label}
        </span>
        <span className="ml-auto text-[9.5px] text-muted">
          {data.count} file{data.count === 1 ? "" : "s"}
        </span>
      </div>
    </div>
  );
}

const nodeTypes = { file: FileNode, groupBox: GroupBoxNode };

type GroupBox = {
  id: string;
  group: string;
  x: number;
  y: number;
  w: number;
  h: number;
};

type FilePos = {
  parentId: string;
  x: number;
  y: number;
};

function layoutGrouped(
  files: RepoGraph["files"],
  groups: string[],
  heightFor: (path: string) => number,
): { groupBoxes: GroupBox[]; filePositions: Map<string, FilePos> } {
  const byGroup = new Map<string, RepoGraph["files"]>();
  for (const g of groups) byGroup.set(g, []);
  for (const f of files) {
    const bucket = byGroup.get(f.group) ?? [];
    bucket.push(f);
    byGroup.set(f.group, bucket);
  }
  byGroup.forEach((bucket) =>
    bucket.sort((a, b) => a.path.localeCompare(b.path)),
  );

  const ordered = [...groups].sort(
    (a, b) => (byGroup.get(b)?.length ?? 0) - (byGroup.get(a)?.length ?? 0),
  );

  const groupW = FILE_W + GROUP_PADDING * 2;
  const cols = Math.max(1, Math.min(4, Math.ceil(Math.sqrt(ordered.length))));
  const colHeights = new Array(cols).fill(0);

  const groupBoxes: GroupBox[] = [];
  const filePositions = new Map<string, FilePos>();

  ordered.forEach((g) => {
    const bucket = byGroup.get(g) ?? [];
    const heights = bucket.map((f) => heightFor(f.path));
    const inner = heights.reduce((s, h) => s + h, 0) +
      Math.max(0, bucket.length - 1) * FILE_GAP;
    const h = GROUP_HEADER + GROUP_PADDING + Math.max(FILE_H, inner) + GROUP_PADDING;

    let col = 0;
    for (let i = 1; i < cols; i++) {
      if (colHeights[i] < colHeights[col]) col = i;
    }
    const x = col * (groupW + GROUP_GAP_X);
    const y = colHeights[col];
    colHeights[col] = y + h + GROUP_GAP_Y;

    const id = `group:${g}`;
    groupBoxes.push({ id, group: g, x, y, w: groupW, h });

    let cursor = GROUP_HEADER + GROUP_PADDING;
    bucket.forEach((f, idx) => {
      filePositions.set(f.path, {
        parentId: id,
        x: GROUP_PADDING,
        y: cursor,
      });
      cursor += heights[idx] + FILE_GAP;
    });
  });

  return { groupBoxes, filePositions };
}

type ContextMenu = {
  x: number;
  y: number;
  filePath: string;
  groupColor: string;
} | null;

import type { Signature } from "@/app/api/repo/signatures/route";

export function RepoGraphView() {
  const router = useRouter();
  const { mode, repo, token, openaiKey } = useConfig();
  const { presenting } = usePresentation();
  const assistant = useAssistant();
  const [graph, setGraph] = useState<RepoGraph | null>(null);
  const [meta, setMeta] = useState<RepoMeta | null>(null);
  const [prs, setPRs] = useState<PRSummary[]>([]);
  const [prFiles, setPrFiles] = useState<Map<number, Set<string>>>(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  const [contextMenu, setContextMenu] = useState<ContextMenu>(null);
  const [selectedFiles, setSelectedFiles] = useState<string[]>([]);
  const [focusedPR, setFocusedPR] = useState<number | null>(null);
  const [focusedGroup, setFocusedGroup] = useState<string | null>(null);
  const [auditOpen, setAuditOpen] = useState(false);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [signatures, setSignatures] = useState<
    Map<string, Signature[] | "loading" | "error">
  >(new Map());
  const [traceTarget, setTraceTarget] = useState<{
    path: string;
    signature: Signature;
  } | null>(null);
  const [traceHistory, setTraceHistory] = useState<
    Array<{ path: string; signature: Signature }>
  >([]);

  const auditSource = useMemo(() => {
    if (mode !== "live" || !repo) return null;
    try {
      return getRepoSource(mode, repo, token);
    } catch {
      return null;
    }
  }, [mode, repo, token]);

  useEffect(() => {
    if (mode !== "live" || !repo) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        let g = loadCachedGraph(repo);
        if (!g || tick > 0) {
          g = await buildRepoGraph(repo, token);
          saveGraph(repo, g);
        }
        if (cancelled) return;
        setGraph(g);

        const source = auditSource ?? getRepoSource(mode, repo, token);
        const [m, list] = await Promise.all([source.meta(), source.listPRs()]);
        if (cancelled) return;
        setMeta(m);
        setPRs(list);

        const octokit = getOctokit(token);
        const fileMap = new Map<number, Set<string>>();
        await Promise.all(
          list.map(async (pr) => {
            const { data } = await octokit.rest.pulls.listFiles({
              owner: repo.owner,
              repo: repo.repo,
              pull_number: pr.number,
              per_page: 100,
            });
            fileMap.set(pr.number, new Set(data.map((f) => f.filename)));
          }),
        );
        if (cancelled) return;
        setPrFiles(fileMap);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [mode, repo, token, tick]);

  const prColorFor = useMemo(() => {
    const map = new Map<number, string>();
    prs.forEach((pr, i) => map.set(pr.number, PR_COLORS[i % PR_COLORS.length]));
    return (n: number) => map.get(n) ?? PR_COLORS[0];
  }, [prs]);

  const groupColorFor = useMemo(() => {
    if (!graph) return () => GROUP_COLORS[0];
    const map = new Map<string, string>();
    graph.groups.forEach((g, i) =>
      map.set(g, GROUP_COLORS[i % GROUP_COLORS.length]),
    );
    return (g: string) => map.get(g) ?? GROUP_COLORS[0];
  }, [graph]);

  const openPR = useCallback(
    (n: number) => router.push(`/pr/${n}`),
    [router],
  );

  const fetchSignatures = useCallback(
    async (paths: string[]) => {
      if (!repo || paths.length === 0) return;
      setSignatures((cur) => {
        const next = new Map(cur);
        for (const p of paths) if (!next.has(p)) next.set(p, "loading");
        return next;
      });
      try {
        const res = await fetch("/api/repo/signatures", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(token ? { "x-github-token": token } : {}),
          },
          body: JSON.stringify({
            owner: repo.owner,
            repo: repo.repo,
            ref: graph?.defaultBranch,
            paths,
          }),
        });
        if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`);

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        const stillLoading = new Set(paths);

        // eslint-disable-next-line no-constant-condition
        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          let idx: number;
          while ((idx = buffer.indexOf("\n\n")) >= 0) {
            const chunk = buffer.slice(0, idx).trim();
            buffer = buffer.slice(idx + 2);
            if (!chunk) continue;
            for (const line of chunk.split("\n")) {
              if (!line.startsWith("data:")) continue;
              const payload = line.slice(5).trim();
              if (payload === "[DONE]") continue;
              try {
                const evt = JSON.parse(payload) as {
                  path?: string;
                  signatures?: Signature[];
                };
                if (!evt.path) continue;
                stillLoading.delete(evt.path);
                setSignatures((cur) => {
                  const next = new Map(cur);
                  next.set(evt.path!, evt.signatures ?? []);
                  return next;
                });
              } catch {
                /* skip malformed */
              }
            }
          }
        }
        // Anything that didn't arrive — mark as error.
        if (stillLoading.size > 0) {
          setSignatures((cur) => {
            const next = new Map(cur);
            for (const p of stillLoading) next.set(p, "error");
            return next;
          });
        }
      } catch {
        setSignatures((cur) => {
          const next = new Map(cur);
          for (const p of paths) next.set(p, "error");
          return next;
        });
      }
    },
    [repo, token, graph?.defaultBranch],
  );

  const toggleExpand = useCallback(
    (path: string) => {
      setExpanded((cur) => {
        const next = new Set(cur);
        if (next.has(path)) {
          next.delete(path);
        } else {
          next.add(path);
          if (!signatures.has(path)) fetchSignatures([path]);
        }
        return next;
      });
    },
    [signatures, fetchSignatures],
  );

  const expandAll = useCallback(() => {
    if (!graph) return;
    const all = graph.files.map((f) => f.path);
    setExpanded(new Set(all));
    const need = all.filter((p) => !signatures.has(p));
    if (need.length > 0) fetchSignatures(need);
  }, [graph, signatures, fetchSignatures]);

  const collapseAll = useCallback(() => setExpanded(new Set()), []);

  const exploreSignature = useCallback((path: string, sig: Signature) => {
    setTraceHistory([]);
    setTraceTarget({ path, signature: sig });
  }, []);

  const navigateTrace = useCallback(
    (next: { path: string; signature: Signature }) => {
      setTraceHistory((h) => (traceTarget ? [...h, traceTarget] : h));
      setTraceTarget(next);
    },
    [traceTarget],
  );

  const backTrace = useCallback((idx: number) => {
    setTraceHistory((h) => {
      const target = h[idx];
      if (!target) return h;
      setTraceTarget(target);
      return h.slice(0, idx);
    });
  }, []);

  const closeTrace = useCallback(() => {
    setTraceTarget(null);
    setTraceHistory([]);
  }, []);

  const knownPaths = useMemo(
    () => new Set((graph?.files ?? []).map((f) => f.path)),
    [graph],
  );

  const { nodes, edges } = useMemo(() => {
    if (!graph) return { nodes: [] as Node[], edges: [] as Edge[] };

    const { groupBoxes, filePositions } = layoutGrouped(
      graph.files,
      graph.groups,
      (path) => fileHeight(path, expanded, signatures),
    );

    const visibleIds = new Set(graph.files.map((f) => f.path));

    // A file is "focused" if it passes whichever focus mode is active.
    // PR focus takes precedence; group focus applies when no PR is focused.
    const prFocusSet =
      focusedPR != null ? (prFiles.get(focusedPR) ?? new Set<string>()) : null;
    const focusedSet: Set<string> | null = prFocusSet
      ? prFocusSet
      : focusedGroup != null
        ? new Set(
            graph.files.filter((f) => f.group === focusedGroup).map((f) => f.path),
          )
        : null;

    const groupHasTouched = (g: string) =>
      focusedSet
        ? graph.files.some((f) => f.group === g && focusedSet.has(f.path))
        : true;

    const groupNodes: Node[] = groupBoxes.map((box) => ({
      id: box.id,
      type: "groupBox",
      position: { x: box.x, y: box.y },
      style: {
        width: box.w,
        height: box.h,
        zIndex: 0,
        pointerEvents: "none",
      },
      data: {
        label: box.group,
        color: groupColorFor(box.group),
        count: graph.files.filter((f) => f.group === box.group).length,
        dimmed: focusedSet ? !groupHasTouched(box.group) : false,
      } satisfies GroupNodeData,
      draggable: false,
      selectable: false,
      focusable: false,
    }));

    const fileNodes: Node[] = graph.files.map((f) => {
      const touchedBy: FileNodeData["touchedBy"] = [];
      for (const pr of prs) {
        const set = prFiles.get(pr.number);
        if (set && set.has(f.path)) {
          touchedBy.push({
            number: pr.number,
            title: pr.title,
            color: prColorFor(pr.number),
          });
        }
      }
      const dimmed = focusedSet ? !focusedSet.has(f.path) : false;
      const pos = filePositions.get(f.path) ?? {
        parentId: `group:${f.group}`,
        x: GROUP_PADDING,
        y: GROUP_HEADER + GROUP_PADDING,
      };
      const isExpanded = expanded.has(f.path);
      const sigs = signatures.get(f.path);
      return {
        id: f.path,
        type: "file",
        position: { x: pos.x, y: pos.y },
        parentId: pos.parentId,
        extent: "parent",
        data: {
          fileName: f.path,
          fullPath: f.path,
          kind: f.kind,
          group: f.group,
          groupColor: groupColorFor(f.group),
          touchedBy,
          onOpenPR: openPR,
          expanded: isExpanded,
          signatures: sigs ?? null,
          onToggleExpand: toggleExpand,
          onExploreSignature: exploreSignature,
        } satisfies FileNodeData,
        draggable: false,
        style: dimmed ? { opacity: 0.22 } : undefined,
        className: dimmed ? "is-dim" : undefined,
      };
    });

    const edgeList: Edge[] = graph.edges
      .filter((e) => visibleIds.has(e.source) && visibleIds.has(e.target))
      .map((e) => {
        const edgeDim =
          focusedSet
            ? !(focusedSet.has(e.source) && focusedSet.has(e.target))
            : false;
        return {
          id: e.id,
          source: e.source,
          target: e.target,
          type: "smoothstep" as const,
          pathOptions: { borderRadius: 12 },
          style: {
            stroke: "var(--rf-edge)",
            strokeWidth: 1,
            opacity: edgeDim ? 0.08 : 0.5,
          },
          markerEnd: {
            type: MarkerType.ArrowClosed,
            color: "var(--rf-edge)",
            width: 10,
            height: 10,
          },
        };
      });

    // Group containers must appear before children for parentId resolution.
    return { nodes: [...groupNodes, ...fileNodes], edges: edgeList };
  }, [
    graph,
    prs,
    prFiles,
    prColorFor,
    groupColorFor,
    openPR,
    focusedPR,
    focusedGroup,
    expanded,
    signatures,
    toggleExpand,
    exploreSignature,
  ]);

  // Assistant context
  useAssistantContext(
    "repo-graph",
    graph
      ? {
          scope: "repo",
          label: "repo graph",
          content: `Repository file tree (${graph.files.length} files in ${graph.groups.length} groups):\n${graph.groups
            .map((g) => {
              const files = graph.files
                .filter((f) => f.group === g)
                .map((f) => f.path)
                .slice(0, 40);
              return `[${g}]\n${files.join("\n")}`;
            })
            .join("\n\n")}\n\nImport edges: ${graph.edges.length}.\n\nOpen PRs:\n${prs
            .map(
              (p) =>
                `#${p.number} ${p.title} (${p.author}, branch ${p.headRef})`,
            )
            .join("\n")}`,
        }
      : null,
  );

  const explainOne = (path: string) => {
    assistant.open(
      `Explain ${path} — what does this file do, what does it depend on, and who uses it?`,
    );
    setContextMenu(null);
  };

  const explainSelection = () => {
    if (selectedFiles.length === 0) return;
    assistant.open(
      `Explain how these ${selectedFiles.length} files work together: ${selectedFiles.join(", ")}. Walk me through the responsibilities, the dependencies between them, and where they're invoked.`,
    );
  };

  const addFilesToSelection = useCallback((paths: string[]) => {
    if (paths.length === 0) return;
    setSelectedFiles((prev) => {
      const seen = new Set(prev);
      const next = [...prev];
      for (const p of paths) if (!seen.has(p)) next.push(p);
      return next;
    });
  }, []);

  const selectGroup = useCallback(
    (g: string) => {
      if (!graph) return;
      const paths = graph.files.filter((f) => f.group === g).map((f) => f.path);
      addFilesToSelection(paths);
    },
    [graph, addFilesToSelection],
  );

  const selectPR = useCallback(
    (n: number) => {
      const set = prFiles.get(n);
      if (!set) return;
      addFilesToSelection(Array.from(set));
    },
    [prFiles, addFilesToSelection],
  );

  const describeGroup = useCallback(
    (g: string) => {
      if (!graph) return;
      const filesInGroup = graph.files
        .filter((f) => f.group === g)
        .map((f) => f.path)
        .slice(0, 40);
      assistant.open(
        `Describe the \`${g}\` group in this repo: what is its responsibility, what kinds of files live inside, and how does it relate to the other groups? Files in the group:\n${filesInGroup.join("\n")}`,
      );
    },
    [graph, assistant],
  );

  const toggleGroupFocus = useCallback((g: string) => {
    setFocusedGroup((cur) => (cur === g ? null : g));
    setFocusedPR(null);
  }, []);

  if (mode !== "live") {
    return (
      <div className="flex h-full items-center justify-center p-6 text-sm text-muted">
        Knowledge graph is only available in live mode.
      </div>
    );
  }

  return (
    <div className="flex h-full w-full flex-col">
      <header
        className="z-10 flex h-12 shrink-0 items-center gap-3 border-b border-border/60 bg-background/80 px-4 backdrop-blur"
        style={presenting ? { display: "none" } : undefined}
      >
        <Link
          href="/"
          className="flex h-7 w-7 items-center justify-center rounded-md text-muted transition-colors hover:bg-subtle hover:text-foreground"
          aria-label="Back to PR list"
        >
          <ChevronLeft className="h-4 w-4" />
        </Link>
        <div className="flex items-center gap-2">
          <GitBranch className="h-3.5 w-3.5 text-muted" strokeWidth={1.8} />
          <span
            className="font-medium text-foreground"
            style={{ fontFamily: "var(--font-mono), monospace" }}
          >
            {meta?.name ?? graph?.rootName ?? "…"}
          </span>
          {meta?.owner ? (
            <span
              className="text-[11px] text-muted"
              style={{ fontFamily: "var(--font-mono), monospace" }}
            >
              {meta.owner}
            </span>
          ) : null}
          <span className="ml-1 rounded-full bg-subtle px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-muted">
            graph
          </span>
        </div>
        {graph ? (
          <span className="text-[11px] text-muted">
            {graph.files.length} files · {graph.edges.length} imports ·{" "}
            {graph.groups.length} groups · {isStale(graph) ? "stale" : "fresh"}
          </span>
        ) : null}
        <div className="ml-auto flex items-center gap-1.5">
          <button
            onClick={expanded.size > 0 ? collapseAll : expandAll}
            className="flex h-7 items-center gap-1.5 rounded-md border border-border/70 bg-subtle/40 px-2.5 text-[11px] font-medium text-muted transition-colors hover:bg-subtle hover:text-foreground"
            title={
              expanded.size > 0
                ? "Collapse all signatures"
                : "Expand all files to show signatures"
            }
          >
            {expanded.size > 0 ? (
              <ChevronsDownUp className="h-3 w-3" strokeWidth={1.8} />
            ) : (
              <ChevronsUpDown className="h-3 w-3" strokeWidth={1.8} />
            )}
            {expanded.size > 0 ? "Collapse" : "Expand all"}
          </button>
          <button
            onClick={() => setAuditOpen(true)}
            className="flex h-7 items-center gap-1.5 rounded-md border border-border/70 bg-subtle/40 px-2.5 text-[11px] font-medium text-muted transition-colors hover:bg-subtle hover:text-foreground"
            title="Audit · risks across all open PRs"
          >
            <ShieldAlert className="h-3 w-3" strokeWidth={1.8} />
            Audit
          </button>
          <button
            onClick={() => setTick((t) => t + 1)}
            className="flex h-7 items-center gap-1.5 rounded-md border border-border/70 bg-subtle/40 px-2.5 text-[11px] font-medium text-muted transition-colors hover:bg-subtle hover:text-foreground"
            title="Re-ingest from GitHub"
          >
            <RefreshCw
              className={cn("h-3 w-3", loading ? "animate-spin" : "")}
              strokeWidth={1.8}
            />
            Refresh
          </button>
          {meta?.htmlUrl ? (
            <a
              href={meta.htmlUrl}
              target="_blank"
              rel="noreferrer"
              className="flex h-7 items-center gap-1.5 rounded-md border border-border/70 bg-subtle/40 px-2.5 text-[11px] font-medium text-muted transition-colors hover:bg-subtle hover:text-foreground"
            >
              <ExternalLink className="h-3 w-3" strokeWidth={1.8} />
              GitHub
            </a>
          ) : null}
          <ThemeToggle />
        </div>
      </header>

      <div className="relative flex-1">
        {error ? (
          <div className="absolute inset-0 flex items-center justify-center p-6">
            <p className="max-w-md rounded-md border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-[12px] text-rose-700 dark:text-rose-300">
              {error}
            </p>
          </div>
        ) : loading && !graph ? (
          <div className="absolute inset-0 flex items-center justify-center gap-2 text-sm text-muted">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            Ingesting repo…
          </div>
        ) : graph ? (
          <ReactFlowProvider>
            <ReactFlow
              nodes={nodes}
              edges={edges}
              nodeTypes={nodeTypes}
              fitView
              fitViewOptions={{ padding: 0.14, duration: 0 }}
              minZoom={0.2}
              maxZoom={1.8}
              nodesDraggable={false}
              nodesConnectable={false}
              proOptions={{ hideAttribution: true }}
              selectionOnDrag
              multiSelectionKeyCode={["Shift", "Meta", "Control"]}
              onSelectionChange={({ nodes: selected }) => {
                setSelectedFiles((prev) => {
                  const next = selected
                    .filter((n) => n.type === "file")
                    .map((n) => n.id);
                  if (
                    prev.length === next.length &&
                    prev.every((v, i) => v === next[i])
                  ) {
                    return prev;
                  }
                  return next;
                });
              }}
              onNodeContextMenu={(e, node) => {
                e.preventDefault();
                if (node.type !== "file") return;
                const data = node.data as FileNodeData | undefined;
                setContextMenu({
                  x: e.clientX,
                  y: e.clientY,
                  filePath: node.id,
                  groupColor: data?.groupColor ?? "#888",
                });
              }}
              onPaneClick={() => setContextMenu(null)}
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
                nodeColor={(node) => {
                  const d = node.data as FileNodeData | undefined;
                  return d?.touchedBy[0]?.color ?? d?.groupColor ?? "var(--muted)";
                }}
              />
              <Panel position="top-left">
                <Legend
                  groups={graph.groups}
                  groupColorFor={groupColorFor}
                  prs={prs}
                  prColorFor={prColorFor}
                  onOpenPR={openPR}
                  focusedPR={focusedPR}
                  onToggleFocus={(n) => {
                    setFocusedPR((cur) => (cur === n ? null : n));
                    setFocusedGroup(null);
                  }}
                  focusedGroup={focusedGroup}
                  onToggleGroupFocus={toggleGroupFocus}
                  onSelectPR={selectPR}
                  onSelectGroup={selectGroup}
                  onDescribeGroup={describeGroup}
                />
              </Panel>
              {presenting ? null : selectedFiles.length >= 2 ? (
                <Panel position="bottom-center">
                  <motion.div
                    initial={{ y: 12, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    className="flex items-center gap-2 rounded-full border border-border/60 bg-background/90 px-3 py-1.5 shadow-[0_4px_24px_rgba(0,0,0,0.18)] backdrop-blur"
                  >
                    <span className="text-[11px] text-muted">
                      {selectedFiles.length} files selected
                    </span>
                    <button
                      type="button"
                      onClick={explainSelection}
                      className="flex h-6 items-center gap-1 rounded-md bg-foreground px-2 text-[10.5px] font-medium text-background hover:bg-foreground/90"
                    >
                      <Sparkles className="h-3 w-3" strokeWidth={2} />
                      Explain together
                    </button>
                  </motion.div>
                </Panel>
              ) : (
                <Panel position="bottom-center">
                  <div className="flex items-center gap-2 rounded-full border border-border/50 bg-background/75 px-3 py-1 text-[10.5px] text-muted shadow-sm backdrop-blur">
                    <span className="inline-flex items-center gap-1">
                      <kbd className="rounded border border-border/70 bg-subtle px-1 py-px font-mono text-[9px] text-foreground/80">
                        click
                      </kbd>
                      open
                    </span>
                    <span className="text-border">·</span>
                    <span className="inline-flex items-center gap-1">
                      <kbd className="rounded border border-border/70 bg-subtle px-1 py-px font-mono text-[9px] text-foreground/80">
                        right-click
                      </kbd>
                      ask AI
                    </span>
                    <span className="text-border">·</span>
                    <span className="inline-flex items-center gap-1">
                      <kbd className="rounded border border-border/70 bg-subtle px-1 py-px font-mono text-[9px] text-foreground/80">
                        drag
                      </kbd>
                      bulk select
                    </span>
                  </div>
                </Panel>
              )}
            </ReactFlow>
          </ReactFlowProvider>
        ) : null}

        {contextMenu ? (
          <FileContextMenu
            menu={contextMenu}
            onExplain={() => explainOne(contextMenu.filePath)}
            onClose={() => setContextMenu(null)}
          />
        ) : null}

      </div>

      <AuditPanel
        open={auditOpen}
        onClose={() => setAuditOpen(false)}
        prs={prs}
        source={auditSource}
        repo={repo}
        prColorFor={prColorFor}
      />

      <FunctionTracePanel
        open={!!traceTarget}
        target={
          traceTarget && repo
            ? {
                owner: repo.owner,
                repo: repo.repo,
                ref: graph?.defaultBranch,
                path: traceTarget.path,
                signature: traceTarget.signature,
              }
            : null
        }
        history={
          repo
            ? traceHistory.map((h) => ({
                owner: repo.owner,
                repo: repo.repo,
                ref: graph?.defaultBranch,
                path: h.path,
                signature: h.signature,
              }))
            : []
        }
        knownPaths={knownPaths}
        onNavigate={navigateTrace}
        onBack={backTrace}
        onClose={closeTrace}
        openaiKey={openaiKey ?? null}
        githubToken={token ?? null}
      />
    </div>
  );
}


function Legend({
  groups,
  groupColorFor,
  prs,
  prColorFor,
  onOpenPR,
  focusedPR,
  onToggleFocus,
  focusedGroup,
  onToggleGroupFocus,
  onSelectPR,
  onSelectGroup,
  onDescribeGroup,
}: {
  groups: string[];
  groupColorFor: (g: string) => string;
  prs: PRSummary[];
  prColorFor: (n: number) => string;
  onOpenPR: (n: number) => void;
  focusedPR: number | null;
  onToggleFocus: (n: number) => void;
  focusedGroup: string | null;
  onToggleGroupFocus: (g: string) => void;
  onSelectPR: (n: number) => void;
  onSelectGroup: (g: string) => void;
  onDescribeGroup: (g: string) => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.24 }}
      className="flex flex-col gap-2 rounded-lg border border-border/60 bg-background/80 p-2 shadow-[0_4px_24px_rgba(0,0,0,0.18)] backdrop-blur"
    >
      {prs.length > 0 ? (
        <div className="flex flex-col gap-1">
          <span className="px-1 text-[9px] font-medium uppercase tracking-wider text-muted">
            Open PRs · {prs.length}
          </span>
          {prs.map((pr) => {
            const c = prColorFor(pr.number);
            const isFocused = focusedPR === pr.number;
            return (
              <div
                key={pr.number}
                className={cn(
                  "group flex items-center gap-1 rounded-md transition-colors",
                  isFocused ? "bg-subtle" : "hover:bg-subtle/70",
                )}
                style={
                  isFocused
                    ? { boxShadow: `inset 0 0 0 1px ${c}` }
                    : undefined
                }
              >
                <button
                  type="button"
                  onClick={() => onToggleFocus(pr.number)}
                  title={isFocused ? "Unfocus" : "Focus only this PR"}
                  className="flex flex-1 items-center gap-2 px-1.5 py-0.5 text-left text-[11px]"
                >
                  <span
                    aria-hidden
                    className="h-2 w-2 shrink-0 rounded-full"
                    style={{ background: c }}
                  />
                  <GitPullRequest
                    className="h-3 w-3 shrink-0"
                    style={{ color: c }}
                    strokeWidth={1.8}
                  />
                  <span className="min-w-0 max-w-[260px] truncate text-foreground">
                    <span
                      className="font-mono opacity-70"
                      style={{ fontFamily: "var(--font-mono), monospace" }}
                    >
                      #{pr.number}
                    </span>{" "}
                    {pr.title}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelectPR(pr.number);
                  }}
                  title="Add all files of this PR to selection"
                  className="flex h-5 w-5 shrink-0 items-center justify-center rounded text-muted opacity-0 transition-opacity hover:text-foreground group-hover:opacity-100"
                  aria-label="Select files of this PR"
                >
                  <Plus className="h-3 w-3" strokeWidth={2} />
                </button>
                <button
                  type="button"
                  onClick={() => onOpenPR(pr.number)}
                  title="Open PR canvas"
                  className="mr-1 flex h-5 w-5 shrink-0 items-center justify-center rounded text-muted opacity-0 transition-opacity hover:text-foreground group-hover:opacity-100"
                  aria-label="Open PR canvas"
                >
                  <ExternalLink className="h-3 w-3" />
                </button>
              </div>
            );
          })}
        </div>
      ) : null}
      {groups.length > 0 ? (
        <div className="flex flex-col gap-1 border-t border-border/40 pt-1.5">
          <span className="block px-1 pb-0.5 text-[9px] font-medium uppercase tracking-wider text-muted">
            Groups · {groups.length}
          </span>
          {groups.map((g) => {
            const c = groupColorFor(g);
            const isFocused = focusedGroup === g;
            return (
              <div
                key={g}
                className={cn(
                  "group flex items-center gap-1 rounded-md transition-colors",
                  isFocused ? "bg-subtle" : "hover:bg-subtle/70",
                )}
                style={
                  isFocused
                    ? { boxShadow: `inset 0 0 0 1px ${c}` }
                    : undefined
                }
              >
                <button
                  type="button"
                  onClick={() => onToggleGroupFocus(g)}
                  title={isFocused ? "Unfocus group" : "Focus only this group"}
                  className="flex flex-1 items-center gap-2 px-1.5 py-0.5 text-left text-[10.5px]"
                >
                  <span
                    aria-hidden
                    className="h-1.5 w-1.5 shrink-0 rounded-full"
                    style={{ background: c }}
                  />
                  <span
                    className="truncate font-mono text-foreground"
                    style={{ fontFamily: "var(--font-mono), monospace" }}
                  >
                    {g}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelectGroup(g);
                  }}
                  title="Add all files of this group to selection"
                  className="flex h-5 w-5 shrink-0 items-center justify-center rounded text-muted opacity-0 transition-opacity hover:text-foreground group-hover:opacity-100"
                  aria-label="Select files of this group"
                >
                  <Plus className="h-3 w-3" strokeWidth={2} />
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onDescribeGroup(g);
                  }}
                  title="Describe this group with AI"
                  className="mr-1 flex h-5 w-5 shrink-0 items-center justify-center rounded text-muted opacity-0 transition-opacity hover:text-foreground group-hover:opacity-100"
                  aria-label="Describe with AI"
                >
                  <Sparkles className="h-3 w-3" strokeWidth={2} />
                </button>
              </div>
            );
          })}
        </div>
      ) : null}
    </motion.div>
  );
}

function FileContextMenu({
  menu,
  onExplain,
  onClose,
}: {
  menu: NonNullable<ContextMenu>;
  onExplain: () => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      const target = e.target as globalThis.Node | null;
      if (target && ref.current && !ref.current.contains(target)) onClose();
    };
    window.addEventListener("click", onDoc);
    return () => window.removeEventListener("click", onDoc);
  }, [onClose]);
  return (
    <div
      ref={ref}
      className="fixed z-50 flex flex-col rounded-lg border border-border/70 bg-background py-1 shadow-2xl"
      style={{ top: menu.y, left: menu.x, minWidth: 220 }}
    >
      <div
        className="border-b border-border/40 px-3 py-1.5 text-[10.5px] text-muted"
        style={{ fontFamily: "var(--font-mono), monospace" }}
      >
        {menu.filePath}
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
        Ask AI to explain this file
      </button>
    </div>
  );
}
