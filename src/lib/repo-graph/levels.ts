/**
 * Granularity ladder for the unified canvas.
 *
 *   system  ←→  file  ←→  symbol  ←→  code
 *
 * Scroll up in the canvas moves toward `system` (more abstract).
 * Scroll down moves toward `code` (more granular — actual source).
 *
 * Each level is rendered by its own layout pass — they don't share the same
 * coordinate system so transitions are crossfades, not in-place morphs.
 */
export type Level = "system" | "file" | "symbol" | "code";

export const LEVEL_ORDER: Level[] = ["system", "file", "symbol", "code"];

export function nextLevel(level: Level, delta: 1 | -1): Level {
  const idx = LEVEL_ORDER.indexOf(level);
  const target = Math.min(
    LEVEL_ORDER.length - 1,
    Math.max(0, idx + delta),
  );
  return LEVEL_ORDER[target];
}
