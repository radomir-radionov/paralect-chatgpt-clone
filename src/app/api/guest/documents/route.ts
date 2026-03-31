import { desc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import {
  attachPrincipalHeaders,
  resolveRequestPrincipal,
} from "@/server/auth/principal";
import { getDb } from "@/server/db";
import { guestDocuments } from "@/server/db/schema";
import {
  DocumentUploadError,
  parseDocumentUpload,
} from "@/server/documents/upload";
import { ingestDocumentForPrincipal } from "@/server/rag/principal";
import { getClientIp, rateLimitOrThrow } from "@/server/rate-limit";
import { randomUUID } from "node:crypto";

const UPLOAD_WINDOW_MS = 60_000;
const UPLOAD_MAX_PER_WINDOW = 20;

export async function GET(request: Request) {
  try {
    const principal = await resolveRequestPrincipal(request);
    if (principal.role !== "guest") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const db = getDb();
    const rows = await db.query.guestDocuments.findMany({
      where: eq(guestDocuments.sessionId, principal.sessionId),
      orderBy: [desc(guestDocuments.createdAt)],
      limit: 100,
    });
    const headers = new Headers();
    attachPrincipalHeaders(headers, principal);
    return NextResponse.json({ documents: rows }, { headers });
  } catch (e) {
    return handleError(e);
  }
}

export async function POST(request: Request) {
  try {
    const principal = await resolveRequestPrincipal(request);
    if (principal.role !== "guest") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    rateLimitOrThrow(
      `guest-doc-upload:${getClientIp(request)}`,
      UPLOAD_MAX_PER_WINDOW,
      UPLOAD_WINDOW_MS,
    );

    const { buffer, filename, mimeType } = await parseDocumentUpload(request);
    const documentId = randomUUID();

    const db = getDb();
    await db.insert(guestDocuments).values({
      id: documentId,
      sessionId: principal.sessionId,
      filename,
      mimeType,
      status: "processing",
    });

    await ingestDocumentForPrincipal(principal, {
      documentId,
      buffer,
      mimeType,
    });

    const row = await db.query.guestDocuments.findFirst({
      where: eq(guestDocuments.id, documentId),
    });

    const headers = new Headers();
    attachPrincipalHeaders(headers, principal);
    return NextResponse.json({ document: row }, { status: 201, headers });
  } catch (e) {
    return handleError(e);
  }
}

function handleError(e: unknown) {
  if (e instanceof z.ZodError) {
    return NextResponse.json({ error: e.flatten() }, { status: 400 });
  }
  if (e instanceof DocumentUploadError) {
    return NextResponse.json({ error: e.message }, { status: e.status });
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
