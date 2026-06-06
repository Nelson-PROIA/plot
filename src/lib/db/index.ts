import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "./schema";

// Neon HTTP driver: one stateless fetch per query, ideal on Fluid compute.
// Switch to the websocket Pool driver if/when we need transactions.
//
// Lazy on purpose: neon() throws synchronously on a missing connection
// string, and Next.js evaluates route modules during `next build` — an eager
// module-level neon() would fail any build without DATABASE_URL set.
function create() {
  return drizzle({ client: neon(process.env.DATABASE_URL!), schema });
}

export type Db = ReturnType<typeof create>;

let _db: Db | null = null;

export function getDb(): Db {
  return (_db ??= create());
}
