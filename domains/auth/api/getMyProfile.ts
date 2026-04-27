import "server-only";

import type { UserProfile } from "@domains/auth/queries/profile-fetcher";
import { apiUrl } from "@shared/lib/http/apiUrl";
import { fetchApiOk } from "@shared/lib/http/fetchApiOk";
import { getForwardedRequestHeaders } from "@shared/lib/http/getForwardedRequestHeaders";
import { getRequestOrigin } from "@shared/lib/http/getRequestOrigin";

export async function getMyProfile(options?: { readonly origin?: string }) {
  const origin = options?.origin ?? (await getRequestOrigin());
  const headers = await getForwardedRequestHeaders();

  const data = await fetchApiOk<{ profile: UserProfile }>(
    apiUrl("/api/profile/me", origin),
    { method: "GET", cache: "no-store", headers },
  );
  return data.profile;
}

