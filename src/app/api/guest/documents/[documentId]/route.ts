import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { withAnonSessionCookie } from "@/server/anon/cookie-response";
import { getOrCreateAnonymousSession } from "@/server/anon/quota";
import { getDb } from "@/server/db";
import { anonymousDocuments } from "@/server/db/schema";

export async function DELETE(
  request: Request,
  context: { params: Promise<{ documentId: string }> },
) {
  try {
    const cookieHeader = request.headers.get("cookie");
    const session = await getOrCreateAnonymousSession(cookieHeader);
    const { documentId } = await context.params;
    const db = getDb();
    const [deleted] = await db
      .delete(anonymousDocuments)
      .where(
        and(
          eq(anonymousDocuments.id, documentId),
          eq(anonymousDocuments.sessionId, session.sessionId),
        ),
      )
      .returning({ id: anonymousDocuments.id });
    if (!deleted) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    const res = new NextResponse(null, { status: 204 });
    return withAnonSessionCookie(res, session.token);
  } catch (e) {
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
}
