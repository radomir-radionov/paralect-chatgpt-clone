import { desc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { ensureProfile } from "@/server/auth/profile";
import { requireUserPrincipal } from "@/server/auth/principal";
import { getDb } from "@/server/db";
import { documents } from "@/server/db/schema";
import {
  DocumentUploadError,
  parseDocumentUpload,
} from "@/server/documents/upload";
import {
  ingestDocumentForPrincipal,
} from "@/server/rag/principal";
import { rateLimitOrThrow } from "@/server/rate-limit";
import {
  documentStoragePath,
  storageObjectFilename,
  uploadBytesToPath,
} from "@/server/storage/documents";
import { randomUUID } from "node:crypto";

const UPLOAD_WINDOW_MS = 60_000;
const UPLOAD_MAX_PER_WINDOW = 30;

export async function GET(request: Request) {
  try {
    const { user } = await requireUserPrincipal(request);
    await ensureProfile(user.id, user.email);
    const db = getDb();
    const rows = await db.query.documents.findMany({
      where: eq(documents.userId, user.id),
      orderBy: [desc(documents.createdAt)],
      limit: 200,
    });
    return NextResponse.json({ documents: rows });
  } catch (e) {
    return handleError(e);
  }
}

export async function POST(request: Request) {
  try {
    const principal = await requireUserPrincipal(request);
    const { user } = principal;
    await ensureProfile(user.id, user.email);
    rateLimitOrThrow(
      `doc-upload:${user.id}`,
      UPLOAD_MAX_PER_WINDOW,
      UPLOAD_WINDOW_MS,
    );

    const { buffer, filename, mimeType } = await parseDocumentUpload(request);
    const documentId = randomUUID();
    const storagePath = documentStoragePath(
      user.id,
      documentId,
      storageObjectFilename(documentId, filename),
    );

    const db = getDb();
    await db.insert(documents).values({
      id: documentId,
      userId: user.id,
      filename,
      mimeType,
      storagePath,
      status: "processing",
    });

    try {
      await uploadBytesToPath(storagePath, buffer, mimeType);
    } catch (e) {
      await db.delete(documents).where(eq(documents.id, documentId));
      throw e;
    }

    await ingestDocumentForPrincipal(principal, {
      documentId,
      buffer,
      mimeType,
    });

    const row = await db.query.documents.findFirst({
      where: eq(documents.id, documentId),
    });
    return NextResponse.json({ document: row }, { status: 201 });
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
