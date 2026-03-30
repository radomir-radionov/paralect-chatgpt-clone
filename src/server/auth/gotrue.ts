import type { User } from "@supabase/supabase-js";
import { getServerEnv } from "@/lib/env";

type TokenResponse = {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  expires_at?: number;
  token_type: string;
  user: User;
};

function parseGoTrueError(text: string): string {
  try {
    const j = JSON.parse(text) as {
      msg?: string;
      error_description?: string;
      message?: string;
    };
    return j.msg ?? j.error_description ?? j.message ?? text;
  } catch {
    return text;
  }
}

/** Password grant using service role (server-only). */
export async function exchangePasswordForTokens(
  email: string,
  password: string,
): Promise<TokenResponse> {
  const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = getServerEnv();
  const res = await fetch(
    `${SUPABASE_URL}/auth/v1/token?grant_type=password`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: SUPABASE_SERVICE_ROLE_KEY,
        Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      },
      body: JSON.stringify({ email, password }),
    },
  );
  const text = await res.text();
  if (!res.ok) {
    throw new Error(parseGoTrueError(text));
  }
  return JSON.parse(text) as TokenResponse;
}

type SignUpResponse = TokenResponse & {
  identities?: unknown[];
};

/**
 * When email confirmation is enabled, GoTrue returns 200 with no session for a
 * duplicate email and an obfuscated user with `identities: []` (see auth-js
 * signUp docs). New email sign-ups include at least one identity.
 */
export function isDuplicateEmailSignUpResponse(
  user: User | null | undefined,
): boolean {
  if (!user) return false;
  return Array.isArray(user.identities) && user.identities.length === 0;
}

/** Sign up via GoTrue with service role (server-only). */
export async function signUpWithGoTrue(
  email: string,
  password: string,
): Promise<SignUpResponse> {
  const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = getServerEnv();
  const res = await fetch(`${SUPABASE_URL}/auth/v1/signup`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
    },
    body: JSON.stringify({ email, password }),
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(parseGoTrueError(text));
  }
  const parsed = JSON.parse(text) as SignUpResponse & { id?: string };
  const hasSession = Boolean(
    parsed.access_token && parsed.refresh_token && parsed.expires_in,
  );
  // GoTrue often returns the User at the JSON root when there is no session
  // (email confirmation flow). auth-js maps this with `data.user ?? data`.
  if (!parsed.user && !hasSession && typeof parsed.id === "string") {
    return { ...parsed, user: parsed as unknown as User };
  }
  return parsed;
}
