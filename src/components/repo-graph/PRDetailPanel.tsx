"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  ExternalLink,
  FileDiff,
  GitPullRequest,
  Loader2,
  Sparkles,
  X,
} from "lucide-react";
import type { PRSummary } from "@/lib/repo-source/types";
import type { PRCanvas, IntentNodeData, RiskNodeData, DiffNodeData } from "@/lib/types";
import type { RepoSource } from "@/lib/repo-source/types";
import { ApproveMerge } from "@/components/ApproveMerge";

type Props = {
  pr: PRSummary | null;
  prFiles: Set<string> | null;
  accent: string;
  source: RepoSource | null;
  onClose: () => void;
  onExplain: (prompt: string) => void;
};

/**
 * Right-side drawer summarising a PR without leaving the unified canvas.
 * Lazily pulls the same PR canvas data we'd render full-screen, but extracts
 * intent/risks/diff as compact cards so the canvas stays the centerpiece.
 */
export function PRDetailPanel({
  pr,
  prFiles,
  accent,
  source,
  onClose,
  onExplain,
}: Props) {
  const [canvas, setCanvas] = useState<PRCanvas | null>(null);
  const [loading, setLoading] = useState(false);

  // Parent re-keys this component when `pr` changes, so we always start a
  // fresh fetch and don't need to manually clear stale state here.
  useEffect(() => {
    if (!pr || !source) return;
    let cancelled = false;
    setLoading(true);
    source
      .getPRCanvas(pr.number)
      .then((c) => {
        if (!cancelled) setCanvas(c);
      })
      .catch(() => {
        /* leave the meta-only view */
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [pr, source]);

  if (!pr) return null;

  const intent = canvas?.nodes.find((n) => n.type === "intent")?.data as
    | IntentNodeData
    | undefined;
  const risks = (canvas?.nodes ?? [])
    .filter((n) => n.type === "risk")
    .map((n) => n.data as RiskNodeData);
  const diff = canvas?.nodes.find((n) => n.type === "diff")?.data as
    | DiffNodeData
    | undefined;

  return (
    <motion.aside
      key={pr.number}
      initial={{ x: 32, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: 32, opacity: 0 }}
      transition={{ duration: 0.2 }}
      className="pointer-events-auto flex h-full w-[360px] shrink-0 flex-col border-l border-border/60 bg-background/95 backdrop-blur"
    >
      <header
        className="flex items-center gap-2 border-b border-border/50 px-3.5 py-2.5"
        style={{ borderTop: `2px solid ${accent}` }}
      >
        <GitPullRequest
          className="h-3.5 w-3.5 shrink-0"
          style={{ color: accent }}
          strokeWidth={1.8}
        />
        <span
          className="font-mono text-[10.5px] text-muted"
          style={{ fontFamily: "var(--font-mono), monospace" }}
        >
          #{pr.number}
        </span>
        <span className="min-w-0 flex-1 truncate text-[12.5px] font-medium text-foreground">
          {pr.title}
        </span>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="flex h-6 w-6 items-center justify-center rounded-md text-muted hover:bg-subtle hover:text-foreground"
        >
          <X className="h-3.5 w-3.5" strokeWidth={1.8} />
        </button>
      </header>

      <div className="flex flex-col gap-3 overflow-y-auto p-3.5 text-[12px]">
        <div className="flex items-center gap-2 text-[11px] text-muted">
          <span>by {pr.author}</span>
          <span aria-hidden>·</span>
          <span
            className="font-mono"
            style={{ fontFamily: "var(--font-mono), monospace" }}
          >
            {pr.headRef}
          </span>
          <span aria-hidden>→</span>
          <span
            className="font-mono"
            style={{ fontFamily: "var(--font-mono), monospace" }}
          >
            {pr.baseRef}
          </span>
        </div>

        {intent ? (
          <Card title="Intent" accent={accent}>
            <div className="flex flex-wrap items-center gap-1 text-[9.5px] uppercase tracking-wider text-muted">
              <Tag color={accent}>{intent.kind}</Tag>
              <Tag color={accent}>{intent.surface}</Tag>
              <Tag color={accent}>scope {intent.scope}</Tag>
              {intent.ticket ? <Tag color={accent}>{intent.ticket}</Tag> : null}
            </div>
            <p className="mt-1.5 text-[12px] leading-snug text-foreground/90">
              {intent.summary}
            </p>
          </Card>
        ) : pr.body ? (
          <Card title="PR body" accent={accent}>
            <p className="line-clamp-6 whitespace-pre-wrap text-[12px] leading-snug text-foreground/80">
              {pr.body}
            </p>
          </Card>
        ) : null}

        {risks.length > 0 ? (
          <Card title="Risks" accent={accent}>
            <ul className="flex flex-col gap-1.5">
              {risks.slice(0, 4).map((r, i) => (
                <li
                  key={i}
                  className="rounded-md border border-border/50 bg-subtle/50 p-2"
                >
                  <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider">
                    <span
                      className="rounded-full px-1.5 text-[8.5px] font-medium"
                      style={{
                        background: severityBg(r.severity),
                        color: severityFg(r.severity),
                      }}
                    >
                      {r.severity}
                    </span>
                    <span
                      className="truncate font-mono text-muted"
                      style={{ fontFamily: "var(--font-mono), monospace" }}
                    >
                      {r.file}
                    </span>
                  </div>
                  <p className="mt-1 text-[11.5px] leading-snug text-foreground/85">
                    {r.rationale}
                  </p>
                </li>
              ))}
            </ul>
          </Card>
        ) : null}

        <Card title="Touched files" accent={accent}>
          {prFiles && prFiles.size > 0 ? (
            <ul
              className="flex max-h-44 flex-col gap-0.5 overflow-y-auto font-mono text-[10.5px]"
              style={{ fontFamily: "var(--font-mono), monospace" }}
            >
              {Array.from(prFiles)
                .slice(0, 50)
                .map((p) => {
                  const entry = diff?.files.find((f) => f.path === p);
                  return (
                    <li
                      key={p}
                      className="flex items-center justify-between gap-2 rounded-sm px-1 py-0.5 text-foreground/85 hover:bg-subtle/60"
                    >
                      <span className="min-w-0 truncate" title={p}>
                        {p}
                      </span>
                      {entry ? (
                        <span className="shrink-0 text-[9.5px]">
                          <span className="text-emerald-500">
                            +{entry.additions}
                          </span>{" "}
                          <span className="text-rose-500">
                            −{entry.deletions}
                          </span>
                        </span>
                      ) : null}
                    </li>
                  );
                })}
            </ul>
          ) : (
            <span className="text-[11px] text-muted">No file list yet.</span>
          )}
        </Card>

        {loading && !canvas ? (
          <div className="flex items-center gap-2 text-[11px] text-muted">
            <Loader2 className="h-3 w-3 animate-spin" />
            Reading the PR…
          </div>
        ) : null}
      </div>

      <footer className="flex items-center gap-1.5 border-t border-border/50 p-2.5">
        <button
          type="button"
          onClick={() =>
            onExplain(
              `Walk me through PR #${pr.number} (${pr.title}). What is changing, why, and what's the risk profile? Files touched: ${(prFiles ? Array.from(prFiles) : []).slice(0, 30).join(", ")}`,
            )
          }
          className="flex h-7 items-center gap-1.5 rounded-md border border-border/70 bg-subtle/40 px-2.5 text-[11px] font-medium text-muted transition-colors hover:bg-subtle hover:text-foreground"
        >
          <Sparkles
            className="h-3 w-3"
            strokeWidth={2}
            style={{ color: "var(--accent-alternatives)" }}
          />
          Ask Plot
        </button>
        <Link
          href={`/pr/${pr.number}`}
          className="flex h-7 items-center gap-1.5 rounded-md border border-border/70 bg-subtle/40 px-2.5 text-[11px] font-medium text-muted transition-colors hover:bg-subtle hover:text-foreground"
          title="Open the full PR canvas"
        >
          <FileDiff className="h-3 w-3" strokeWidth={1.8} />
          Full canvas
        </Link>
        {pr.htmlUrl ? (
          <a
            href={pr.htmlUrl}
            target="_blank"
            rel="noreferrer"
            className="flex h-7 items-center gap-1.5 rounded-md border border-border/70 bg-subtle/40 px-2.5 text-[11px] font-medium text-muted transition-colors hover:bg-subtle hover:text-foreground"
            title="GitHub"
          >
            <ExternalLink className="h-3 w-3" strokeWidth={1.8} />
            GitHub
          </a>
        ) : null}
        <div className="ml-auto">
          <ApproveMerge prNumber={pr.number} prTitle={pr.title} />
        </div>
      </footer>
    </motion.aside>
  );
}

function Card({
  title,
  accent,
  children,
}: {
  title: string;
  accent: string;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-1.5 rounded-lg border border-border/60 bg-subtle/40 p-2.5">
      <header className="flex items-center gap-1.5">
        <span
          aria-hidden
          className="h-1 w-1 rounded-full"
          style={{ background: accent }}
        />
        <span className="text-[9.5px] font-medium uppercase tracking-wider text-muted">
          {title}
        </span>
      </header>
      {children}
    </section>
  );
}

function Tag({
  color,
  children,
}: {
  color: string;
  children: React.ReactNode;
}) {
  return (
    <span
      className="rounded-full px-1.5 py-px"
      style={{
        background: `color-mix(in srgb, ${color} 14%, transparent)`,
        color,
      }}
    >
      {children}
    </span>
  );
}

function severityBg(s: string): string {
  if (s === "high") return "color-mix(in srgb, #ef4444 18%, transparent)";
  if (s === "medium") return "color-mix(in srgb, #f59e0b 18%, transparent)";
  return "color-mix(in srgb, #64748b 18%, transparent)";
}

function severityFg(s: string): string {
  if (s === "high") return "#ef4444";
  if (s === "medium") return "#f59e0b";
  return "#64748b";
}
