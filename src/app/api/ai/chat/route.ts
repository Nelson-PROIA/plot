import OpenAI from "openai";
import { NextResponse } from "next/server";

type ChatMessage = { role: "user" | "assistant" | "system"; content: string };

const MODEL = process.env.OPENAI_MODEL ?? "gpt-4o-mini";

export const runtime = "nodejs";

export async function POST(req: Request) {
  let body: { messages?: ChatMessage[]; system?: string; max_tokens?: number };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const messages = body.messages ?? [];
  const system = body.system?.trim();
  const max_tokens = body.max_tokens ?? 700;

  const headerKey = req.headers.get("x-openai-key") ?? undefined;
  const apiKey = headerKey || process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      {
        error:
          "OpenAI API key missing. Set OPENAI_API_KEY in the server environment.",
      },
      { status: 401 },
    );
  }

  try {
    const client = new OpenAI({ apiKey });
    const stream = await client.chat.completions.create({
      model: MODEL,
      max_tokens,
      stream: true,
      messages: [
        ...(system ? [{ role: "system" as const, content: system }] : []),
        ...messages.map((m) => ({
          role: m.role as "user" | "assistant" | "system",
          content: m.content,
        })),
      ],
    });

    const encoder = new TextEncoder();
    const readable = new ReadableStream({
      async start(controller) {
        try {
          for await (const part of stream) {
            const delta = part.choices[0]?.delta?.content;
            if (delta) {
              controller.enqueue(
                encoder.encode(`data: ${JSON.stringify({ delta })}\n\n`),
              );
            }
          }
          controller.enqueue(encoder.encode(`data: [DONE]\n\n`));
          controller.close();
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ error: msg })}\n\n`),
          );
          controller.close();
        }
      },
    });

    return new Response(readable, {
      headers: {
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
      },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
