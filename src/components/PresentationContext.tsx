"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";

type PresentationContextValue = {
  presenting: boolean;
  toggle: () => void;
  exit: () => void;
};

const PresentationContext = createContext<PresentationContextValue | null>(
  null,
);

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
  if (target.isContentEditable) return true;
  return false;
}

export function PresentationProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [presenting, setPresenting] = useState(false);

  const toggle = useCallback(() => setPresenting((v) => !v), []);
  const exit = useCallback(() => setPresenting(false), []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (isTypingTarget(e.target)) return;
      if ((e.key === "p" || e.key === "P") && !e.shiftKey) {
        e.preventDefault();
        toggle();
      }
      if (e.key === "Escape" && presenting) {
        e.preventDefault();
        exit();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [presenting, toggle, exit]);

  return (
    <PresentationContext.Provider value={{ presenting, toggle, exit }}>
      {children}
      {presenting ? (
        <button
          type="button"
          onClick={exit}
          className="fixed right-4 top-4 z-[60] flex h-6 items-center gap-1.5 rounded-full border border-border/60 bg-background/80 px-2 text-[10px] font-medium uppercase tracking-wider text-muted shadow-sm backdrop-blur transition-colors hover:text-foreground"
          title="Exit presentation mode (Esc / P)"
        >
          <span className="h-1.5 w-1.5 rounded-full bg-rose-500" />
          presenting
          <span className="rounded border border-border/70 bg-subtle px-1 font-mono text-[9px] text-foreground/80">
            esc
          </span>
        </button>
      ) : null}
    </PresentationContext.Provider>
  );
}

export function usePresentation(): PresentationContextValue {
  const ctx = useContext(PresentationContext);
  if (!ctx)
    throw new Error("usePresentation must be used within PresentationProvider");
  return ctx;
}
