import { cookies } from "next/headers";

import {
  GUEST_QUOTA_COOKIE_NAME,
  readGuestQuotaCookie,
} from "@domains/chat/lib/guestQuota";
import { getGuestQuotaSecret } from "@domains/chat/lib/guestQuotaServer";
import { jsonError, jsonOk } from "@shared/lib/http/nextJson";

export const runtime = "nodejs";

export async function GET() {
  let quotaSecret: string;
  try {
    quotaSecret = getGuestQuotaSecret();
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Guest quota is not configured";
    return jsonError(message, 500);
  }

  const cookieStore = await cookies();
  const quota = await readGuestQuotaCookie(
    cookieStore.get(GUEST_QUOTA_COOKIE_NAME)?.value,
    quotaSecret,
  );

  return jsonOk({
    remaining: quota.remaining,
    usedQuestions: quota.usedQuestions,
  });
}
