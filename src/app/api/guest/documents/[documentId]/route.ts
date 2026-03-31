import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import {
  getOrCreateAnonymousSession,
  ANON_COOKIE_NAME,
} from "@/server/anon/quota";
import { getDb } from "@/server/db";
import { guestDocuments } from "@/server/db/schema";

export async function DELETE(
  request: Request,
  context: { params: Promise<{ documentId: string }> },
) {
  try {
    const cookieHeader = request.headers.get("cookie");
    const session = await getOrCreateAnonymousSession(cookieHeader);
    const { documentId } = await context.params;
    const db = getDb();

    const doc = await db.query.guestDocuments.findFirst({
      where: and(
        eq(guestDocuments.id, documentId),
        eq(guestDocuments.sessionId, session.sessionId),
      ),
    });
    if (!doc) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    await db.delete(guestDocuments).where(eq(guestDocuments.id, documentId));

    const headers = new Headers();
    headers.set(
      "Set-Cookie",
      `${ANON_COOKIE_NAME}=${session.token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${60 * 60 * 24 * 400}`,
    );
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
