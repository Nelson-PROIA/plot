import OpenAI from "openai";
import { NextResponse } from "next/server";

const MODEL = process.env.OPENAI_MODEL ?? "gpt-4o-mini";

export const runtime = "nodejs";

type EnrichRequest = {
  title: string;
  body: string;
  files: Array<{ filename: string; additions: number; deletions: number; patch?: string }>;
};

const SECTION_PROMPTS: Record<string, string> = {
  intent: `Return STRICT JSON with exactly these keys:
{
  "summary": "2-4 plain-English sentences (50-90 words total) that a reviewer can read in 10 seconds and know WHY this PR exists, WHAT it changes at a high level, and any deadline or risk the body mentions. No markdown, no bullets, no headers. Do not just restate the title or echo a sibling-PR reference — extract the actual intent from the body.",
  "kind": "feature" | "fix" | "refactor",
  "surface": "frontend" | "backend" | "fullstack",
  "scope": "S" | "M" | "L"
}
Do not include any other keys.`,
  risks: `Return STRICT JSON: { "risks": [...] } where each risk has:
{
  "rule": "short noun phrase (≤8 words)",
  "rationale": "one sentence explaining the risk concretely",
  "severity": "high" | "medium" | "low",
  "file": "single best file path or empty",
  "line": 0
}
Up to 4 risks. Only include risks substantiated by the PR body or diff.
Severity = "high" for race conditions, data loss, breaking API change, missing transactions, security issues.
Severity = "medium" for missing tests, validation, rate-limiting, error handling.
Severity = "low" for nits / TODOs.`,
  alternatives: `Return STRICT JSON: { "alternatives": { ... } }.
Schema:
{
  "alternatives": {
    "question": "the design question this PR answers, short imperative phrasing",
    "chosenIndex": 0,
    "options": [
      {
        "name": "Three words max",
        "summary": "1-2 sentence summary",
        "pros": ["short bullet", "short bullet"],
        "cons": ["short bullet", "short bullet"],
        "code": "6-10 lines of plausible illustrative code, no comments",
        "whenToUse": "one sentence"
      }
    ]
  }
}
Include 2-3 design options the team realistically considered. chosenIndex points to the chosen one.`,
  changes: `Return STRICT JSON: { "changes": [...] }.
Each change:
{
  "symbol": "function or class name as written",
  "file": "exact file path from the diff",
  "beforeSteps": 3,
  "afterSteps": 5,
  "beforeMermaid": "flowchart TD\\n  A[step] --> B[step]\\n  B --> C[step]",
  "afterMermaid": "flowchart TD\\n  A[step] --> B[step] --> C[step]"
}
Up to 3 of the most impactful symbol-level changes from the diff.
Mermaid must be valid 'flowchart TD' with 3-7 nodes per diagram.
Use rectangular [text] for steps, diamonds {text?} for decisions.`,
};

const SECTION_KEYS = ["intent", "risks", "alternatives", "changes"] as const;

export async function POST(req: Request) {
  let body: EnrichRequest;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const headerKey = req.headers.get("x-openai-key") ?? undefined;
  const apiKey = headerKey || process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "OpenAI key missing" },
      { status: 401 },
    );
  }

  const slim = body.files
    .slice(0, 8)
    .map((f) => ({
      filename: f.filename,
      additions: f.additions,
      deletions: f.deletions,
      patch: f.patch ? f.patch.slice(0, 2400) : undefined,
    }));
  const user = JSON.stringify(
    { title: body.title, body: body.body ?? "", files: slim },
    null,
    0,
  );

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const emit = (section: string, value: unknown) => {
        controller.enqueue(
          encoder.encode(
            `data: ${JSON.stringify({ section, value })}\n\n`,
          ),
        );
      };
      const emitError = (section: string, error: string) => {
        controller.enqueue(
          encoder.encode(
            `data: ${JSON.stringify({ section, error })}\n\n`,
          ),
        );
      };

      const client = new OpenAI({ apiKey });

      await Promise.all(
        SECTION_KEYS.map(async (key) => {
          try {
            const completion = await client.chat.completions.create({
              model: MODEL,
              max_tokens: key === "changes" ? 1100 : 700,
              response_format: { type: "json_object" },
              messages: [
                {
                  role: "system",
                  content: `You are a senior code reviewer. Reply with raw JSON only — no markdown fences.\n\n${SECTION_PROMPTS[key]}`,
                },
                { role: "user", content: user },
              ],
            });
            const raw = completion.choices[0]?.message?.content ?? "{}";
            try {
              const parsed = JSON.parse(raw);
              emit(key, parsed);
            } catch {
              emitError(key, "invalid JSON returned by model");
            }
          } catch (e) {
            emitError(key, e instanceof Error ? e.message : String(e));
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
