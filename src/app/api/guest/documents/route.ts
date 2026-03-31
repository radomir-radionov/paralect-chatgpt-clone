import { desc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import {
  getOrCreateAnonymousSession,
  ANON_COOKIE_NAME,
} from "@/server/anon/quota";
import { getDb } from "@/server/db";
import { guestDocuments } from "@/server/db/schema";
import { ingestGuestDocument } from "@/server/rag/ingest";
import {
  isAllowedDocumentMimeType,
  MAX_UPLOAD_BYTES,
} from "@/server/rag/constants";
import { getClientIp, rateLimitOrThrow } from "@/server/rate-limit";
import { randomUUID } from "node:crypto";

const UPLOAD_WINDOW_MS = 60_000;
const UPLOAD_MAX_PER_WINDOW = 20;

export async function GET(request: Request) {
  try {
    const cookieHeader = request.headers.get("cookie");
    const session = await getOrCreateAnonymousSession(cookieHeader);
    const db = getDb();
    const rows = await db.query.guestDocuments.findMany({
      where: eq(guestDocuments.sessionId, session.sessionId),
      orderBy: [desc(guestDocuments.createdAt)],
      limit: 100,
    });
    const headers = new Headers();
    headers.set(
      "Set-Cookie",
      `${ANON_COOKIE_NAME}=${session.token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${60 * 60 * 24 * 400}`,
    );
    return NextResponse.json({ documents: rows }, { headers });
  } catch (e) {
    return handleError(e);
  }
}

export async function POST(request: Request) {
  try {
    rateLimitOrThrow(
      `guest-doc-upload:${getClientIp(request)}`,
      UPLOAD_MAX_PER_WINDOW,
      UPLOAD_WINDOW_MS,
    );
    const cookieHeader = request.headers.get("cookie");
    const session = await getOrCreateAnonymousSession(cookieHeader);

    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Missing file field" }, { status: 400 });
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      return NextResponse.json({ error: "File too large (max 5 MB)" }, { status: 413 });
    }
    const mimeType = file.type || "application/octet-stream";
    if (!isAllowedDocumentMimeType(mimeType)) {
      return NextResponse.json(
        { error: "Unsupported file type" },
        { status: 400 },
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const filename = sanitizeFilename(file.name);
    const documentId = randomUUID();

    const db = getDb();
    await db.insert(guestDocuments).values({
      id: documentId,
      sessionId: session.sessionId,
      filename,
      mimeType,
      status: "processing",
    });

    await ingestGuestDocument({
      documentId,
      buffer,
      mimeType,
    });

    const row = await db.query.guestDocuments.findFirst({
      where: eq(guestDocuments.id, documentId),
    });

    const headers = new Headers();
    headers.set(
      "Set-Cookie",
      `${ANON_COOKIE_NAME}=${session.token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${60 * 60 * 24 * 400}`,
    );
    return NextResponse.json({ document: row }, { status: 201, headers });
  } catch (e) {
    return handleError(e);
  }
}

function sanitizeFilename(name: string): string {
  const base = name.replace(/[/\\]/g, "_").trim() || "document";
  return base.slice(0, 200);
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
  console.error(e);
  return NextResponse.json({ error: "Internal error" }, { status: 500 });
}
