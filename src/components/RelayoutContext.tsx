"use client";

import { createContext, useContext } from "react";
import type { LayoutDirection } from "@/lib/layout";

export type RelayoutContextValue = {
  relayout: (direction?: LayoutDirection) => void;
  /** Called by a node when its rendered size changes — the canvas decides whether to relayout or refit. */
  onNodeResize: () => void;
  /** Reveal a specific hidden node by id. */
  revealNode: (nodeId: string) => void;
  /** Return the first hidden direct successor of the given node, or null. */
  hiddenSuccessorOf: (nodeId: string) => string | null;
};

export const RelayoutContext = createContext<RelayoutContextValue>({
  relayout: () => {},
  onNodeResize: () => {},
  revealNode: () => {},
  hiddenSuccessorOf: () => null,
});

export function useRelayout() {
  return useContext(RelayoutContext);
}
