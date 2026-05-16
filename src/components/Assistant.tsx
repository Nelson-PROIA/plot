"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Loader2, Send, Sparkles, X } from "lucide-react";
import { useConfig } from "./ConfigContext";
import { usePresentation } from "./PresentationContext";
import { Markdown } from "./Markdown";

type Msg = { role: "user" | "assistant"; content: string };

export type AssistantScope = "repo" | "pr" | "canvas";

export type AssistantContextEntry = {
  scope: AssistantScope;
  /** Short label shown in the panel header — e.g. "PR #2" or "repo graph". */
  label: string;
  content: string;
};

type AssistantContextValue = {
  setContext: (key: string, entry: AssistantContextEntry | null) => void;
  open: (prompt?: string) => void;
};

const AssistantCtx = createContext<AssistantContextValue | null>(null);

export function useAssistantContext(
  key: string,
  entry: AssistantContextEntry | null,
) {
  const ctx = useContext(AssistantCtx);
  // Memoize the entry's identity by primitives so we don't churn the parent
  // map on every render that creates a fresh object.
  const stable = useMemo(() => entry, [entry?.scope, entry?.label, entry?.content]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!ctx) return;
    ctx.setContext(key, stable);
    return () => ctx.setContext(key, null);
  }, [ctx, key, stable]);
}

export function useAssistant() {
  const ctx = useContext(AssistantCtx);
  if (!ctx) throw new Error("useAssistant must be used inside <Assistant>");
  return ctx;
}

const SCOPE_PRIORITY: AssistantScope[] = ["pr", "canvas", "repo"];

const STARTERS: Record<AssistantScope, string[]> = {
  pr: [
    "Walk me through this PR like I'm new to the codebase.",
    "What's the riskiest part of this change?",
    "Are there any tests I should look for?",
  ],
  canvas: [
    "Explain this node and how it relates to the rest of the PR.",
    "What's the impact if I accept this as-is?",
  ],
  repo: [
    "Give me a 5-line overview of this repository.",
    "Which files are the most central to the codebase?",
    "What does the dependency graph tell me?",
  ],
};

const SCOPE_LABELS: Record<AssistantScope, string> = {
  pr: "PR",
  canvas: "canvas node",
  repo: "repo graph",
};

