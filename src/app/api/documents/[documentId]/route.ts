import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { ensureProfile } from "@/server/auth/profile";
import { requireUser } from "@/server/auth/session";
import { getDb } from "@/server/db";
import { documents } from "@/server/db/schema";

export async function DELETE(
  request: Request,
  context: { params: Promise<{ documentId: string }> },
) {
  try {
    const user = await requireUser(request);
    await ensureProfile(user.id, user.email);
    const { documentId } = await context.params;
    const db = getDb();
    const [deleted] = await db
      .delete(documents)
      .where(and(eq(documents.id, documentId), eq(documents.userId, user.id)))
      .returning({ id: documents.id });
    if (!deleted) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return new NextResponse(null, { status: 204 });
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
