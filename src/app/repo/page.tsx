"use client";

// Legacy route — the unified view now lives at `/`. We keep this path
// reachable so any old bookmark or share link redirects sensibly.
import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function LegacyRepoRoute() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/");
  }, [router]);
  return null;
}
