import { createHmac, timingSafeEqual } from "node:crypto";

export const GUEST_FREE_QUESTION_LIMIT = 3;
export const GUEST_QUOTA_COOKIE_NAME = "paralect_guest_quota";
export const GUEST_QUOTA_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;

type GuestQuotaPayload = {
  usedQuestions: number;
  expiresAt: string;
};

export type GuestQuotaState = {
  usedQuestions: number;
  remaining: number;
  expiresAt: Date;
};

export type ConsumeGuestQuestionResult =
  | {
      allowed: true;
      remaining: number;
      usedQuestions: number;
      cookieValue: string;
      expiresAt: Date;
    }
  | {
      allowed: false;
      remaining: 0;
      usedQuestions: number;
      cookieValue: string;
      expiresAt: Date;
    };

function base64UrlEncode(value: string) {
  return Buffer.from(value, "utf8").toString("base64url");
}

function base64UrlDecode(value: string) {
  return Buffer.from(value, "base64url").toString("utf8");
}

function signPayload(encodedPayload: string, secret: string) {
  return createHmac("sha256", secret).update(encodedPayload).digest("base64url");
}

function signaturesMatch(a: string, b: string) {
  const aBuffer = Buffer.from(a);
  const bBuffer = Buffer.from(b);

  return aBuffer.length === bBuffer.length && timingSafeEqual(aBuffer, bBuffer);
}

function clampUsedQuestions(value: number) {
  if (!Number.isFinite(value)) return GUEST_FREE_QUESTION_LIMIT;
  return Math.max(0, Math.min(GUEST_FREE_QUESTION_LIMIT, Math.trunc(value)));
}

function createExpiresAt(now: Date) {
  return new Date(now.getTime() + GUEST_QUOTA_MAX_AGE_SECONDS * 1000);
}

function createCookieValue(payload: GuestQuotaPayload, secret: string) {
  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  const signature = signPayload(encodedPayload, secret);

  return `${encodedPayload}.${signature}`;
}

function exhaustedQuota(now: Date): GuestQuotaState {
  return {
    usedQuestions: GUEST_FREE_QUESTION_LIMIT,
    remaining: 0,
    expiresAt: createExpiresAt(now),
  };
}

export async function readGuestQuotaCookie(
  cookieValue: string | null | undefined,
  secret: string,
  now = new Date(),
): Promise<GuestQuotaState> {
  if (!cookieValue) {
    return {
      usedQuestions: 0,
      remaining: GUEST_FREE_QUESTION_LIMIT,
      expiresAt: createExpiresAt(now),
    };
  }

  const [encodedPayload, signature] = cookieValue.split(".");
  if (!encodedPayload || !signature) {
    return exhaustedQuota(now);
  }

  const expectedSignature = signPayload(encodedPayload, secret);
  if (!signaturesMatch(signature, expectedSignature)) {
    return exhaustedQuota(now);
  }

  try {
    const payload = JSON.parse(base64UrlDecode(encodedPayload)) as Partial<GuestQuotaPayload>;
    const expiresAt = typeof payload.expiresAt === "string" ? new Date(payload.expiresAt) : null;

    if (expiresAt == null || Number.isNaN(expiresAt.getTime())) {
      return exhaustedQuota(now);
    }

    if (expiresAt.getTime() <= now.getTime()) {
      return {
        usedQuestions: 0,
        remaining: GUEST_FREE_QUESTION_LIMIT,
        expiresAt: createExpiresAt(now),
      };
    }

    const usedQuestions = clampUsedQuestions(Number(payload.usedQuestions));

    return {
      usedQuestions,
      remaining: GUEST_FREE_QUESTION_LIMIT - usedQuestions,
      expiresAt,
    };
  } catch {
    return exhaustedQuota(now);
  }
}

export async function consumeGuestQuestion({
  cookieValue,
  secret,
  now = new Date(),
}: {
  cookieValue: string | null | undefined;
  secret: string;
  now?: Date;
}): Promise<ConsumeGuestQuestionResult> {
  const quota = await readGuestQuotaCookie(cookieValue, secret, now);

  if (quota.usedQuestions >= GUEST_FREE_QUESTION_LIMIT) {
    const nextCookieValue = createCookieValue(
      {
        usedQuestions: GUEST_FREE_QUESTION_LIMIT,
        expiresAt: quota.expiresAt.toISOString(),
      },
      secret,
    );

    return {
      allowed: false,
      remaining: 0,
      usedQuestions: GUEST_FREE_QUESTION_LIMIT,
      cookieValue: nextCookieValue,
      expiresAt: quota.expiresAt,
    };
  }

  const usedQuestions = quota.usedQuestions + 1;
  const nextCookieValue = createCookieValue(
    {
      usedQuestions,
      expiresAt: quota.expiresAt.toISOString(),
    },
    secret,
  );

  return {
    allowed: true,
    remaining: GUEST_FREE_QUESTION_LIMIT - usedQuestions,
    usedQuestions,
    cookieValue: nextCookieValue,
    expiresAt: quota.expiresAt,
  };
}
