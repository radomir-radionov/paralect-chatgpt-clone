import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import {
  GUEST_QUOTA_COOKIE_NAME,
  readGuestQuotaCookie,
} from "@domains/chat/lib/guestQuota";
import { getGuestQuotaSecret } from "@domains/chat/lib/guestQuotaServer";

export const runtime = "nodejs";

export async function GET() {
  let quotaSecret: string;
  try {
    quotaSecret = getGuestQuotaSecret();
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Guest quota is not configured";
    return NextResponse.json({ error: true, message }, { status: 500 });
  }

  const cookieStore = await cookies();
  const quota = await readGuestQuotaCookie(
    cookieStore.get(GUEST_QUOTA_COOKIE_NAME)?.value,
    quotaSecret,
  );

  return NextResponse.json({
    error: false,
    remaining: quota.remaining,
    usedQuestions: quota.usedQuestions,
  });
}
