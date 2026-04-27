import { headers } from "next/headers";

export async function getRequestOrigin() {
  const h = await headers();
  const proto = h.get("x-forwarded-proto") ?? "http";
  const host = h.get("x-forwarded-host") ?? h.get("host");
  if (!host) {
    throw new Error("Missing Host header");
  }
  return `${proto}://${host}`;
}

