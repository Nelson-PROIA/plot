"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

export type Theme = "dark" | "light";

type ThemeContextValue = {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  toggle: () => void;
  mounted: boolean;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

const STORAGE_KEY = "surface-theme";

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  // SSR + first client render always agree on "dark" so hydration matches.
  const [theme, setThemeState] = useState<Theme>("dark");
  const [mounted, setMounted] = useState(false);

  // On mount, read the user's saved preference (if any) and reconcile.
  useEffect(() => {
    let stored: Theme | null = null;
    try {
      const v = localStorage.getItem(STORAGE_KEY);
      if (v === "dark" || v === "light") stored = v;
    } catch {
      /* ignore */
    }
    if (stored && stored !== theme) {
      setThemeState(stored);
    }
    setMounted(true);
    // intentionally only runs once
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sync class + storage whenever theme changes.
  useEffect(() => {
    if (!mounted) return;
    const root = document.documentElement;
    root.classList.toggle("dark", theme === "dark");
    root.classList.toggle("light", theme === "light");
    try {
      localStorage.setItem(STORAGE_KEY, theme);
    } catch {
      /* ignore */
    }
  }, [theme, mounted]);

  const setTheme = useCallback((t: Theme) => setThemeState(t), []);
  const toggle = useCallback(
    () => setThemeState((t) => (t === "dark" ? "light" : "dark")),
    [],
  );

  const value = useMemo(
    () => ({ theme, setTheme, toggle, mounted }),
    [theme, setTheme, toggle, mounted],
  );

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
}
