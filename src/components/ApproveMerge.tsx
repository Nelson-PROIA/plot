"use client";

import { useCallback, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Check, Circle, GitMerge, KeyRound, Loader2, X } from "lucide-react";
import { useConfig } from "@/components/ConfigContext";
import { getRepoSource } from "@/lib/repo-source/factory";

type StepState = "pending" | "running" | "done" | "skipped";

function StepRow({
  label,
  endpoint,
  state,
}: {
  label: string;
  endpoint: string;
  state: StepState;
}) {
  return (
    <li className="flex items-start gap-2">
      <span className="mt-0.5">
        {state === "running" ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin text-foreground" />
        ) : state === "done" ? (
          <Check
            className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400"
            strokeWidth={2.6}
          />
        ) : state === "skipped" ? (
          <X
            className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400"
            strokeWidth={2.4}
          />
        ) : (
          <Circle
            className="h-3.5 w-3.5 text-muted"
            strokeWidth={1.6}
          />
        )}
      </span>
      <span className="flex min-w-0 flex-col leading-snug">
        <span className="text-foreground">{label}</span>
        <span
          className="truncate font-mono text-[10.5px] text-muted"
          style={{ fontFamily: "var(--font-mono), monospace" }}
        >
          {endpoint}
        </span>
      </span>
    </li>
  );
}

type Phase = "idle" | "confirm" | "running" | "done" | "error";

type ApproveMergeProps = {
  prNumber: number;
  prTitle: string;
};

