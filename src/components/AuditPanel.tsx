"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import {
  AlertTriangle,
  Loader2,
  ShieldAlert,
  ShieldCheck,
  ShieldQuestion,
  X,
} from "lucide-react";
import type { PRSummary, RepoSource } from "@/lib/repo-source/types";
import type { RiskNodeData, RiskSeverity } from "@/lib/types";
import { loadCachedEnrichment } from "@/lib/ai/cache";
import { cn } from "@/lib/utils";

type AggregateRisk = RiskNodeData & {
  prNumber: number;
  prTitle: string;
  prColor: string;
  fromAI: boolean;
};

const SEVERITY_RANK: Record<RiskSeverity, number> = {
  high: 0,
  medium: 1,
  low: 2,
};

const SEVERITY_TINT: Record<RiskSeverity, string> = {
  high: "#ef4444",
  medium: "#f59e0b",
  low: "#64748b",
};

export function AuditPanel({
  open,
  onClose,
  prs,
  source,
  repo,
  prColorFor,
}: {
  open: boolean;
  onClose: () => void;
  prs: PRSummary[];
  source: RepoSource | null;
  repo: { owner: string; repo: string } | null;
  prColorFor: (n: number) => string;
}) {
  const router = useRouter();
  const [risks, setRisks] = useState<AggregateRisk[]>([]);
  const [loading, setLoading] = useState(false);
  const [severityFilter, setSeverityFilter] = useState<RiskSeverity | "all">(
    "all",
  );

  useEffect(() => {
    if (!open || !source) return;
    let cancelled = false;
    setLoading(true);
    Promise.all(
      prs.map(async (pr) => {
        try {
          const canvas = await source.getPRCanvas(pr.number);
          const cached =
            repo && pr.headSha
              ? loadCachedEnrichment(repo.owner, repo.repo, pr.headSha)
              : null;
          const sourceCanvas = cached ?? canvas;
          const fromAI = !!cached;
          const items: AggregateRisk[] = sourceCanvas.nodes
            .filter((n) => n.type === "risk")
            .map((n) => ({
              ...(n.data as RiskNodeData),
              prNumber: pr.number,
              prTitle: pr.title,
              prColor: prColorFor(pr.number),
              fromAI,
            }));
          return items;
        } catch {
          return [] as AggregateRisk[];
        }
      }),
    )
      .then((all) => {
        if (cancelled) return;
        const flat = all.flat();
        flat.sort((a, b) => {
          const s = SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity];
          if (s !== 0) return s;
          return a.prNumber - b.prNumber;
        });
        setRisks(flat);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, source, prs, repo, prColorFor]);

  const filtered = useMemo(
    () =>
      severityFilter === "all"
        ? risks
        : risks.filter((r) => r.severity === severityFilter),
    [risks, severityFilter],
  );

  const counts = useMemo(() => {
    const out: Record<RiskSeverity, number> = { high: 0, medium: 0, low: 0 };
    for (const r of risks) out[r.severity]++;
    return out;
  }, [risks]);

  return (
    <AnimatePresence>
      {open ? (
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
            transition={{ type: "spring", stiffness: 260, damping: 32 }}
            className="fixed right-0 top-0 z-50 flex h-full w-[420px] flex-col border-l border-border/70 bg-background shadow-[-12px_0_40px_rgba(0,0,0,0.18)]"
          >
            <header className="flex h-12 items-center gap-2 border-b border-border/60 px-4">
              <ShieldAlert
                className="h-4 w-4"
                style={{ color: SEVERITY_TINT.high }}
                strokeWidth={1.8}
              />
              <h2 className="text-sm font-semibold">Audit</h2>
              <span className="text-[11px] text-muted">
                {risks.length} flagged across {prs.length} PR
                {prs.length === 1 ? "" : "s"}
              </span>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close"
                className="ml-auto flex h-7 w-7 items-center justify-center rounded-md text-muted hover:bg-subtle hover:text-foreground"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </header>

            <div className="flex items-center gap-1 border-b border-border/40 px-3 py-2">
              <SeverityChip
                label="All"
                active={severityFilter === "all"}
                count={risks.length}
                onClick={() => setSeverityFilter("all")}
              />
              <SeverityChip
                label="High"
                tint={SEVERITY_TINT.high}
                active={severityFilter === "high"}
                count={counts.high}
                onClick={() => setSeverityFilter("high")}
              />
              <SeverityChip
                label="Medium"
                tint={SEVERITY_TINT.medium}
                active={severityFilter === "medium"}
                count={counts.medium}
                onClick={() => setSeverityFilter("medium")}
              />
              <SeverityChip
                label="Low"
                tint={SEVERITY_TINT.low}
                active={severityFilter === "low"}
                count={counts.low}
                onClick={() => setSeverityFilter("low")}
              />
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto">
              {loading && risks.length === 0 ? (
                <div className="flex h-full items-center justify-center gap-2 text-sm text-muted">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Scanning PRs…
                </div>
              ) : filtered.length === 0 ? (
                <div className="flex h-full flex-col items-center justify-center gap-2 px-6 text-center text-sm text-muted">
                  <ShieldCheck
                    className="h-6 w-6"
                    style={{ color: "var(--ok, #10b981)" }}
                    strokeWidth={1.6}
                  />
                  <span>Nothing flagged at this severity.</span>
                </div>
              ) : (
                <ul className="divide-y divide-border/40">
                  {filtered.map((r, i) => (
                    <li key={`${r.prNumber}-${i}-${r.rule}`}>
                      <button
                        type="button"
                        onClick={() => {
                          router.push(`/pr/${r.prNumber}`);
                          onClose();
                        }}
                        className="flex w-full flex-col gap-1.5 px-4 py-3 text-left transition-colors hover:bg-subtle"
                      >
                        <div className="flex items-center gap-2">
                          <SeverityIcon severity={r.severity} />
                          <span className="text-[12.5px] font-medium text-foreground">
                            {r.rule}
                          </span>
                          {r.fromAI ? (
                            <span className="ml-auto rounded-full bg-subtle px-1.5 text-[9px] font-medium uppercase tracking-wider text-muted">
                              AI
                            </span>
                          ) : null}
                        </div>
                        {r.rationale ? (
                          <p className="text-[11.5px] leading-snug text-muted">
                            {r.rationale}
                          </p>
                        ) : null}
                        <div className="flex flex-wrap items-center gap-2 text-[10.5px] text-muted">
                          <span
                            className="rounded-full px-1.5 py-0.5 font-medium"
                            style={{
                              background: `color-mix(in srgb, ${r.prColor} 18%, transparent)`,
                              color: r.prColor,
                            }}
                          >
                            #{r.prNumber}
                          </span>
                          <span className="truncate">{r.prTitle}</span>
                          {r.file ? (
                            <span
                              className="truncate font-mono opacity-80"
                              style={{ fontFamily: "var(--font-mono), monospace" }}
                            >
                              · {r.file}
                              {r.line ? `:${r.line}` : ""}
                            </span>
                          ) : null}
                        </div>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </motion.aside>
        </>
      ) : null}
    </AnimatePresence>
  );
}

function SeverityChip({
  label,
  tint,
  count,
  active,
  onClick,
}: {
  label: string;
  tint?: string;
  count: number;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[10.5px] font-medium transition-colors",
        active
          ? "border-foreground/60 bg-subtle text-foreground"
          : "border-border/60 bg-transparent text-muted hover:bg-subtle/70",
      )}
    >
      {tint ? (
        <span
          aria-hidden
          className="h-1.5 w-1.5 rounded-full"
          style={{ background: tint }}
        />
      ) : null}
      <span>{label}</span>
      <span className="opacity-70">{count}</span>
    </button>
  );
}

function SeverityIcon({ severity }: { severity: RiskSeverity }) {
  if (severity === "high")
    return (
      <ShieldAlert
        className="h-3.5 w-3.5"
        style={{ color: SEVERITY_TINT.high }}
        strokeWidth={2}
      />
    );
  if (severity === "medium")
    return (
      <AlertTriangle
        className="h-3.5 w-3.5"
        style={{ color: SEVERITY_TINT.medium }}
        strokeWidth={2}
      />
    );
  return (
    <ShieldQuestion
      className="h-3.5 w-3.5"
      style={{ color: SEVERITY_TINT.low }}
      strokeWidth={2}
    />
  );
}
