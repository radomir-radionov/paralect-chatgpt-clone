import { desc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { withAnonSessionCookie } from "@/server/anon/cookie-response";
import {
  getOrCreateAnonymousSession,
} from "@/server/anon/quota";
import { extractTextFromBuffer } from "@/server/documents/extract";
import {
  GUEST_ANON_MAX_DOCS,
  GUEST_ANON_MAX_TOTAL_TEXT_CHARS,
} from "@/server/documents/guest-limits";
import { getDb } from "@/server/db";
import { anonymousDocuments } from "@/server/db/schema";
import { getClientIp, rateLimitOrThrow } from "@/server/rate-limit";

const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;

const GUEST_DOC_POST_WINDOW_MS = 60_000;
const GUEST_DOC_POST_MAX = 30;

export async function GET(request: Request) {
  try {
    const cookieHeader = request.headers.get("cookie");
    const session = await getOrCreateAnonymousSession(cookieHeader);
    const db = getDb();
    const rows = await db.query.anonymousDocuments.findMany({
      where: eq(anonymousDocuments.sessionId, session.sessionId),
      orderBy: [desc(anonymousDocuments.createdAt)],
      limit: 50,
    });
    const res = NextResponse.json({ documents: rows });
    return withAnonSessionCookie(res, session.token);
  } catch (e) {
    return handleError(e);
  }
}

export async function POST(request: Request) {
  try {
    rateLimitOrThrow(
      `guest-doc-post:${getClientIp(request)}`,
      GUEST_DOC_POST_MAX,
      GUEST_DOC_POST_WINDOW_MS,
    );
    const cookieHeader = request.headers.get("cookie");
    const session = await getOrCreateAnonymousSession(cookieHeader);
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Missing file" }, { status: 400 });
    }
    const buf = Buffer.from(await file.arrayBuffer());
    if (buf.length > MAX_UPLOAD_BYTES) {
      return NextResponse.json(
        { error: "File too large (max 5 MB)" },
        { status: 413 },
      );
    }
    const textContent = await extractTextFromBuffer(
      file.name,
      file.type || "application/octet-stream",
      buf,
    );
    const db = getDb();
    const existing = await db.query.anonymousDocuments.findMany({
      where: eq(anonymousDocuments.sessionId, session.sessionId),
    });
    if (existing.length >= GUEST_ANON_MAX_DOCS) {
      return NextResponse.json(
        {
          error: `Document limit reached (${GUEST_ANON_MAX_DOCS} per session). Remove one or sign in.`,
        },
        { status: 400 },
      );
    }
    const usedChars = existing.reduce(
      (sum, d) => sum + d.textContent.length,
      0,
    );
    if (usedChars + textContent.length > GUEST_ANON_MAX_TOTAL_TEXT_CHARS) {
      return NextResponse.json(
        {
          error: "Total document text would exceed the guest storage limit.",
        },
        { status: 400 },
      );
    }
    const [row] = await db
      .insert(anonymousDocuments)
      .values({
        sessionId: session.sessionId,
        filename: file.name,
        mimeType: file.type || "application/octet-stream",
        textContent,
      })
      .returning();
    if (!row) {
      return NextResponse.json({ error: "Failed to save" }, { status: 500 });
    }
    const res = NextResponse.json({ document: row }, { status: 201 });
    return withAnonSessionCookie(res, session.token);
  } catch (e) {
    return handleError(e);
  }
}

function handleError(e: unknown) {
  if (e instanceof z.ZodError) {
    return NextResponse.json({ error: e.flatten() }, { status: 400 });
  }
  if (
    e instanceof Error &&
    "status" in e &&
    typeof (e as { status?: number }).status === "number"
  ) {
    return NextResponse.json(
      { error: e.message },
      { status: (e as { status: number }).status },
    );
  }
  if (e instanceof Error) {
    return NextResponse.json({ error: e.message }, { status: 400 });
  }
  console.error(e);
  return NextResponse.json({ error: "Internal error" }, { status: 500 });
}
