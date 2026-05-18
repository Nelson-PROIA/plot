import { NextResponse } from "next/server";

export const runtime = "nodejs";

const GITHUB_BASE = "https://api.github.com";

type Ctx = { params: Promise<{ path: string[] }> };

async function forward(req: Request, ctx: Ctx, method: string) {
  const { path } = await ctx.params;
  const url = new URL(req.url);
  const upstream = `${GITHUB_BASE}/${path.join("/")}${url.search}`;

  const headers: Record<string, string> = {
    Accept: req.headers.get("accept") ?? "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": "plot-app",
  };

  // Server-side token first; client may still pass its own via Authorization.
  const incomingAuth = req.headers.get("authorization");
  if (incomingAuth) {
    headers.Authorization = incomingAuth;
  } else if (process.env.GITHUB_TOKEN) {
    headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  }

  const contentType = req.headers.get("content-type");
  if (contentType) headers["Content-Type"] = contentType;

  let body: BodyInit | undefined;
  if (method !== "GET" && method !== "HEAD") {
    body = await req.arrayBuffer();
    if (body && (body as ArrayBuffer).byteLength === 0) body = undefined;
  }

  let res: Response;
  try {
    res = await fetch(upstream, { method, headers, body });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 502 },
    );
  }

  const passHeaders = new Headers();
  const ct = res.headers.get("content-type");
  if (ct) passHeaders.set("content-type", ct);
  const link = res.headers.get("link");
  if (link) passHeaders.set("link", link);

  return new Response(res.body, { status: res.status, headers: passHeaders });
}

export async function GET(req: Request, ctx: Ctx) {
  return forward(req, ctx, "GET");
}
export async function POST(req: Request, ctx: Ctx) {
  return forward(req, ctx, "POST");
}
export async function PUT(req: Request, ctx: Ctx) {
  return forward(req, ctx, "PUT");
}
export async function PATCH(req: Request, ctx: Ctx) {
  return forward(req, ctx, "PATCH");
}
export async function DELETE(req: Request, ctx: Ctx) {
  return forward(req, ctx, "DELETE");
}
export async function HEAD(req: Request, ctx: Ctx) {
  return forward(req, ctx, "HEAD");
}
