import { NextResponse } from "next/server";
import { fetchRawFile } from "@/lib/github-raw";

export const runtime = "nodejs";
export const revalidate = 3600;

type Body = {
  owner: string;
  repo: string;
  ref?: string;
  paths: string[];
};

const PAR = 12;

/**
 * Batch fetch raw source for a list of files via raw.githubusercontent.com.
 * Used by the unified canvas when the user descends to the `code` level —
 * every visible symbol needs its file contents to render its body excerpt.
 *
 * The response is `Cache-Control: public, s-maxage=3600` so a second visitor
 * gets the source from the CDN edge without paying GitHub for the bytes.
 */
export async function POST(req: Request) {
  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  if (!body.owner || !body.repo || !Array.isArray(body.paths)) {
    return NextResponse.json(
      { error: "Missing owner/repo/paths" },
      { status: 400 },
    );
  }
  const ref = body.ref || "HEAD";
  const headerToken = req.headers.get("x-github-token") ?? undefined;
  const auth = headerToken || process.env.GITHUB_TOKEN || null;

  const unique = Array.from(new Set(body.paths)).slice(0, 200);
  const contents: Record<string, string> = {};

  let i = 0;
  await Promise.all(
    Array.from({ length: PAR }, async () => {
      while (i < unique.length) {
        const path = unique[i++];
        try {
          const src = await fetchRawFile(
            body.owner,
            body.repo,
            ref,
            path,
            auth,
          );
          if (src != null) contents[path] = src;
        } catch {
          /* skip — leave entry absent */
        }
      }
    }),
  );

  return NextResponse.json(
    { contents },
    {
      headers: {
        "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400",
      },
    },
  );
}
