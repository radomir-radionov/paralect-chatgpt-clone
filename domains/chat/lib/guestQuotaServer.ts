import type { NextResponse } from "next/server";

import {
  GUEST_QUOTA_COOKIE_NAME,
  GUEST_QUOTA_MAX_AGE_SECONDS,
  type ConsumeGuestQuestionResult,
} from "./guestQuota";

export function getGuestQuotaSecret() {
  const secret =
    process.env.GUEST_CHAT_QUOTA_SECRET ?? process.env.SUPABASE_SECRET_KEY;

  if (!secret) {
    throw new Error("Missing GUEST_CHAT_QUOTA_SECRET or SUPABASE_SECRET_KEY");
  }

  return secret;
}

export function setGuestQuotaCookie(
  response: NextResponse,
  quota: Pick<ConsumeGuestQuestionResult, "cookieValue" | "expiresAt">,
) {
  response.cookies.set({
    name: GUEST_QUOTA_COOKIE_NAME,
    value: quota.cookieValue,
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: GUEST_QUOTA_MAX_AGE_SECONDS,
    expires: quota.expiresAt,
  });
}

