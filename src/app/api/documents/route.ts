import { desc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { ensureProfile } from "@/server/auth/profile";
import { requireUser } from "@/server/auth/session";
import { extractTextFromBuffer } from "@/server/documents/extract";
import { getDb } from "@/server/db";
import { chats, documents } from "@/server/db/schema";

const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;

export async function GET(request: Request) {
  try {
    const user = await requireUser(request);
    await ensureProfile(user.id, user.email);
    const db = getDb();
    const rows = await db.query.documents.findMany({
      where: eq(documents.userId, user.id),
      orderBy: [desc(documents.createdAt)],
      limit: 50,
    });
    return NextResponse.json({ documents: rows });
  } catch (e) {
    return handleError(e);
  }
}

const metaSchema = z.object({
  chatId: z.string().uuid().optional(),
});

export async function POST(request: Request) {
  try {
    const user = await requireUser(request);
    await ensureProfile(user.id, user.email);
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Missing file" }, { status: 400 });
    }
    const metaRaw = form.get("meta");
    const meta =
      typeof metaRaw === "string" && metaRaw
        ? metaSchema.parse(JSON.parse(metaRaw))
        : {};
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
    if (meta.chatId) {
      const db = getDb();
      const chat = await db.query.chats.findFirst({
        where: eq(chats.id, meta.chatId),
      });
      if (!chat || chat.userId !== user.id) {
        return NextResponse.json({ error: "Invalid chat" }, { status: 400 });
      }
    }
    const db = getDb();
    const [row] = await db
      .insert(documents)
      .values({
        userId: user.id,
        chatId: meta.chatId ?? null,
        filename: file.name,
        mimeType: file.type || "application/octet-stream",
        textContent,
      })
      .returning();
    if (!row) {
      return NextResponse.json({ error: "Failed to save" }, { status: 500 });
    }
    return NextResponse.json({ document: row }, { status: 201 });
  } catch (e) {
    return handleError(e);
  }
}

function handleError(e: unknown) {
  if (e instanceof z.ZodError) {
    return NextResponse.json({ error: e.flatten() }, { status: 400 });
  }
  if (e instanceof Error && "status" in e && typeof (e as { status?: number }).status === "number") {
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
