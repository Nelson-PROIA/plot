"use client";

import { use, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronLeft, ExternalLink, Loader2 } from "lucide-react";
import { Canvas } from "@/components/Canvas";
import { Sidebar } from "@/components/Sidebar";
import { ApproveMerge } from "@/components/ApproveMerge";
import { useAssistantContext } from "@/components/Assistant";
import { useConfig } from "@/components/ConfigContext";
import { usePresentation } from "@/components/PresentationContext";
import { getRepoSource } from "@/lib/repo-source/factory";
import { enrichCanvasWithAI } from "@/lib/ai/enrich-canvas";
import { loadCachedEnrichment, saveCachedEnrichment } from "@/lib/ai/cache";
import { Octokit } from "@octokit/rest";
import type {
  PRSummary,
  RepoMeta,
} from "@/lib/repo-source/types";
import type { PRCanvas } from "@/lib/types";

type PageProps = {
  params: Promise<{ number: string }>;
};

export default function PRPage({ params }: PageProps) {
  const { number } = use(params);
  const router = useRouter();
  const { mode, repo, token, openaiKey, onboarded, hydrated } = useConfig();
  const { presenting } = usePresentation();
  const [canvas, setCanvas] = useState<PRCanvas | null>(null);
  const [meta, setMeta] = useState<RepoMeta | null>(null);
  const [prs, setPrs] = useState<PRSummary[]>([]);
  const [error, setError] = useState<string | null>(null);

  const source = useMemo(() => {
    try {
      return getRepoSource(mode, repo, token);
    } catch {
      return null;
    }
  }, [mode, repo, token]);

  useEffect(() => {
    if (!hydrated) return;
    if (!onboarded) {
      router.replace("/");
      return;
    }
  }, [hydrated, onboarded, router]);

  useEffect(() => {
    if (!source) return;
    let cancelled = false;
    setError(null);
    Promise.all([
      source.getPRCanvas(Number(number)),
      source.meta(),
      source.listPRs(),
    ])
      .then(async ([c, m, list]) => {
        if (cancelled) return;
        setCanvas(c);
        setMeta(m);
        setPrs(list);

        // ─── AI enrichment (best-effort, async, doesn't block the canvas).
        //     Cached by PR head SHA so repeat opens are instant.
        if (mode === "live" && repo) {
          try {
            const octokit = new Octokit(token ? { auth: token } : {});
            const pr = list.find((p) => p.number === Number(number));
            const headSha = pr?.headSha;
            if (headSha) {
              const cached = loadCachedEnrichment(
                repo.owner,
                repo.repo,
                headSha,
              );
              if (cached) {
                if (!cancelled) setCanvas(cached);
              } else if (openaiKey || process.env.NEXT_PUBLIC_OPENAI_KEY) {
                // Only spend AI tokens when we have a key to call.
                const { data: files } = await octokit.rest.pulls.listFiles({
                  owner: repo.owner,
                  repo: repo.repo,
                  pull_number: Number(number),
                  per_page: 30,
                });
                if (pr) {
                  const enriched = await enrichCanvasWithAI(
                    c,
                    {
                      title: pr.title,
                      body: pr.body,
                      files: files.map((f) => ({
                        filename: f.filename,
                        additions: f.additions,
                        deletions: f.deletions,
                        patch: f.patch,
                      })),
                    },
                    openaiKey ?? null,
                    (partial) => {
                      if (!cancelled) setCanvas(partial);
                    },
                  );
                  if (!cancelled) setCanvas(enriched);
                  saveCachedEnrichment(repo.owner, repo.repo, headSha, enriched);
                }
              }
            }
          } catch {
            /* leave heuristic canvas in place */
          }
        }
      })
      .catch((e) => {
        if (!cancelled)
          setError(e instanceof Error ? e.message : String(e));
      });
    return () => {
      cancelled = true;
    };
  }, [source, number, mode, repo, token, openaiKey]);

  // Provide PR context to the assistant. Must be called unconditionally on
  // every render so that conditional returns below don't break the hook order.
  const currentPR = prs.find((p) => p.number === Number(number));
  useAssistantContext(
    `pr-${number}`,
    currentPR
      ? {
          scope: "pr",
          label: `PR #${currentPR.number}`,
          content: `PR #${currentPR.number}: ${currentPR.title}\nAuthor: ${currentPR.author}\nBranch: ${currentPR.headRef} -> ${currentPR.baseRef}\nFiles changed: ${currentPR.filesChanged}\n\nPR body:\n${(currentPR.body ?? "").slice(0, 4000)}`,
        }
      : null,
  );

  if (!hydrated) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-muted">
        …
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-sm text-muted">
        <p className="rounded-md border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-rose-700 dark:text-rose-300">
          {error}
        </p>
        <Link
          href="/"
          className="rounded-md border border-border px-2.5 py-1 text-[11px] font-medium hover:bg-subtle"
        >
          Back to repo
        </Link>
      </div>
    );
  }

  if (!canvas || !meta) {
    return (
      <div className="flex h-full items-center justify-center gap-2 text-sm text-muted">
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
        Loading PR #{number}…
      </div>
    );
  }

  return (
    <div className="flex h-full w-full">
      {presenting ? null : (
        <Sidebar
          repoName={meta.name}
          prs={prs.map((p) => ({
            number: p.number,
            title: p.title,
            author: p.author,
            files_changed: p.filesChanged,
          }))}
          currentNumber={number}
        />
      )}
      <div className="flex h-full min-w-0 flex-1 flex-col">
        <header
          className="z-10 flex h-12 shrink-0 items-center gap-3 border-b border-border/60 bg-background/80 px-4 backdrop-blur"
          style={presenting ? { display: "none" } : undefined}
        >
          <Link
            href="/"
            className="flex h-7 w-7 items-center justify-center rounded-md text-muted transition-colors hover:bg-subtle hover:text-foreground"
            aria-label="Back to PR list"
          >
            <ChevronLeft className="h-4 w-4" />
          </Link>
          <div
            className="flex items-center gap-1.5 font-mono text-[12px]"
            style={{ fontFamily: "var(--font-mono), monospace" }}
          >
            <span className="text-muted">{meta.fullName ?? meta.name}</span>
            <span className="text-muted">/</span>
            <span className="text-muted">pull</span>
            <span className="text-muted">/</span>
            <span className="font-medium text-foreground">#{number}</span>
          </div>
          <span className="text-muted">·</span>
          <h1 className="min-w-0 truncate text-sm font-medium text-foreground">
            {currentPR?.title ?? `PR #${number}`}
          </h1>
          <div className="ml-auto flex items-center gap-1.5">
            {currentPR?.author ? (
              <span className="text-xs text-muted">
                opened by{" "}
                <span className="text-foreground/85">{currentPR.author}</span>
              </span>
            ) : null}
            {currentPR?.htmlUrl ? (
              <a
                href={currentPR.htmlUrl}
                target="_blank"
                rel="noreferrer"
                className="flex h-7 items-center gap-1.5 rounded-md border border-border/70 bg-subtle/40 px-2.5 text-[11px] font-medium text-muted transition-colors hover:bg-subtle hover:text-foreground"
                title="Open on GitHub"
              >
                <ExternalLink className="h-3 w-3" strokeWidth={1.8} />
                GitHub
              </a>
            ) : null}
            <ApproveMerge
              prNumber={Number(number)}
              prTitle={currentPR?.title ?? ""}
            />
          </div>
        </header>
        <div className="relative flex-1">
          <Canvas
            nodes={canvas.nodes}
            edges={canvas.edges}
            tour={canvas.tour}
          />
        </div>
      </div>
    </div>
  );
}
