"use client";

import { useEffect } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

type SheetProps = {
  open: boolean;
  onClose: () => void;
  title?: string;
  subtitle?: string;
  accent?: string;
  children: React.ReactNode;
  widthClass?: string;
};

export function Sheet({
  open,
  onClose,
  title,
  subtitle,
  accent,
  children,
  widthClass = "w-[480px]",
}: SheetProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (typeof document === "undefined") return null;

  return createPortal(
    <AnimatePresence>
      {open ? (
        <motion.div
          className="fixed inset-0 z-50 flex justify-end"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
        >
          <motion.div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={onClose}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          />
          <motion.aside
            className={cn(
              "relative h-full overflow-hidden border-l border-border/60 bg-background shadow-2xl",
              widthClass,
            )}
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", stiffness: 260, damping: 32 }}
          >
            <div className="flex h-14 items-center justify-between border-b border-border/60 px-5">
              <div className="flex items-center gap-3">
                {accent ? (
                  <span
                    aria-hidden
                    className="h-2 w-2 rounded-full"
                    style={{ background: accent }}
                  />
                ) : null}
                <div className="flex flex-col">
                  {title ? (
                    <span className="text-sm font-medium text-foreground">
                      {title}
                    </span>
                  ) : null}
                  {subtitle ? (
                    <span className="text-xs text-muted">{subtitle}</span>
                  ) : null}
                </div>
              </div>
              <button
                onClick={onClose}
                className="flex h-7 w-7 items-center justify-center rounded-md text-muted transition-colors hover:bg-subtle hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="h-[calc(100%-3.5rem)] overflow-y-auto px-5 py-4">
              {children}
            </div>
          </motion.aside>
        </motion.div>
      ) : null}
    </AnimatePresence>,
    document.body,
  );
}
