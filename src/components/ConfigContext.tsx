"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import type { Mode, RepoRef } from "@/lib/repo-source/types";

type OnboardState = null | "live" | "mock";

type ConfigContextValue = {
  mode: Mode;
  /** True when a write-capable GitHub token is present. */
  canWrite: boolean;
  repo: RepoRef | null;
  token: string | null;
  openaiKey: string | null;
  onboarded: OnboardState;
  hydrated: boolean;
  setRepo: (r: RepoRef | null) => void;
  setToken: (t: string | null) => void;
  setOpenaiKey: (k: string | null) => void;
  setOnboarded: (state: OnboardState) => void;
  signOut: () => void;
};

const ConfigContext = createContext<ConfigContextValue | null>(null);

const REPO_KEY = "plot-repo";
const TOKEN_KEY = "plot-token";
const OPENAI_KEY = "plot-openai-key";
const ONBOARDED_KEY = "plot-onboarded";

export function ConfigProvider({ children }: { children: React.ReactNode }) {
  const [repo, setRepoState] = useState<RepoRef | null>(null);
  const [token, setTokenState] = useState<string | null>(null);
  const [openaiKey, setOpenaiKeyState] = useState<string | null>(null);
  const [onboarded, setOnboardedState] = useState<OnboardState>(null);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const r = localStorage.getItem(REPO_KEY);
      if (r) setRepoState(JSON.parse(r));
      const t = localStorage.getItem(TOKEN_KEY);
      if (t) setTokenState(t);
      const ai = localStorage.getItem(OPENAI_KEY);
      if (ai) setOpenaiKeyState(ai);
      const o = localStorage.getItem(ONBOARDED_KEY);
      if (o === "live" || o === "mock") setOnboardedState(o);
    } catch {
      /* ignore */
    }
    setHydrated(true);
  }, []);

  const setRepo = useCallback((r: RepoRef | null) => {
    setRepoState(r);
    try {
      if (r) localStorage.setItem(REPO_KEY, JSON.stringify(r));
      else localStorage.removeItem(REPO_KEY);
    } catch {
      /* ignore */
    }
  }, []);

  const setToken = useCallback((t: string | null) => {
    setTokenState(t);
    try {
      if (t) localStorage.setItem(TOKEN_KEY, t);
      else localStorage.removeItem(TOKEN_KEY);
    } catch {
      /* ignore */
    }
  }, []);

  const setOpenaiKey = useCallback((k: string | null) => {
    setOpenaiKeyState(k);
    try {
      if (k) localStorage.setItem(OPENAI_KEY, k);
      else localStorage.removeItem(OPENAI_KEY);
    } catch {
      /* ignore */
    }
  }, []);

  const setOnboarded = useCallback((state: OnboardState) => {
    setOnboardedState(state);
    try {
      if (state) localStorage.setItem(ONBOARDED_KEY, state);
      else localStorage.removeItem(ONBOARDED_KEY);
    } catch {
      /* ignore */
    }
  }, []);

  const signOut = useCallback(() => {
    setRepo(null);
    setToken(null);
    setOnboarded(null);
    // Keep the OpenAI key so the operator doesn't have to re-paste it.
  }, [setRepo, setToken, setOnboarded]);

  // Live mode whenever a repo has been configured (token is optional — without
  // it Plot uses GitHub's unauthenticated public API for reads, but write
  // actions like merge are disabled).
  const mode: Mode = repo ? "live" : "mock";
  const canWrite = !!token;

  const value = useMemo(
    () => ({
      mode,
      canWrite,
      repo,
      token,
      openaiKey,
      onboarded,
      hydrated,
      setRepo,
      setToken,
      setOpenaiKey,
      setOnboarded,
      signOut,
    }),
    [
      mode,
      canWrite,
      repo,
      token,
      openaiKey,
      onboarded,
      hydrated,
      setRepo,
      setToken,
      setOpenaiKey,
      setOnboarded,
      signOut,
    ],
  );

  return (
    <ConfigContext.Provider value={value}>{children}</ConfigContext.Provider>
  );
}

export function useConfig() {
  const ctx = useContext(ConfigContext);
  if (!ctx) throw new Error("useConfig must be inside ConfigProvider");
  return ctx;
}
