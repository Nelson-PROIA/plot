import { NextResponse } from "next/server";
import { and, count, desc, eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { files, repos, snapshots } from "@/lib/db/schema";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/kb/status?owner=&repo=
// Progress = persisted files / fileCount; the files rows ARE the counter.
export async function GET(req: Request) {
  const url = new URL(req.url);
  const owner = url.searchParams.get("owner");
  const repo = url.searchParams.get("repo");
  if (!owner || !repo) {
    return NextResponse.json({ error: "Missing owner/repo" }, { status: 400 });
  }

  const db = getDb();
  const repoRows = await db
    .select({ id: repos.id })
    .from(repos)
    .where(and(eq(repos.owner, owner), eq(repos.name, repo)));
  if (repoRows.length === 0) {
    return NextResponse.json({ status: "unknown" }, { status: 404 });
  }

  const snapRows = await db
    .select({
      id: snapshots.id,
      status: snapshots.status,
      commitSha: snapshots.commitSha,
      fileCount: snapshots.fileCount,
      indexedAt: snapshots.indexedAt,
    })
    .from(snapshots)
    .where(eq(snapshots.repoId, repoRows[0].id))
    .orderBy(desc(snapshots.id))
    .limit(1);
  if (snapRows.length === 0) {
    return NextResponse.json({ status: "unknown" }, { status: 404 });
  }
  const snap = snapRows[0];

  const [{ value: indexedFiles }] = await db
    .select({ value: count() })
    .from(files)
    .where(eq(files.snapshotId, snap.id));

  return NextResponse.json({
    status: snap.status,
    commitSha: snap.commitSha,
    fileCount: snap.fileCount,
    indexedFiles,
    indexedAt: snap.indexedAt,
  });
}
