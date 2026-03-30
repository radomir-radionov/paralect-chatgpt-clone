import { eq } from "drizzle-orm";
import { SignJWT, jwtVerify } from "jose";
import { getServerEnv } from "@/lib/env";
import { getDb } from "@/server/db";
import { anonymousQuota } from "@/server/db/schema";

const COOKIE = "anon_session";
const MAX_FREE = 3;

function getSecret() {
  const { ANON_SESSION_SECRET } = getServerEnv();
  return new TextEncoder().encode(ANON_SESSION_SECRET);
}

export async function signSessionId(sessionId: string): Promise<string> {
  return new SignJWT({ sid: sessionId })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("400d")
    .sign(getSecret());
}

export async function readSessionFromCookie(
  cookieHeader: string | null,
): Promise<string | null> {
  const raw = parseCookies(cookieHeader)[COOKIE];
  if (!raw) return null;
  try {
    const { payload } = await jwtVerify(raw, getSecret());
    const sid = payload.sid;
    return typeof sid === "string" ? sid : null;
  } catch {
    return null;
  }
}

function parseCookies(header: string | null): Record<string, string> {
  const out: Record<string, string> = {};
  if (!header) return out;
  for (const part of header.split(";")) {
    const [k, ...rest] = part.trim().split("=");
    if (!k) continue;
    out[k] = decodeURIComponent(rest.join("="));
  }
  return out;
}

export async function getOrCreateAnonymousSession(
  cookieHeader: string | null,
): Promise<{ sessionId: string; token: string; count: number }> {
  const db = getDb();
  let sessionId = await readSessionFromCookie(cookieHeader);
  if (!sessionId) {
    sessionId = crypto.randomUUID();
    const token = await signSessionId(sessionId);
    await db.insert(anonymousQuota).values({ sessionId, count: 0 }).onConflictDoNothing();
    const row = await db.query.anonymousQuota.findFirst({
      where: eq(anonymousQuota.sessionId, sessionId),
    });
    return {
      sessionId,
      token,
      count: row?.count ?? 0,
    };
  }
  let row = await db.query.anonymousQuota.findFirst({
    where: eq(anonymousQuota.sessionId, sessionId),
  });
  if (!row) {
    await db
      .insert(anonymousQuota)
      .values({ sessionId, count: 0 })
      .onConflictDoNothing();
    row = await db.query.anonymousQuota.findFirst({
      where: eq(anonymousQuota.sessionId, sessionId),
    });
  }
  const token = await signSessionId(sessionId);
  return {
    sessionId,
    token,
    count: row?.count ?? 0,
  };
}

export async function incrementAnonymousUsage(sessionId: string): Promise<number> {
  const db = getDb();
  let row = await db.query.anonymousQuota.findFirst({
    where: eq(anonymousQuota.sessionId, sessionId),
  });
  if (!row) {
    await db.insert(anonymousQuota).values({ sessionId, count: 0 });
    row = await db.query.anonymousQuota.findFirst({
      where: eq(anonymousQuota.sessionId, sessionId),
    });
  }
  const next = (row?.count ?? 0) + 1;
  await db
    .update(anonymousQuota)
    .set({ count: next, updatedAt: new Date() })
    .where(eq(anonymousQuota.sessionId, sessionId));
  return next;
}

export function assertAnonymousQuota(countBefore: number): void {
  if (countBefore >= MAX_FREE) {
    const err = new Error("Anonymous quota exceeded") as Error & {
      status: number;
      code: string;
    };
    err.status = 429;
    err.code = "ANON_QUOTA";
    throw err;
  }
}

export { COOKIE as ANON_COOKIE_NAME, MAX_FREE as ANON_MAX_FREE };
