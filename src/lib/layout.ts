import dagre from "dagre";
import type { Edge, Node } from "@xyflow/react";

export type LayoutDirection = "LR" | "TB";

const DEFAULT_DIMS: Record<string, { width: number; height: number }> = {
  intent: { width: 240, height: 150 },
  architecture: { width: 240, height: 290 },
  alternatives: { width: 320, height: 470 },
  change: { width: 240, height: 115 },
  risk: { width: 220, height: 170 },
  diff: { width: 200, height: 100 },
  preview: { width: 460, height: 380 },
};

function nodeSize(node: Node): { width: number; height: number } {
  if (node.measured?.width && node.measured?.height) {
    return {
      width: node.measured.width,
      height: node.measured.height,
    };
  }
  const fallback = DEFAULT_DIMS[node.type ?? ""] ?? {
    width: 220,
    height: 120,
  };
  return fallback;
}

export function autoLayout(
  nodes: Node[],
  edges: Edge[],
  direction: LayoutDirection = "LR",
): Node[] {
  const g = new dagre.graphlib.Graph({ compound: false });
  g.setGraph({
    rankdir: direction,
    nodesep: direction === "LR" ? 60 : 90,
    ranksep: direction === "LR" ? 110 : 90,
    marginx: 40,
    marginy: 40,
    align: "UL",
    acyclicer: "greedy",
    ranker: "tight-tree",
  });
  g.setDefaultEdgeLabel(() => ({}));

  for (const node of nodes) {
    const { width, height } = nodeSize(node);
    g.setNode(node.id, { width, height });
  }
  for (const edge of edges) {
    g.setEdge(edge.source, edge.target);
  }

  dagre.layout(g);

  return nodes.map((n) => {
    const dn = g.node(n.id);
    if (!dn) return n;
    return {
      ...n,
      position: {
        x: dn.x - dn.width / 2,
        y: dn.y - dn.height / 2,
      },
    };
  });
}