export function Assistant({ children }: { children?: React.ReactNode }) {
  const { repo, openaiKey, mode, onboarded } = useConfig();
  const { presenting } = usePresentation();
  const [isOpen, setOpen_] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [contextMap, setContextMap] = useState<
    Record<string, AssistantContextEntry>
  >({});
  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const sendRef = useRef<((text: string) => Promise<void>) | null>(null);

  const setContext = useCallback(
    (key: string, entry: AssistantContextEntry | null) => {
      setContextMap((prev) => {
        if (entry === null) {
          if (!(key in prev)) return prev;
          const next = { ...prev };
          delete next[key];
          return next;
        }
        if (
          prev[key] &&
          prev[key].content === entry.content &&
          prev[key].scope === entry.scope &&
          prev[key].label === entry.label
        ) {
          return prev;
        }
        return { ...prev, [key]: entry };
      });
    },
    [],
  );

  const open = useCallback((prompt?: string) => {
    setOpen_(true);
    if (prompt) {
      // Wait a tick so the panel mounts before the message goes out.
      setTimeout(() => {
        sendRef.current?.(prompt);
      }, 50);
    }
  }, []);

  const ctxValue = useMemo(
    () => ({ setContext, open }),
    [setContext, open],
  );

  // Determine the most-specific scope to surface in the header.
  const activeScope = useMemo<AssistantScope | null>(() => {
    const scopes = new Set(Object.values(contextMap).map((c) => c.scope));
    for (const s of SCOPE_PRIORITY) if (scopes.has(s)) return s;
    return null;
  }, [contextMap]);

  // Pick the best label from the most-specific scope.
  const scopeLabel = useMemo(() => {
    if (!activeScope) return null;
    const sameScope = Object.values(contextMap).filter(
      (c) => c.scope === activeScope,
    );
    return sameScope[0]?.label ?? SCOPE_LABELS[activeScope];
  }, [contextMap, activeScope]);

  const starters = useMemo(
    () => STARTERS[activeScope ?? "repo"],
    [activeScope],
  );

  const systemPrompt = useMemo(() => {
    const parts: string[] = [];
    parts.push(
      "You are Plot's review assistant — a senior code reviewer embedded in a visual PR-review canvas.",
    );
    parts.push(
      "Answer concisely. Use plain prose; use markdown bullets/headings/code only when they materially aid understanding.",
    );
    if (repo) parts.push(`Repository: ${repo.owner}/${repo.repo}.`);
    if (activeScope) {
      parts.push(
        `Active scope: ${activeScope === "pr" ? "a specific pull request" : activeScope === "canvas" ? "a specific canvas node" : "the repository knowledge graph"} (${scopeLabel}).`,
      );
    }
    const entries = Object.values(contextMap);
    if (entries.length > 0) {
      parts.push("Current context:");
      parts.push(entries.map((e) => `[${e.scope}: ${e.label}]\n${e.content}`).join("\n\n"));
    }
    if (mode === "mock") {
      parts.push(
        "(Note: Plot is running in mock mode — answers should reference the demo PR data, not a real GitHub repo.)",
      );
    }
    return parts.join("\n\n");
  }, [repo, contextMap, mode, activeScope, scopeLabel]);

  useEffect(() => {
    if (scrollerRef.current) {
      scrollerRef.current.scrollTop = scrollerRef.current.scrollHeight;
    }
  }, [messages, busy]);

  const send = useCallback(
    async function send(raw: string) {
      const text = raw.trim();
      if (!text) return;
      setError(null);
      const next: Msg[] = [...messages, { role: "user", content: text }];
      setMessages(next);
      setInput("");
      setBusy(true);

      // Optimistic empty assistant message — we'll fill it as the stream
      // tokens arrive.
      setMessages((m) => [...m, { role: "assistant", content: "" }]);

      try {
        const res = await fetch("/api/ai/chat", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(openaiKey ? { "x-openai-key": openaiKey } : {}),
          },
          body: JSON.stringify({
            messages: next,
            system: systemPrompt,
          }),
        });
        if (!res.ok || !res.body) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body?.error ?? `HTTP ${res.status}`);
        }

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        let accumulated = "";

        const appendDelta = (delta: string) => {
          accumulated += delta;
          setMessages((m) => {
            const next = [...m];
            const last = next[next.length - 1];
            if (last && last.role === "assistant") {
              next[next.length - 1] = { role: "assistant", content: accumulated };
            }
            return next;
          });
        };

        // Parse SSE: events terminated by "\n\n", each line "data: …"
        // eslint-disable-next-line no-constant-condition
        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          let idx: number;
          while ((idx = buffer.indexOf("\n\n")) >= 0) {
            const chunk = buffer.slice(0, idx).trim();
            buffer = buffer.slice(idx + 2);
            if (!chunk) continue;
            for (const line of chunk.split("\n")) {
              if (!line.startsWith("data:")) continue;
              const payload = line.slice(5).trim();
              if (payload === "[DONE]") {
                continue;
              }
              try {
                const obj = JSON.parse(payload) as {
                  delta?: string;
                  error?: string;
                };
                if (obj.error) throw new Error(obj.error);
                if (obj.delta) appendDelta(obj.delta);
              } catch {
                /* ignore malformed line */
              }
            }
          }
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
        // Drop the (empty) optimistic assistant bubble on error.
        setMessages((m) => {
          const next = [...m];
          if (next.length && next[next.length - 1].role === "assistant" && !next[next.length - 1].content) {
            next.pop();
          }
          return next;
        });
      } finally {
        setBusy(false);
      }
    },
    [messages, openaiKey, systemPrompt],
  );

  useEffect(() => {
    sendRef.current = send;
  }, [send]);

  return (
    <AssistantCtx.Provider value={ctxValue}>
      {children}
      {!presenting && onboarded ? (
        <button
          type="button"
          onClick={() => setOpen_((o) => !o)}
          title={isOpen ? "Close assistant" : "Open assistant"}
          aria-label="Toggle Plot assistant"
          className="fixed bottom-6 right-6 z-40 flex h-10 items-center gap-1.5 rounded-full border border-border bg-foreground px-3 text-[12px] font-medium text-background shadow-[0_8px_24px_rgba(0,0,0,0.25)] transition-all hover:scale-[1.04]"
        >
          <Sparkles className="h-3.5 w-3.5" strokeWidth={2.2} />
          Ask Plot
        </button>
      ) : null}

      <AnimatePresence>
        {isOpen ? (
          <motion.aside
            key="assistant"
            initial={{ x: "100%", opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: "100%", opacity: 0 }}
            transition={{ type: "spring", stiffness: 280, damping: 32 }}
            className="fixed right-0 top-0 z-40 flex h-full w-[min(420px,100vw)] flex-col border-l border-border/60 bg-background shadow-2xl"
          >
            <header className="flex h-12 shrink-0 items-center justify-between border-b border-border/60 px-4">
              <div className="flex min-w-0 items-center gap-2">
                <Sparkles
                  className="h-4 w-4 shrink-0"
                  strokeWidth={1.8}
                  style={{ color: "var(--accent-alternatives)" }}
                />
                <span className="text-sm font-medium text-foreground">
                  Review assistant
                </span>
                {activeScope ? (
                  <span
                    className="ml-1 truncate rounded-full bg-subtle px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-muted"
                    title={`Scope: ${activeScope}`}
                  >
                    {scopeLabel}
                  </span>
                ) : null}
              </div>
              <button
                onClick={() => setOpen_(false)}
                aria-label="Close"
                className="flex h-7 w-7 items-center justify-center rounded-md text-muted hover:bg-subtle hover:text-foreground"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </header>

            <div
              ref={scrollerRef}
              className="flex-1 overflow-y-auto px-4 py-3"
            >
              {messages.length === 0 ? (
                <div className="flex flex-col gap-3 text-[12.5px] leading-relaxed text-muted">
                  <p>
                    Scoped to{" "}
                    <span className="text-foreground">
                      {scopeLabel ?? (repo ? `${repo.owner}/${repo.repo}` : "this canvas")}
                    </span>
                    . Ask anything about the code, the PR, or how to review it.
                  </p>
                  <ul className="flex flex-col gap-1.5">
                    {starters.map((q) => (
                      <li key={q}>
                        <button
                          onClick={() => send(q)}
                          className="w-full rounded-md border border-border/60 bg-subtle/40 px-3 py-2 text-left text-[12px] text-foreground transition-colors hover:bg-subtle"
                        >
                          {q}
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : (
                <div className="flex flex-col gap-3">
                  {messages.map((m, i) => (
                    <Bubble key={i} role={m.role} content={m.content} />
                  ))}
                  {busy ? (
                    <div className="flex items-center gap-2 text-[12px] text-muted">
                      <Loader2 className="h-3 w-3 animate-spin" />
                      thinking…
                    </div>
                  ) : null}
                </div>
              )}
              {error ? (
                <p className="mt-3 rounded-md border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-[11.5px] text-rose-700 dark:text-rose-300">
                  {error}
                </p>
              ) : null}
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                send(input);
              }}
              className="flex shrink-0 items-end gap-2 border-t border-border/60 p-3"
            >
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    send(input);
                  }
                }}
                rows={2}
                placeholder="Ask anything…"
                className="min-h-[40px] flex-1 resize-none rounded-md border border-border bg-subtle px-3 py-2 text-[12.5px] text-foreground placeholder:text-muted focus:border-foreground/40 focus:outline-none"
              />
              <button
                type="submit"
                disabled={busy || !input.trim()}
                aria-label="Send"
                className="flex h-9 w-9 items-center justify-center rounded-md bg-foreground text-background transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <Send className="h-3.5 w-3.5" strokeWidth={2} />
              </button>
            </form>
          </motion.aside>
        ) : null}
      </AnimatePresence>
    </AssistantCtx.Provider>
  );
}

function Bubble({ role, content }: { role: Msg["role"]; content: string }) {
  const isUser = role === "user";
  if (isUser) {
    return (
      <div
        className="ml-8 self-end rounded-card bg-foreground px-3 py-2 text-[12.5px] leading-relaxed text-background"
        style={{ whiteSpace: "pre-wrap" }}
      >
        {content}
      </div>
    );
  }
  return (
    <div className="mr-8 rounded-card border border-border/60 bg-subtle px-3 py-2 text-[12.5px] leading-relaxed text-foreground">
      <Markdown>{content}</Markdown>
    </div>
  );
}
