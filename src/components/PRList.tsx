"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ExternalLink,
  GitPullRequest,
  Loader2,
  LogOut,
  Network,
  RefreshCw,
} from "lucide-react";
import { useConfig } from "@/components/ConfigContext";
import { getRepoSource } from "@/lib/repo-source/factory";
import type { PRSummary, RepoMeta } from "@/lib/repo-source/types";
import { ThemeToggle } from "@/components/ThemeToggle";

export function PRList() {
  const { mode, repo, token, signOut } = useConfig();
  const [prs, setPRs] = useState<PRSummary[]>([]);
  const [meta, setMeta] = useState<RepoMeta | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  const source = useMemo(() => {
    try {
      return getRepoSource(mode, repo, token);
    } catch {
      return null;
    }
  }, [mode, repo, token]);

  useEffect(() => {
    if (!source) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    Promise.all([source.listPRs(), source.meta()])
      .then(([list, m]) => {
        if (cancelled) return;
        setPRs(list);
        setMeta(m);
      })
      .catch((e) => {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : String(e));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [source, tick]);

  if (!source) {
    return (
      <div className="flex min-h-full items-center justify-center p-6 text-sm text-muted">
        Live mode requires a repo + token.
      </div>
    );
  }

  return (
    <div className="flex min-h-full w-full items-start justify-center px-6 py-16">
      <div className="fixed right-6 top-6 flex items-center gap-2">
        <ThemeToggle />
      </div>
      <div className="w-full max-w-2xl">
        <header className="mb-8 flex items-start justify-between gap-4">
          <div>
            <div
              className="mb-2 flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.18em] text-muted"
              style={{ fontFamily: "var(--font-mono), monospace" }}
            >
              <span
                aria-hidden
                className={`h-1 w-1 rounded-full ${
                  mode === "live" ? "bg-emerald-500" : "bg-amber-500"
                }`}
              />
              {mode === "live" ? "live · github" : "mock · demo data"}
            </div>
            <h1 className="text-[26px] font-medium leading-tight tracking-tight text-foreground">
              {meta?.fullName ?? meta?.name ?? "Loading…"}
            </h1>
            <p className="mt-1 text-sm text-muted">
              {loading
                ? "Fetching open PRs…"
                : `${prs.length} open pull request${prs.length === 1 ? "" : "s"}`}
              {meta?.htmlUrl ? (
                <>
                  {" · "}
                  <a
                    href={meta.htmlUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-0.5 text-muted underline-offset-2 hover:text-foreground hover:underline"
                  >
                    repo
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </>
              ) : null}
            </p>
          </div>
          <div className="flex items-center gap-1.5">
            {mode === "live" ? (
              <Link
                href="/repo"
                className="flex h-7 items-center gap-1.5 rounded-md border border-border/70 bg-subtle/40 px-2.5 text-[11px] font-medium text-muted transition-colors hover:bg-subtle hover:text-foreground"
                title="Knowledge graph"
              >
                <Network className="h-3.5 w-3.5" strokeWidth={1.7} />
                Graph
              </Link>
            ) : null}
            <button
              onClick={() => setTick((t) => t + 1)}
              className="flex h-7 w-7 items-center justify-center rounded-md border border-border/70 bg-subtle/40 text-muted transition-colors hover:bg-subtle hover:text-foreground"
              title="Refresh"
              aria-label="Refresh"
            >
              <RefreshCw
                className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`}
                strokeWidth={1.7}
              />
            </button>
            <button
              onClick={signOut}
              className="flex h-7 items-center gap-1.5 rounded-md border border-border/70 bg-subtle/40 px-2.5 text-[11px] font-medium text-muted transition-colors hover:bg-subtle hover:text-foreground"
              title={mode === "live" ? "Sign out / change repo" : "Connect a real repo"}
            >
              <LogOut className="h-3.5 w-3.5" strokeWidth={1.7} />
              {mode === "live" ? "Change repo" : "Connect repo"}
            </button>
          </div>
        </header>

        {error ? (
          <p className="mb-4 rounded-md border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-[12px] text-rose-700 dark:text-rose-300">
            {error}
          </p>
        ) : null}

        {loading ? (
          <div className="flex items-center justify-center gap-2 py-12 text-sm text-muted">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            Loading…
          </div>
        ) : (
          <ul className="flex flex-col gap-1.5">
            {prs.map((pr) => (
              <li key={pr.number} className="group relative">
                <Link
                  href={`/pr/${pr.number}`}
                  className="flex items-center gap-4 rounded-card border border-border/60 bg-subtle/40 px-5 py-4 pr-16 transition-colors duration-200 hover:border-border hover:bg-subtle"
                >
                  {pr.authorAvatar ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img
                      src={pr.authorAvatar}
                      alt={pr.author}
                      className="h-6 w-6 shrink-0 rounded-full"
                    />
                  ) : (
                    <GitPullRequest
                      className="h-4 w-4 shrink-0 text-emerald-500"
                      strokeWidth={1.8}
                    />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-foreground">
                      {pr.title}
                    </p>
                    <div
                      className="mt-1 flex items-center gap-1.5 font-mono text-[11px] text-muted"
                      style={{ fontFamily: "var(--font-mono), monospace" }}
                    >
                      <span>#{pr.number}</span>
                      <span aria-hidden>·</span>
                      <span>{pr.author}</span>
                      <span aria-hidden>·</span>
                      <span>
                        {pr.filesChanged} file
                        {pr.filesChanged === 1 ? "" : "s"}
                      </span>
                      <span aria-hidden>·</span>
                      <span>{pr.headRef}</span>
                    </div>
                  </div>
                </Link>
                {pr.htmlUrl ? (
                  <a
                    href={pr.htmlUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="absolute right-12 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-md text-muted opacity-0 transition-all duration-200 hover:bg-subtle hover:text-foreground group-hover:opacity-100"
                    title="Open on GitHub"
                    aria-label="Open on GitHub"
                  >
                    <ExternalLink className="h-3.5 w-3.5" strokeWidth={1.7} />
                  </a>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
