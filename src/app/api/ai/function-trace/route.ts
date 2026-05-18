import OpenAI from "openai";
import { NextResponse } from "next/server";
import { fetchRawFile } from "@/lib/github-raw";

export const runtime = "nodejs";

const MODEL = process.env.OPENAI_MODEL ?? "gpt-4o-mini";

export type TracedCall = {
  /** Caller or callee function name. */
  name: string;
  /** Best-effort file path; empty if unknown. */
  file: string;
  /** What calling this accomplishes, ≤ 8 words. */
  purpose: string;
  /** Realistic example payload going in (caller→fn) or out (fn→callee). */
  example: string;
  /** Optional language for the example (typescript/json). */
  lang?: "typescript" | "json";
};

export type FunctionTrace = {
  function: { name: string; params?: string; file: string };
  description: string;
  callers: TracedCall[];
  callees: TracedCall[];
};

type Request = {
  owner: string;
  repo: string;
  ref?: string;
  path: string;
  signature: { kind: string; name: string; params?: string };
};

const SYSTEM = `You analyze a single exported function and explain its data flow.
Return STRICT JSON only, no markdown fences, with this exact shape:
{
  "description": "one-sentence description of what this function does (≤ 22 words)",
  "callers": [
    {
      "name": "callerFn",
      "file": "best guess of file path where the caller lives, or empty string",
      "purpose": "≤ 8 words: why the caller invokes this",
      "example": "a tiny realistic input as JSON or TS literal, ≤ 100 chars, single line",
      "lang": "json" | "typescript"
    }
  ],
  "callees": [
    {
      "name": "calleeFn",
      "file": "best guess of file path where the callee is defined, or empty string",
      "purpose": "≤ 8 words: why this function calls it",
      "example": "tiny realistic input/output payload as JSON or TS literal, ≤ 100 chars, single line",
      "lang": "json" | "typescript"
    }
  ]
}
Up to 3 callers and up to 5 callees. Order by likely frequency.
Infer callers from usage patterns (route handlers, page components, tests, parent components).
Examples should be realistic to the domain implied by the file (banking/users/etc).
Examples must fit on one line — no newlines, no backticks.`;

export async function POST(req: globalThis.Request) {
  let body: Request;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  if (!body.owner || !body.repo || !body.path || !body.signature?.name) {
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  }

  const ghToken = req.headers.get("x-github-token") || process.env.GITHUB_TOKEN;
  const openaiKey =
    req.headers.get("x-openai-key") || process.env.OPENAI_API_KEY;
  if (!openaiKey) {
    return NextResponse.json(
      { error: "OpenAI API key missing" },
      { status: 401 },
    );
  }

  let source = "";
  try {
    const fetched = await fetchRawFile(
      body.owner,
      body.repo,
      body.ref ?? "HEAD",
      body.path,
      ghToken,
    );
    source = fetched ?? "";
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to fetch file" },
      { status: 500 },
    );
  }

  const userPayload = {
    file: body.path,
    target: body.signature,
    // Cap to avoid blowing tokens on huge files.
    source: source.slice(0, 9000),
  };

  try {
    const client = new OpenAI({ apiKey: openaiKey });
    const completion = await client.chat.completions.create({
      model: MODEL,
      max_tokens: 1100,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: SYSTEM },
        { role: "user", content: JSON.stringify(userPayload) },
      ],
    });
    const raw = completion.choices[0]?.message?.content ?? "{}";
    let parsed: {
      description?: string;
      callers?: TracedCall[];
      callees?: TracedCall[];
    };
    try {
      parsed = JSON.parse(raw);
    } catch {
      return NextResponse.json(
        { error: "Model returned non-JSON" },
        { status: 502 },
      );
    }

    const clip = (arr: TracedCall[] | undefined, n: number): TracedCall[] =>
      (arr ?? []).slice(0, n).map((c) => ({
        name: (c.name ?? "").slice(0, 60),
        file: (c.file ?? "").slice(0, 120),
        purpose: (c.purpose ?? "").slice(0, 90),
        // Preserve internal whitespace so the bottom panel can pretty-print
        // JSON. Cap at 600 chars (enough for a small object literal).
        example: (c.example ?? "").trim().slice(0, 600),
        lang: c.lang === "typescript" ? "typescript" : "json",
      }));

    const trace: FunctionTrace = {
      function: {
        name: body.signature.name,
        params: body.signature.params,
        file: body.path,
      },
      description: (parsed.description ?? "").slice(0, 220),
      callers: clip(parsed.callers, 3),
      callees: clip(parsed.callees, 5),
    };
    return NextResponse.json(trace);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }
}
