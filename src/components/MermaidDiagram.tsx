"use client";

import { useEffect, useId, useState } from "react";
import { useTheme } from "./ThemeProvider";

type Tone = "default" | "added" | "removed";

type MermaidDiagramProps = {
  source: string;
  tone?: Tone;
};

const TONE_DARK = {
  default: { primary: "#1c1c20", border: "#3a3a3e", text: "#e7e5e4" },
  added: {
    primary: "rgba(52, 211, 153, 0.14)",
    border: "#34d399",
    text: "#a7f3d0",
  },
  removed: {
    primary: "rgba(248, 113, 113, 0.14)",
    border: "#f87171",
    text: "#fecaca",
  },
} as const;

const TONE_LIGHT = {
  default: { primary: "#ffffff", border: "#a1a1aa", text: "#1f1f23" },
  added: {
    primary: "rgba(16, 185, 129, 0.12)",
    border: "#059669",
    text: "#065f46",
  },
  removed: {
    primary: "rgba(220, 38, 38, 0.10)",
    border: "#dc2626",
    text: "#7f1d1d",
  },
} as const;

export function MermaidDiagram({ source, tone = "default" }: MermaidDiagramProps) {
  const { theme } = useTheme();
  const id = useId().replace(/:/g, "-");
  const [svg, setSvg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setSvg(null);
    setError(null);

    const palette = theme === "dark" ? TONE_DARK : TONE_LIGHT;
    const t = palette[tone];

    (async () => {
      try {
        const { default: mermaid } = await import("mermaid");
        mermaid.initialize({
          startOnLoad: false,
          theme: "base",
          fontFamily: "var(--font-sans), system-ui, sans-serif",
          themeVariables: {
            background: "transparent",
            primaryColor: t.primary,
            primaryTextColor: t.text,
            primaryBorderColor: t.border,
            lineColor: theme === "dark" ? "#71706b" : "#71717a",
            edgeLabelBackground: theme === "dark" ? "#1c1c20" : "#ffffff",
            tertiaryColor: theme === "dark" ? "#1c1c20" : "#ffffff",
            fontSize: "11px",
          },
        });
        const { svg } = await mermaid.render(`mermaid-${id}`, source);
        if (!cancelled) setSvg(svg);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "render error");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [source, tone, id, theme]);

  if (error) {
    return (
      <div className="rounded-inner border border-rose-500/30 bg-rose-500/5 px-2 py-1 text-[10px] text-rose-300">
        {error}
      </div>
    );
  }

  if (!svg) {
    return (
      <div className="flex h-32 items-center justify-center text-[10px] text-muted">
        rendering…
      </div>
    );
  }

  return (
    <div
      className="mermaid-host flex justify-center [&_svg]:max-w-full [&_svg]:h-auto"
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}
