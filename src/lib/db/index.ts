import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "./schema";

// Neon HTTP driver: one stateless fetch per query, ideal on Fluid compute.
// Switch to the websocket Pool driver if/when we need transactions.
const sql = neon(process.env.DATABASE_URL!);

export const db = drizzle({ client: sql, schema });
