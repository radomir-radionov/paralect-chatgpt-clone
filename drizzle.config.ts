import { parse } from "dotenv";
import { defineConfig } from "drizzle-kit";
import { existsSync, readFileSync } from "fs";
import { resolve } from "path";

function mergeEnvFile(relativePath: string, override: boolean) {
  const full = resolve(process.cwd(), relativePath);
  if (!existsSync(full)) return;
  const parsed = parse(readFileSync(full, "utf8"));
  for (const [key, value] of Object.entries(parsed)) {
    if (override || process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}

mergeEnvFile(".env", false);
mergeEnvFile(".env.local", true);

function databaseUrl(): string {
  const raw = process.env.DATABASE_URL;
  if (!raw) {
    throw new Error(
      "DATABASE_URL is not set. Add it to .env or .env.local (see .env.example).",
    );
  }
  if (raw.includes("supabase.co") && !/[?&]sslmode=/.test(raw)) {
    return raw.includes("?") ? `${raw}&sslmode=require` : `${raw}?sslmode=require`;
  }
  return raw;
}

export default defineConfig({
  schema: "./src/server/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: databaseUrl(),
  },
});
