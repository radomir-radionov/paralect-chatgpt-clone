/**
 * Lists public tables (for confirming migrations against Supabase).
 * Usage: node scripts/verify-db-tables.mjs
 */
import { parse } from "dotenv";
import { existsSync, readFileSync } from "fs";
import postgres from "postgres";
import { resolve } from "path";

function mergeEnv(relativePath, override) {
  const full = resolve(process.cwd(), relativePath);
  if (!existsSync(full)) return;
  const parsed = parse(readFileSync(full, "utf8"));
  for (const [key, value] of Object.entries(parsed)) {
    if (override || process.env[key] === undefined) process.env[key] = value;
  }
}
mergeEnv(".env", false);
mergeEnv(".env.local", true);

const raw = process.env.DATABASE_URL;
if (!raw) {
  console.error("DATABASE_URL is not set in .env or .env.local");
  process.exit(1);
}

const url =
  raw.includes("supabase.co") && !/[?&]sslmode=/.test(raw)
    ? raw.includes("?")
      ? `${raw}&sslmode=require`
      : `${raw}?sslmode=require`
    : raw;

const sql = postgres(url, { max: 1 });
try {
  const rows = await sql`
    SELECT tablename
    FROM pg_tables
    WHERE schemaname = 'public'
    ORDER BY tablename
  `;
  const names = rows.map((r) => r.tablename);
  if (names.length === 0) {
    console.log("No tables in public schema yet. Run: npm run db:migrate");
    process.exit(1);
  }
  console.log("Tables in public:", names.join(", "));
  process.exit(0);
} catch (e) {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
} finally {
  await sql.end({ timeout: 5 });
}
