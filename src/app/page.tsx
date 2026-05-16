"use client";

import { useConfig } from "@/components/ConfigContext";
import { Onboarding } from "@/components/Onboarding";
import { PRList } from "@/components/PRList";

export default function Home() {
  const { hydrated, onboarded } = useConfig();

  if (!hydrated) {
    return (
      <div className="flex min-h-full items-center justify-center text-sm text-muted">
        …
      </div>
    );
  }

  if (!onboarded) return <Onboarding />;
  return <PRList />;
}