export function ApproveMerge({ prNumber, prTitle }: ApproveMergeProps) {
  const { mode, canWrite, repo, token } = useConfig();
  const [phase, setPhase] = useState<Phase>("idle");
  const [message, setMessage] = useState<string | null>(null);
  const [sha, setSha] = useState<string | null>(null);
  const [reviewState, setReviewState] = useState<
    "pending" | "running" | "done" | "skipped"
  >("pending");
  const [reviewSkippedReason, setReviewSkippedReason] = useState<string | null>(
    null,
  );

  const disabled = mode === "live" && !canWrite;

  const run = useCallback(async () => {
    setPhase("running");
    setReviewState("running");
    setMessage(null);
    try {
      const source = getRepoSource(mode, repo, token);
      const result = await source.mergePR(prNumber, { commitTitle: prTitle });
      if (result.reviewPosted) setReviewState("done");
      else {
        setReviewState("skipped");
        setReviewSkippedReason(result.reviewSkipped ?? null);
      }
      if (result.merged) {
        setSha(result.sha ?? null);
        setPhase("done");
      } else {
        setMessage(result.message ?? "Merge was rejected.");
        setPhase("error");
      }
    } catch (e) {
      setMessage(e instanceof Error ? e.message : String(e));
      setPhase("error");
    }
  }, [mode, repo, token, prNumber, prTitle]);

  const reset = useCallback(() => {
    setPhase("idle");
    setMessage(null);
    setSha(null);
    setReviewState("pending");
    setReviewSkippedReason(null);
  }, []);

  return (
    <>
      <button
        type="button"
        onClick={() => setPhase("confirm")}
        disabled={phase === "running" || phase === "done" || disabled}
        className="flex h-7 items-center gap-1.5 rounded-md bg-emerald-600 px-2.5 text-[11px] font-medium text-white shadow-[0_1px_4px_rgba(0,0,0,0.18)] transition-all hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
        title={
          disabled
            ? "Token required to merge — re-onboard with a `repo`-scoped PAT."
            : "Approve & squash-merge into main"
        }
      >
        {phase === "running" ? (
          <Loader2 className="h-3 w-3 animate-spin" />
        ) : phase === "done" ? (
          <Check className="h-3 w-3" strokeWidth={2.4} />
        ) : disabled ? (
          <KeyRound className="h-3 w-3" strokeWidth={2.2} />
        ) : (
          <GitMerge className="h-3 w-3" strokeWidth={2.2} />
        )}
        {phase === "done"
          ? "Merged"
          : disabled
            ? "Token required"
            : "Approve & Merge"}
      </button>

      <AnimatePresence>
        {phase === "confirm" || phase === "running" || phase === "error" ? (
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={phase !== "running" ? reset : undefined}
          >
            <motion.div
              role="dialog"
              aria-modal
              onClick={(e) => e.stopPropagation()}
              initial={{ y: 16, scale: 0.96 }}
              animate={{ y: 0, scale: 1 }}
              exit={{ y: 16, scale: 0.96 }}
              transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
              className="w-[min(440px,calc(100vw-32px))] rounded-card border border-border bg-background p-5 shadow-2xl"
            >
              <div className="mb-4 flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-sm font-medium text-foreground">
                    {mode === "live"
                      ? "Squash-merge into main"
                      : "Simulate squash-merge"}
                  </h2>
                  <p className="mt-1 text-[12px] leading-relaxed text-muted">
                    PR #{prNumber} · {prTitle}
                  </p>
                </div>
                {phase !== "running" ? (
                  <button
                    onClick={reset}
                    className="flex h-6 w-6 items-center justify-center rounded-md text-muted hover:bg-subtle hover:text-foreground"
                    aria-label="Cancel"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                ) : null}
              </div>

              {mode === "live" ? (
                <ol className="mb-4 flex flex-col gap-2 text-[12px] leading-relaxed text-muted">
                  <StepRow
                    label="Post APPROVE review"
                    endpoint={`POST /repos/${repo?.owner}/${repo?.repo}/pulls/${prNumber}/reviews`}
                    state={
                      phase === "running"
                        ? reviewState === "running"
                          ? "running"
                          : reviewState === "done"
                            ? "done"
                            : reviewState === "skipped"
                              ? "skipped"
                              : "pending"
                        : "pending"
                    }
                  />
                  <StepRow
                    label="Squash-merge into main"
                    endpoint={`PUT /repos/${repo?.owner}/${repo?.repo}/pulls/${prNumber}/merge`}
                    state={
                      phase === "running" && reviewState !== "running"
                        ? "running"
                        : "pending"
                    }
                  />
                  {reviewState === "skipped" && reviewSkippedReason ? (
                    <li className="rounded-md border border-amber-500/40 bg-amber-500/10 px-2 py-1.5 text-[11px] text-amber-700 dark:text-amber-300">
                      Review skipped — {reviewSkippedReason}. Merging anyway.
                    </li>
                  ) : null}
                </ol>
              ) : (
                <p className="mb-4 text-[12px] leading-relaxed text-muted">
                  In demo mode this only animates — no GitHub call.
                </p>
              )}

              {phase === "error" && message ? (
                <p className="mb-3 rounded-md border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-[12px] text-rose-700 dark:text-rose-300">
                  {message}
                </p>
              ) : null}

              <div className="flex justify-end gap-2">
                <button
                  onClick={reset}
                  disabled={phase === "running"}
                  className="rounded-md border border-border bg-subtle px-3 py-1.5 text-[12px] font-medium text-muted transition-colors hover:bg-background hover:text-foreground disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={run}
                  disabled={phase === "running"}
                  className="flex items-center gap-1.5 rounded-md bg-emerald-600 px-3 py-1.5 text-[12px] font-medium text-white transition-colors hover:bg-emerald-700 disabled:opacity-60"
                >
                  {phase === "running" ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <GitMerge className="h-3 w-3" strokeWidth={2.2} />
                  )}
                  {phase === "running" ? "Merging…" : "Squash-merge"}
                </button>
              </div>
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      <AnimatePresence>
        {phase === "done" ? (
          <motion.div
            className="fixed bottom-6 right-6 z-50 flex items-center gap-2 rounded-md border border-emerald-600/40 bg-emerald-50 px-3 py-2 text-[12px] text-emerald-900 shadow-lg dark:bg-emerald-950 dark:text-emerald-100"
            initial={{ y: 12, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 12, opacity: 0 }}
            transition={{ duration: 0.28 }}
          >
            <Check className="h-3.5 w-3.5" strokeWidth={2.4} />
            <span className="font-medium">Merged</span>
            {sha ? (
              <span
                className="font-mono text-[11px] opacity-70"
                style={{ fontFamily: "var(--font-mono), monospace" }}
              >
                {sha.slice(0, 7)}
              </span>
            ) : null}
          </motion.div>
        ) : null}
      </AnimatePresence>
    </>
  );
}
