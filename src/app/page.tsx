"use client";

import { useConfig } from "@/components/ConfigContext";
import { Onboarding } from "@/components/Onboarding";
import { RepoGraphView } from "@/components/RepoGraphView";

export default function Home() {
  const { hydrated, onboarded, mode } = useConfig();

  if (!hydrated) {
    return (
      <div className="flex min-h-full items-center justify-center text-sm text-muted">
        …
      </div>
    );
  }

  if (!onboarded) return <Onboarding />;

  if (mode !== "live") {
    return (
      <div className="flex h-full items-center justify-center p-6 text-sm text-muted">
        Live mode required.
      </div>
    );
  }

  return <RepoGraphView />;
}
