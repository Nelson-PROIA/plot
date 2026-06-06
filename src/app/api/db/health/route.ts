import { NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { db } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// M0 demoable: green build on main with DB connected.
export async function GET() {
  const started = Date.now();
  try {
    const result = await db.execute(sql`
      select table_name
      from information_schema.tables
      where table_schema = 'public'
      order by table_name
    `);
    return NextResponse.json({
      ok: true,
      latencyMs: Date.now() - started,
      tables: result.rows.map((r) => r.table_name),
    });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}
