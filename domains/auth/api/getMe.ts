import type { User } from "@supabase/supabase-js";
import { cookies } from "next/headers";

import { apiUrl } from "@shared/lib/http/apiUrl";
import { getRequestOrigin } from "@shared/lib/http/getRequestOrigin";
import type { ApiError } from "@shared/lib/http/fetchApiOk";

async function getRequestCookieHeader() {
  const cookieStore = await cookies();
  return cookieStore
    .getAll()
    .map((cookie) => `${cookie.name}=${cookie.value}`)
    .join("; ");
}

export async function getMe(options?: { readonly origin?: string }) {
  const origin = options?.origin ?? (await getRequestOrigin());
  const cookie = await getRequestCookieHeader();

  const res = await fetch(apiUrl("/api/auth/me", origin), {
    method: "GET",
    cache: "no-store",
    headers: cookie ? { cookie } : undefined,
  });

  if (res.status === 401) return null;
  if (!res.ok) {
    let json: unknown = null;
    try {
      json = await res.json();
    } catch {
      // ignore
    }
    const message =
      typeof (json as ApiError | null)?.message === "string"
        ? (json as ApiError).message
        : `Request failed (${res.status})`;
    throw new Error(message);
  }

  const json = (await res.json()) as unknown;
  const user = (json as { user?: User }).user;
  if (user == null) throw new Error("Invalid /api/auth/me response");
  return user;
}

