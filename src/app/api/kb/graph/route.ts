import { NextResponse } from "next/server";
import { serveGraph } from "@/lib/kb/serve";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/kb/graph?owner=&repo=
// Serves the RepoGraph payload (canvas compat shape) from the latest ready
// snapshot in Postgres. 404 until the repo has been indexed.
export async function GET(req: Request) {
  const url = new URL(req.url);
  const owner = url.searchParams.get("owner");
  const repo = url.searchParams.get("repo");
  if (!owner || !repo) {
    return NextResponse.json({ error: "Missing owner/repo" }, { status: 400 });
  }
  try {
    const graph = await serveGraph(owner, repo);
    if (!graph) {
      return NextResponse.json(
        { error: "Repo not indexed", notIndexed: true },
        { status: 404 },
      );
    }
    return NextResponse.json(graph);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 502 },
    );
  }
}
