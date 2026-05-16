"use client";

import { Moon, Sun } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useTheme } from "./ThemeProvider";
import { cn } from "@/lib/utils";

type ThemeToggleProps = {
  className?: string;
};

export function ThemeToggle({ className }: ThemeToggleProps) {
  const { theme, toggle, mounted } = useTheme();
  const isDark = theme === "dark";

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      className={cn(
        "relative flex h-7 w-7 items-center justify-center overflow-hidden rounded-md border border-border/60 bg-subtle/40 text-muted transition-colors hover:border-border hover:bg-subtle hover:text-foreground",
        className,
      )}
    >
      {/*
        Until ThemeProvider has reconciled with localStorage we render an empty
        icon shell so server and client output match — prevents hydration flicker.
      */}
      <AnimatePresence mode="wait" initial={false}>
        {!mounted ? (
          <span key="placeholder" aria-hidden className="h-3.5 w-3.5" />
        ) : isDark ? (
          <motion.span
            key="moon"
            initial={{ y: 10, opacity: 0, rotate: -30 }}
            animate={{ y: 0, opacity: 1, rotate: 0 }}
            exit={{ y: -10, opacity: 0, rotate: 30 }}
            transition={{ duration: 0.18 }}
            className="absolute inset-0 flex items-center justify-center"
          >
            <Moon className="h-3.5 w-3.5" strokeWidth={1.6} />
          </motion.span>
        ) : (
          <motion.span
            key="sun"
            initial={{ y: 10, opacity: 0, rotate: -30 }}
            animate={{ y: 0, opacity: 1, rotate: 0 }}
            exit={{ y: -10, opacity: 0, rotate: 30 }}
            transition={{ duration: 0.18 }}
            className="absolute inset-0 flex items-center justify-center"
          >
            <Sun className="h-3.5 w-3.5" strokeWidth={1.6} />
          </motion.span>
        )}
      </AnimatePresence>
    </button>
  );
}
