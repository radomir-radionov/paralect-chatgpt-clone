import "server-only";

import { headers } from "next/headers";

export async function getForwardedRequestHeaders() {
  const h = await headers();
  const cookie = h.get("cookie");

  if (!cookie) return undefined;

  return { cookie } satisfies HeadersInit;
}

