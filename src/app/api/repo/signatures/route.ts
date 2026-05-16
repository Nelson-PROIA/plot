import { Octokit } from "@octokit/rest";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export type Signature = {
  kind:
    | "function"
    | "class"
    | "interface"
    | "type"
    | "enum"
    | "const"
    | "default";
  name: string;
  /** Raw parameter list as it appears in the source (no annotations stripped). */
  params?: string;
};

type Request = {
  owner: string;
  repo: string;
  ref?: string;
  paths: string[];
};

const PARSEABLE_EXT = new Set([
  "ts",
  "tsx",
  "js",
  "jsx",
  "mjs",
  "cjs",
]);

function ext(p: string) {
  return p.split(".").pop()?.toLowerCase() ?? "";
}

function parseSignatures(src: string): Signature[] {
  const sigs: Signature[] = [];
  const seen = new Set<string>();
  const push = (sig: Signature) => {
    const key = `${sig.kind}:${sig.name}`;
    if (seen.has(key)) return;
    seen.add(key);
    sigs.push(sig);
  };

  // export function foo(args)
  for (const m of src.matchAll(
    /^export\s+(?:async\s+)?function\s+(\w+)\s*\(([^)]*)\)/gm,
  )) {
    push({ kind: "function", name: m[1], params: m[2].trim() });
  }
  // export default function [foo](args)
  for (const m of src.matchAll(
    /^export\s+default\s+(?:async\s+)?function\s+(\w+)?\s*\(([^)]*)\)/gm,
  )) {
    push({ kind: "default", name: m[1] ?? "default", params: m[2].trim() });
  }
  // export const foo = (args) =>  /  : (args) =>
  for (const m of src.matchAll(
    /^export\s+(?:const|let|var)\s+(\w+)\s*(?::\s*[^=]+)?\s*=\s*(?:async\s*)?\(([^)]*)\)\s*(?:=>|:)/gm,
  )) {
    push({ kind: "function", name: m[1], params: m[2].trim() });
  }
  // export const foo = something
  for (const m of src.matchAll(
    /^export\s+(?:const|let|var)\s+(\w+)\s*=\s*[^(]/gm,
  )) {
    push({ kind: "const", name: m[1] });
  }
  // export class/interface/type/enum X
  for (const m of src.matchAll(
    /^export\s+(class|interface|type|enum)\s+(\w+)/gm,
  )) {
    push({ kind: m[1] as Signature["kind"], name: m[2] });
  }
  return sigs.slice(0, 18);
}

export async function POST(req: globalThis.Request) {
  let body: Request;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  if (!body.owner || !body.repo || !Array.isArray(body.paths)) {
    return NextResponse.json(
      { error: "Missing owner/repo/paths" },
      { status: 400 },
    );
  }

  const headerToken = req.headers.get("x-github-token") ?? undefined;
  const auth = headerToken || process.env.GITHUB_TOKEN;
  const octokit = new Octokit(auth ? { auth } : {});
  const ref = body.ref || undefined;

  const paths = body.paths.slice(0, 60);

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const emit = (path: string, signatures: Signature[]) => {
        controller.enqueue(
          encoder.encode(
            `data: ${JSON.stringify({ path, signatures })}\n\n`,
          ),
        );
      };

      const concurrency = 6;
      let i = 0;
      await Promise.all(
        Array.from({ length: concurrency }, async () => {
          while (i < paths.length) {
            const path = paths[i++];
            if (!PARSEABLE_EXT.has(ext(path))) {
              emit(path, []);
              continue;
            }
            try {
              const { data } = await octokit.rest.repos.getContent({
                owner: body.owner,
                repo: body.repo,
                path,
                ref,
              });
              if (
                !Array.isArray(data) &&
                "content" in data &&
                data.encoding === "base64"
              ) {
                const src = Buffer.from(data.content, "base64").toString("utf8");
                emit(path, parseSignatures(src));
              } else {
                emit(path, []);
              }
            } catch {
              emit(path, []);
            }
          }
        }),
      );

      controller.enqueue(encoder.encode(`data: [DONE]\n\n`));
      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}

