import { GUEST_FREE_QUESTION_LIMIT } from "@domains/chat/guest/lib/guestQuotaConstants";

export type GuestQuotaResponse =
  | {
      error: false;
      remaining: number;
      usedQuestions: number;
    }
  | {
      error: true;
      message: string;
    };

export function clampGuestRemainingQuestions(value: number) {
  if (!Number.isFinite(value)) return GUEST_FREE_QUESTION_LIMIT;
  return Math.max(0, Math.min(GUEST_FREE_QUESTION_LIMIT, Math.trunc(value)));
}

export function parseGuestQuotaRemainingHeader(value: string | null) {
  if (value == null) return null;

  const parsed = Number(value);
  if (!Number.isInteger(parsed)) return null;

  return Math.max(0, Math.min(GUEST_FREE_QUESTION_LIMIT, parsed));
}
