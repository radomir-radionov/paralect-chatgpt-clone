import { desc, eq } from "drizzle-orm";
import { after, NextResponse } from "next/server";
import { z } from "zod";
import { ensureProfile } from "@/server/auth/profile";
import { requireUser } from "@/server/auth/session";
import { getDb } from "@/server/db";
import { chats } from "@/server/db/schema";
import { broadcastChatEvent } from "@/server/realtime/broadcast";

export async function GET(request: Request) {
  try {
    const user = await requireUser(request);
    await ensureProfile(user.id, user.email);
    const db = getDb();
    let rows = await db.query.chats.findMany({
      where: eq(chats.userId, user.id),
      orderBy: [desc(chats.updatedAt)],
      limit: 100,
    });
    if (rows.length === 0) {
      const [created] = await db
        .insert(chats)
        .values({
          userId: user.id,
          title: "New chat",
        })
        .returning();
      if (created) {
        rows = [created];
      }
    }
    return NextResponse.json({ chats: rows });
  } catch (e) {
    return handleError(e);
  }
}

const createSchema = z.object({
  title: z.string().min(1).max(200).optional(),
});

export async function POST(request: Request) {
  try {
    const user = await requireUser(request);
    await ensureProfile(user.id, user.email);
    const json = await request.json().catch(() => ({}));
    const body = createSchema.parse(json);
    const db = getDb();
    const [row] = await db
      .insert(chats)
      .values({
        userId: user.id,
        title: body.title ?? "New chat",
      })
      .returning();
    if (!row) {
      return NextResponse.json({ error: "Failed to create chat" }, { status: 500 });
    }
    after(() => {
      void broadcastChatEvent(user.id, "chat_created", { chat: row });
    });
    return NextResponse.json({ chat: row }, { status: 201 });
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
  console.error(e);
  return NextResponse.json({ error: "Internal error" }, { status: 500 });
}
