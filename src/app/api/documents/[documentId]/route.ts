import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { ensureProfile } from "@/server/auth/profile";
import { requireUser } from "@/server/auth/session";
import { getDb } from "@/server/db";
import { documents } from "@/server/db/schema";
import { deleteUserDocumentObject } from "@/server/storage/documents";

export async function DELETE(
  request: Request,
  context: { params: Promise<{ documentId: string }> },
) {
  try {
    const user = await requireUser(request);
    await ensureProfile(user.id, user.email);
    const { documentId } = await context.params;
    const db = getDb();

    const doc = await db.query.documents.findFirst({
      where: and(eq(documents.id, documentId), eq(documents.userId, user.id)),
    });
    if (!doc) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    await db.delete(documents).where(eq(documents.id, documentId));
    try {
      await deleteUserDocumentObject(doc.storagePath);
    } catch (e) {
      console.warn("Storage delete:", e);
    }

    return NextResponse.json({ ok: true });
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
  console.error(e);
  return NextResponse.json({ error: "Internal error" }, { status: 500 });
}
