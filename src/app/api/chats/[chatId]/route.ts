import { and, desc, eq, lt, or } from "drizzle-orm";
import { after, NextResponse } from "next/server";
import { z } from "zod";
import { ensureProfile } from "@/server/auth/profile";
import { requireUser } from "@/server/auth/session";
import { getDb } from "@/server/db";
import { chats, messages } from "@/server/db/schema";
import { broadcastChatEvent } from "@/server/realtime/broadcast";

const querySchema = z.object({
  limit: z.coerce.number().int().min(1).max(200).default(100),
  before: z.string().uuid().optional(),
});

export async function GET(
  request: Request,
  context: { params: Promise<{ chatId: string }> },
) {
  try {
    const user = await requireUser(request);
    await ensureProfile(user.id, user.email);
    const { chatId } = await context.params;

    const url = new URL(request.url);
    const parsed = querySchema.safeParse({
      limit: url.searchParams.get("limit") ?? undefined,
      before: url.searchParams.get("before") ?? undefined,
    });
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const { limit, before } = parsed.data;

    const db = getDb();
    const chat = await db.query.chats.findFirst({
      where: and(eq(chats.id, chatId), eq(chats.userId, user.id)),
    });
    if (!chat) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    let baseWhere = eq(messages.chatId, chatId);

    if (before !== undefined) {
      const anchor = await db.query.messages.findFirst({
        where: and(eq(messages.id, before), eq(messages.chatId, chatId)),
      });

      if (!anchor?.createdAt) {
        throw Object.assign(new Error("Invalid cursor"), { status: 400 });
      }

      const anchorAt = anchor.createdAt;

      const cursorWhere = and(
        eq(messages.chatId, chatId),
        or(
          lt(messages.createdAt, anchorAt),
          and(
            eq(messages.createdAt, anchorAt),
            lt(messages.id, anchor.id),
          ),
        ),
      );

      // `and` can be typed as returning `SQL | undefined`; fall back to baseWhere if it ever did.
      baseWhere = cursorWhere ?? baseWhere;
    }

    const rowsDesc = await db.query.messages.findMany({
      where: baseWhere,
      orderBy: [desc(messages.createdAt), desc(messages.id)],
      limit: limit + 1,
    });
    const hasOlder = rowsDesc.length > limit;
    const chunk = hasOlder ? rowsDesc.slice(0, limit) : rowsDesc;
    const msgRows = chunk.slice().reverse();
    const oldestMessageId = msgRows[0]?.id ?? null;

    return NextResponse.json({
      chat,
      messages: msgRows,
      page: {
        limit,
        hasOlder,
        oldestMessageId,
      },
    });
  } catch (e) {
    return handleError(e);
  }
}

const patchSchema = z.object({
  title: z.string().min(1).max(200),
});

export async function PATCH(
  request: Request,
  context: { params: Promise<{ chatId: string }> },
) {
  try {
    const user = await requireUser(request);
    await ensureProfile(user.id, user.email);
    const { chatId } = await context.params;
    const body = patchSchema.parse(await request.json());
    const db = getDb();
    const [updated] = await db
      .update(chats)
      .set({ title: body.title, updatedAt: new Date() })
      .where(and(eq(chats.id, chatId), eq(chats.userId, user.id)))
      .returning();
    if (!updated) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    after(() => {
      void broadcastChatEvent(user.id, "chat_updated", { chat: updated });
    });
    return NextResponse.json({ chat: updated });
  } catch (e) {
    return handleError(e);
  }
}

export async function DELETE(
  request: Request,
  context: { params: Promise<{ chatId: string }> },
) {
  try {
    const user = await requireUser(request);
    await ensureProfile(user.id, user.email);
    const { chatId } = await context.params;
    const db = getDb();

    const result = await db.transaction(async (tx) => {
      const userChats = await tx.query.chats.findMany({
        where: eq(chats.userId, user.id),
        columns: { id: true },
      });

      if (userChats.length === 0) {
        return { kind: "not_found" as const, deleted: null as null };
      }

      if (userChats.length === 1) {
        const [onlyChat] = userChats;
        if (onlyChat?.id === chatId) {
          return { kind: "forbidden" as const, deleted: null as null };
        }
        return { kind: "not_found" as const, deleted: null as null };
      }

      const [deleted] = await tx
        .delete(chats)
        .where(and(eq(chats.id, chatId), eq(chats.userId, user.id)))
        .returning({ id: chats.id });

      if (!deleted) {
        return { kind: "not_found" as const, deleted: null as null };
      }

      return { kind: "ok" as const, deleted };
    });

    if (result.kind === "forbidden") {
      return NextResponse.json(
        { error: "At least one chat must exist" },
        { status: 409 },
      );
    }

    if (result.kind === "not_found" || !result.deleted) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    after(() => {
      void broadcastChatEvent(user.id, "chat_deleted", { chatId });
    });
    return new NextResponse(null, { status: 204 });
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
