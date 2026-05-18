"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { GitBranch, Loader2, ArrowRight } from "lucide-react";
import { useConfig } from "@/components/ConfigContext";
import { getOctokit } from "@/lib/octokit-client";
import { parseRepoUrl } from "@/lib/repo-source/types";
import { ThemeToggle } from "@/components/ThemeToggle";

export function Onboarding() {
  const router = useRouter();
  const { setRepo, setToken, setOnboarded } = useConfig();
  const [url, setUrl] = useState("https://github.com/Nelson-PROIA/float");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const parsed = parseRepoUrl(url);
    if (!parsed) {
      setError("Couldn't parse that — try `owner/repo` or a github.com URL.");
      return;
    }
    setBusy(true);
    try {
      const octokit = getOctokit();
      await octokit.rest.repos.get({
        owner: parsed.owner,
        repo: parsed.repo,
      });
      setRepo(parsed);
      setToken(null);
      setOnboarded("live");
      router.replace("/");
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(`GitHub rejected the request: ${msg}`);
    } finally {
      setBusy(false);
    }
  };

  const useDemo = () => {
    setRepo(null);
    setToken(null);
    setOnboarded("mock");
    router.replace("/");
  };

  return (
    <div className="flex min-h-full w-full items-center justify-center px-6 py-16">
      <div className="fixed right-6 top-6">
        <ThemeToggle />
      </div>
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.34, ease: [0.22, 1, 0.36, 1] }}
        className="w-full max-w-md"
      >
        <div
          className="mb-3 flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.18em] text-muted"
          style={{ fontFamily: "var(--font-mono), monospace" }}
        >
          <span aria-hidden className="h-1 w-1 rounded-full bg-emerald-400" />
          surface
        </div>
        <h1 className="mb-2 text-[26px] font-medium leading-tight tracking-tight text-foreground">
          Open a repository
        </h1>
        <p className="mb-8 text-sm leading-relaxed text-muted">
          Paste a public GitHub URL. Plot reads the repo through GitHub&apos;s
          public API — no token required.
        </p>

        <form onSubmit={submit} className="flex flex-col gap-3">
          <label className="flex flex-col gap-1.5">
            <span className="text-[11px] font-medium uppercase tracking-wider text-muted">
              Repository
            </span>
            <div className="relative">
              <GitBranch className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted" />
              <input
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="github.com/owner/repo"
                className="w-full rounded-md border border-border bg-subtle py-2 pl-9 pr-3 text-sm text-foreground placeholder:text-muted focus:border-foreground/40 focus:outline-none"
                spellCheck={false}
                autoComplete="off"
              />
            </div>
          </label>
          {error ? (
            <p className="rounded-md border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-[12px] text-rose-700 dark:text-rose-300">
              {error}
            </p>
          ) : null}
          <button
            type="submit"
            disabled={busy}
            className="mt-1 flex h-10 items-center justify-center gap-2 rounded-md bg-foreground text-[13px] font-medium text-background transition-colors hover:bg-foreground/90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <ArrowRight className="h-3.5 w-3.5" />
            )}
            {busy ? "Verifying" : "Open repo"}
          </button>
        </form>

        <div className="mt-6 flex items-center justify-between border-t border-border/60 pt-4">
          <span className="text-[11px] text-muted">
            Or skip and see the demo canvas with mock data.
          </span>
          <button
            type="button"
            onClick={useDemo}
            className="rounded-md border border-border px-2.5 py-1 text-[11px] font-medium text-muted transition-colors hover:bg-subtle hover:text-foreground"
          >
            Demo mode
          </button>
        </div>
      </motion.div>
    </div>
  );
}
