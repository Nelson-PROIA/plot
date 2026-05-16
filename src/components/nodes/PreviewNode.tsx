"use client";

import { useState } from "react";
import type { NodeProps } from "@xyflow/react";
import { ExternalLink, Globe, Loader2, AlertCircle } from "lucide-react";
import type { PreviewNodeType } from "@/lib/types";
import { useNodeAccents } from "@/components/useNodeAccents";
import { NodeShell } from "./NodeShell";

const WIDTH = 460;
const FRAME_HEIGHT = 280;

export function PreviewNode({
  id,
  data,
  selected,
}: NodeProps<PreviewNodeType>) {
  const ACCENT = useNodeAccents().alternatives;
  const [loaded, setLoaded] = useState(false);

  return (
    <NodeShell
      nodeId={id}
      accent={ACCENT}
      label="LIVE PREVIEW"
      width={WIDTH}
      selected={selected}
      glow
    >
      <div className="px-4 pb-3">
        <div className="mb-2 flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-[12.5px] font-medium leading-snug text-foreground">
              {data.state === "unchanged"
                ? "Preview unchanged (backend-only PR)"
                : data.state === "unavailable"
                  ? "No preview deployment available"
                  : data.state === "building"
                    ? "Preview is building…"
                    : data.state === "failed"
                      ? "Preview deployment failed"
                      : "Live deploy of this branch"}
            </p>
            {data.note ? (
              <p className="mt-0.5 text-[11px] text-muted">{data.note}</p>
            ) : null}
            {data.url ? (
              <p
                className="mt-0.5 truncate font-mono text-[10.5px] text-muted"
                style={{ fontFamily: "var(--font-mono), monospace" }}
              >
                {data.url.replace(/^https?:\/\//, "")}
              </p>
            ) : null}
          </div>
          {data.url ? (
            <a
              href={data.url}
              target="_blank"
              rel="noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="nodrag flex h-7 items-center gap-1 rounded-md border border-border/70 bg-subtle px-2 text-[10.5px] font-medium text-foreground transition-colors hover:bg-background"
              title="Open preview in a new tab"
            >
              <ExternalLink className="h-3 w-3" strokeWidth={1.8} />
              Open
            </a>
          ) : null}
        </div>

        <div
          className="nodrag nowheel relative overflow-hidden rounded-inner border border-border/60"
          style={{ height: FRAME_HEIGHT, background: "#ffffff" }}
          onPointerDown={(e) => e.stopPropagation()}
        >
          {data.url ? (
            <>
              {!loaded ? (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-[11px] text-muted">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading preview…
                </div>
              ) : null}
              <iframe
                src={data.url}
                sandbox="allow-scripts allow-same-origin allow-forms"
                className="h-full w-full"
                style={{
                  border: "none",
                  background: "white",
                  opacity: loaded ? 1 : 0,
                  transition: "opacity 200ms ease-out",
                }}
                onLoad={() => setLoaded(true)}
                referrerPolicy="no-referrer"
                title={`PR #${data.prNumber} preview`}
              />
            </>
          ) : (
            <div className="flex h-full flex-col items-center justify-center gap-2 px-4 text-center text-[11.5px] text-muted">
              {data.state === "unchanged" ? (
                <>
                  <Globe className="h-5 w-5 opacity-60" strokeWidth={1.6} />
                  <p>
                    This PR doesn&apos;t touch the deployed surface — the
                    preview matches production.
                  </p>
                </>
              ) : data.state === "failed" ? (
                <>
                  <AlertCircle
                    className="h-5 w-5 text-rose-500"
                    strokeWidth={1.6}
                  />
                  <p>The preview deployment failed for this PR.</p>
                </>
              ) : (
                <>
                  <Globe className="h-5 w-5 opacity-60" strokeWidth={1.6} />
                  <p>No preview URL resolved for this PR.</p>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </NodeShell>
  );
}
