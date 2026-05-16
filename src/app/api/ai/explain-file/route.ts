import OpenAI from "openai";
import { NextResponse } from "next/server";

const MODEL = process.env.OPENAI_MODEL ?? "gpt-4o-mini";

export const runtime = "nodejs";

type ExplainRequest = {
  path: string;
  group?: string;
  /** Imports parsed from the repo graph, e.g. ["api/src/db.ts"]. */
  imports?: string[];
  /** Other files that import this one. */
  importedBy?: string[];
  /** Optional first N lines of file content. */
  preview?: string;
};

export async function POST(req: Request) {
  let body: ExplainRequest;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  if (!body.path) {
    return NextResponse.json({ error: "Missing path" }, { status: 400 });
  }

  const headerKey = req.headers.get("x-openai-key") ?? undefined;
  const apiKey = headerKey || process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "OpenAI API key missing" },
      { status: 401 },
    );
  }

  const userPayload = {
    path: body.path,
    group: body.group ?? "",
    imports: (body.imports ?? []).slice(0, 12),
    importedBy: (body.importedBy ?? []).slice(0, 12),
    preview: body.preview ? body.preview.slice(0, 1800) : undefined,
  };

  try {
    const client = new OpenAI({ apiKey });
    const completion = await client.chat.completions.create({
      model: MODEL,
      max_tokens: 240,
      messages: [
        {
          role: "system",
          content:
            "You explain individual source files in 2 short sentences (≤ 50 words). " +
            "Sentence 1: what this file is responsible for. " +
            "Sentence 2: how it fits in (who calls it, what it depends on). " +
            "Wrap symbol names, function names, and file paths in single backticks. " +
            "No bullets, no headers, no fenced code blocks — only inline `code`.",
        },
        { role: "user", content: JSON.stringify(userPayload) },
      ],
    });
    const text =
      completion.choices[0]?.message?.content?.trim() ??
      "Couldn't generate an explanation for this file.";
    return NextResponse.json({ text });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
