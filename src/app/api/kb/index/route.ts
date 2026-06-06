import { NextResponse } from "next/server";
import { indexRepo } from "@/lib/kb/indexer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300; // Fluid limit; chunked writes keep us honest

// POST /api/kb/index  { owner, repo, ref?, scope?, force? }
export async function POST(req: Request) {
  let body: {
    owner?: string;
    repo?: string;
    ref?: string;
    scope?: string;
    force?: boolean;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  if (!body.owner || !body.repo) {
    return NextResponse.json({ error: "Missing owner/repo" }, { status: 400 });
  }
  try {
    const result = await indexRepo({
      owner: body.owner,
      repo: body.repo,
      ref: body.ref,
      scope: body.scope,
      force: body.force,
    });
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 502 },
    );
  }
}
