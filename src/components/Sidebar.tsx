"use client";

import { useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { PanelLeftClose, PanelLeftOpen, GitPullRequest } from "lucide-react";
import { cn } from "@/lib/utils";
import type { PRSummary } from "@/lib/types";

type SidebarProps = {
  repoName: string;
  prs: PRSummary[];
  currentNumber: string;
};

export function Sidebar({ repoName, prs, currentNumber }: SidebarProps) {
  const [open, setOpen] = useState(true);

  return (
    <motion.aside
      animate={{ width: open ? 240 : 44 }}
      transition={{ type: "spring", stiffness: 280, damping: 32 }}
      className="relative flex h-full shrink-0 flex-col overflow-hidden border-r border-border/60 bg-background/60 backdrop-blur"
    >
      <div className="flex h-12 shrink-0 items-center justify-between border-b border-border/60 px-3">
        {open ? (
          <Link
            href="/"
            className="flex items-center gap-2 truncate font-mono text-[12px] font-medium text-foreground"
            style={{ fontFamily: "var(--font-mono), monospace" }}
          >
            <span
              aria-hidden
              className="h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-400"
            />
            <span className="truncate">{repoName}</span>
          </Link>
        ) : (
          <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
        )}
        <button
          onClick={() => setOpen((v) => !v)}
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-muted transition-colors hover:bg-subtle hover:text-foreground"
          aria-label={open ? "Collapse sidebar" : "Open sidebar"}
        >
          {open ? (
            <PanelLeftClose className="h-4 w-4" />
          ) : (
            <PanelLeftOpen className="h-4 w-4" />
          )}
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {open ? (
          <div className="px-2 py-3">
            <p className="px-2 pb-2 text-[10px] font-medium uppercase tracking-wider text-muted">
              Open PRs · {prs.length}
            </p>
            <ul className="flex flex-col gap-0.5">
              {prs.map((pr) => {
                const isActive = String(pr.number) === currentNumber;
                return (
                  <li key={pr.number}>
                    <Link
                      href={`/pr/${pr.number}`}
                      className={cn(
                        "group flex items-start gap-2 rounded-md px-2 py-2 transition-colors",
                        isActive
                          ? "bg-subtle"
                          : "hover:bg-subtle/60",
                      )}
                    >
                      <GitPullRequest
                        className={cn(
                          "mt-[2px] h-3.5 w-3.5 shrink-0",
                          isActive ? "text-emerald-400" : "text-muted",
                        )}
                        strokeWidth={1.8}
                      />
                      <div className="min-w-0 flex-1">
                        <p
                          className={cn(
                            "truncate text-[12px] font-medium leading-snug",
                            isActive ? "text-foreground" : "text-foreground/85",
                          )}
                        >
                          {pr.title}
                        </p>
                        <p className="mt-0.5 truncate text-[10.5px] text-muted">
                          <span
                            className="font-mono"
                            style={{
                              fontFamily: "var(--font-mono), monospace",
                            }}
                          >
                            #{pr.number}
                          </span>{" "}
                          · {pr.author} · {pr.files_changed} files
                        </p>
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2 py-3">
            {prs.map((pr) => {
              const isActive = String(pr.number) === currentNumber;
              return (
                <Link
                  key={pr.number}
                  href={`/pr/${pr.number}`}
                  title={`#${pr.number} — ${pr.title}`}
                  className={cn(
                    "flex h-7 w-7 items-center justify-center rounded-md transition-colors",
                    isActive
                      ? "bg-subtle text-emerald-400"
                      : "text-muted hover:bg-subtle/60 hover:text-foreground",
                  )}
                >
                  <GitPullRequest className="h-3.5 w-3.5" strokeWidth={1.8} />
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </motion.aside>
  );
}
