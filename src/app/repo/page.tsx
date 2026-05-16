"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useConfig } from "@/components/ConfigContext";
import { RepoGraphView } from "@/components/RepoGraphView";

export default function RepoGraphPage() {
  const router = useRouter();
  const { hydrated, mode, onboarded } = useConfig();

  useEffect(() => {
    if (!hydrated) return;
    if (!onboarded) router.replace("/");
  }, [hydrated, onboarded, router]);

  if (!hydrated) return null;
  if (mode !== "live") {
    return (
      <div className="flex h-full items-center justify-center p-6 text-sm text-muted">
        The knowledge graph requires live mode.
      </div>
    );
  }
  return <RepoGraphView />;
}
