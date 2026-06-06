import { defineConfig } from "drizzle-kit";

// drizzle-kit runs locally; Next.js loads .env.local itself.
try {
  process.loadEnvFile(".env.local");
} catch {
  // fine — env may already be set (CI)
}

const url =
  process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL ?? "";
if (!url) throw new Error("DATABASE_URL(_UNPOOLED) is not set");

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/lib/db/schema.ts",
  out: "./drizzle",
  dbCredentials: { url },
});
