import type { User } from "@supabase/supabase-js";
import { queryOptions, useQuery } from "@tanstack/react-query";

import type { UserProfile } from "./profile-fetcher";
import { authKeys } from "./keys";

export async function clientGetMe(): Promise<User | null> {
  const res = await fetch("/api/auth/me", { method: "GET", cache: "no-store" });
  if (res.status === 401) return null;
  if (!res.ok) {
    let message = `Request failed (${res.status})`;
    try {
      const json = (await res.json()) as { message?: string };
      if (typeof json.message === "string") message = json.message;
    } catch {
      // ignore
    }
    throw new Error(message);
  }
  const json = (await res.json()) as { user?: User; error?: boolean };
  if (json.error !== false || json.user == null) {
    throw new Error("Invalid /api/auth/me response");
  }
  return json.user;
}

export async function clientGetProfile(): Promise<UserProfile | null> {
  const res = await fetch("/api/profile/me", { method: "GET", cache: "no-store" });
  if (res.status === 401 || res.status === 404) return null;
  if (!res.ok) return null;
  let json: unknown;
  try {
    json = await res.json();
  } catch {
    return null;
  }
  const data = json as { error?: boolean; profile?: UserProfile };
  if (data.error !== false || data.profile == null) return null;
  return data.profile;
}

export const meQueryOptions = () =>
  queryOptions({
    queryKey: authKeys.currentUser,
    queryFn: async (): Promise<User | null> => clientGetMe(),
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: true,
  });

export function useMe() {
  return useQuery(meQueryOptions());
}

export const myProfileQueryOptions = () =>
  queryOptions({
    queryKey: authKeys.myProfile,
    queryFn: async (): Promise<UserProfile | null> => clientGetProfile(),
  });

export function useMyProfile() {
  return useQuery(myProfileQueryOptions());
}
