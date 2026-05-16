import type { Theme } from "@/components/ThemeProvider";

const ACCENT_DARK = {
  intent: "#a78bfa",
  architecture: "#2dd4bf",
  change: "#60a5fa",
  alternatives: "#fbbf24",
  risk: "#f87171",
  diff: "#a8a29e",
} as const;

const ACCENT_LIGHT = {
  intent: "#7c3aed",
  architecture: "#0d9488",
  change: "#2563eb",
  alternatives: "#d97706",
  risk: "#dc2626",
  diff: "#52525b",
} as const;

export type NodeAccentKey = keyof typeof ACCENT_DARK;
export type NodeAccents = Record<NodeAccentKey, string>;

export function getAccents(theme: Theme): NodeAccents {
  return theme === "dark" ? ACCENT_DARK : ACCENT_LIGHT;
}

/**
 * Static palette used in non-themed contexts (e.g. type definitions in JSON).
 * Components should prefer `useNodeAccents()` to react to theme changes.
 */
export const NODE_ACCENT: NodeAccents = ACCENT_DARK;
