import { z } from "zod";

const server = z.object({
  DATABASE_URL: z.string().min(1),
  SUPABASE_URL: z.string().url(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  SUPABASE_ANON_KEY: z.string().min(1),
  ANON_SESSION_SECRET: z.string().min(32),
  OPENAI_API_KEY: z.string().optional(),
  GOOGLE_GENERATIVE_AI_API_KEY: z.string().optional(),
  /** OpenAI-compatible API base URL (e.g. Groq, Together, local vLLM). */
  OPENAI_COMPATIBLE_BASE_URL: z.string().url().optional(),
  OPENAI_COMPATIBLE_API_KEY: z.string().optional(),
  /** Used when `modelId` has no prefix and only compat keys are configured. */
  OPENAI_COMPATIBLE_DEFAULT_MODEL: z.string().min(1).optional(),
});

const client = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  NEXT_PUBLIC_APP_URL: z.string().url().optional(),
});

export type ServerEnv = z.infer<typeof server>;
/** Bundled env for Supabase Realtime only (`NEXT_PUBLIC_*` anon key). */
export type RealtimeClientEnv = z.infer<typeof client>;

export function getServerEnv(): ServerEnv {
  // Direct read so Turbopack inlines NEXT_PUBLIC_* (same as getRealtimeClientEnv; not
  // reliable only inside object literals with spread process.env).
  const nextPublicSupabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serverEnvInput = {
    ...process.env,
    /** Prefer explicit `SUPABASE_URL`; otherwise same project URL as the client (`NEXT_PUBLIC_*`). */
    SUPABASE_URL: process.env.SUPABASE_URL ?? nextPublicSupabaseUrl,
  };
  const parsed = server.safeParse(serverEnvInput);
  if (!parsed.success) {
    throw new Error(`Invalid server environment: ${parsed.error.message}`);
  }
  return parsed.data;
}

export function requireLlmKeys(): void {
  const {
    OPENAI_API_KEY,
    GOOGLE_GENERATIVE_AI_API_KEY,
    OPENAI_COMPATIBLE_BASE_URL,
    OPENAI_COMPATIBLE_API_KEY,
  } = getServerEnv();
  const hasCompat =
    Boolean(OPENAI_COMPATIBLE_BASE_URL?.trim()) &&
    Boolean(OPENAI_COMPATIBLE_API_KEY);
  if (!OPENAI_API_KEY && !GOOGLE_GENERATIVE_AI_API_KEY && !hasCompat) {
    throw new Error(
      "Set at least one of OPENAI_API_KEY, GOOGLE_GENERATIVE_AI_API_KEY, or both OPENAI_COMPATIBLE_BASE_URL and OPENAI_COMPATIBLE_API_KEY",
    );
  }
}

/** Only for [`src/lib/supabase/realtime.ts`](src/lib/supabase/realtime.ts) — Realtime subscribe. */
export function getRealtimeClientEnv(): RealtimeClientEnv {
  // Direct assignments so Next/Turbopack can inline NEXT_PUBLIC_* (not reliable
  // from `process.env` passed wholesale or nested only in object literals).
  const nextPublicSupabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const nextPublicSupabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const nextPublicAppUrl = process.env.NEXT_PUBLIC_APP_URL;
  const parsed = client.safeParse({
    NEXT_PUBLIC_SUPABASE_URL: nextPublicSupabaseUrl,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: nextPublicSupabaseAnonKey,
    NEXT_PUBLIC_APP_URL: nextPublicAppUrl,
  });
  if (!parsed.success) {
    throw new Error(`Invalid client environment: ${parsed.error.message}`);
  }
  return parsed.data;
}
