import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import {
  attachPrincipalHeaders,
  resolveRequestPrincipal,
} from "@/server/auth/principal";
import { getDb } from "@/server/db";
import { guestDocuments } from "@/server/db/schema";

export async function DELETE(
  request: Request,
  context: { params: Promise<{ documentId: string }> },
) {
  try {
    const principal = await resolveRequestPrincipal(request);
    if (principal.role !== "guest") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { documentId } = await context.params;
    const db = getDb();

    const doc = await db.query.guestDocuments.findFirst({
      where: and(
        eq(guestDocuments.id, documentId),
        eq(guestDocuments.sessionId, principal.sessionId),
      ),
    });
    if (!doc) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    await db.delete(guestDocuments).where(eq(guestDocuments.id, documentId));

    const headers = new Headers();
    attachPrincipalHeaders(headers, principal);
    return NextResponse.json({ ok: true }, { headers });
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
