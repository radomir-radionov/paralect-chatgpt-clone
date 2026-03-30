import { and, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { ensureProfile } from "@/server/auth/profile";
import { requireUser } from "@/server/auth/session";
import { getDb } from "@/server/db";
import { chats, documents, messages } from "@/server/db/schema";
import { sseResponse } from "@/server/http/sse";
import { streamLlmCompletion } from "@/server/llm/stream";
import { dbMessagesToLlm } from "@/server/messages/to-llm";
import { rateLimitOrThrow } from "@/server/rate-limit";
import { streamUserMessageSchema } from "@/lib/validation/chat";

const AUTH_STREAM_WINDOW_MS = 60_000;
const AUTH_STREAM_MAX = 60;

function computeChatTitle(currentTitle: string, firstMessageContent: string) {
  if (currentTitle !== "New chat") return currentTitle;
  const slice = firstMessageContent.slice(0, 60);
  return slice + (firstMessageContent.length > 60 ? "…" : "");
}

export async function POST(
  request: Request,
  context: { params: Promise<{ chatId: string }> },
) {
  try {
    const user = await requireUser(request);
    rateLimitOrThrow(
      `chat-stream:${user.id}`,
      AUTH_STREAM_MAX,
      AUTH_STREAM_WINDOW_MS,
    );
    await ensureProfile(user.id, user.email);
    const { chatId } = await context.params;
    const body = streamUserMessageSchema.parse(await request.json());
    const db = getDb();

    const chat = await db.query.chats.findFirst({
      where: and(eq(chats.id, chatId), eq(chats.userId, user.id)),
    });
    if (!chat) {
      return Response.json({ error: "Not found" }, { status: 404 });
    }

    const contextText = await loadDocumentContext(user.id, body.documentIds);

    const attachmentPayload = body.images?.length
      ? body.images.map((img) => ({
          mimeType: img.mimeType,
          base64: img.base64,
        }))
      : null;

    await db.insert(messages).values({
      chatId,
      role: "user",
      content: body.content,
      attachments: attachmentPayload,
    });

    const msgRows = await db.query.messages.findMany({
      where: eq(messages.chatId, chatId),
      orderBy: (m, { asc }) => [asc(m.createdAt)],
      limit: 80,
    });

    const llmMessages = dbMessagesToLlm(msgRows);

    const title = computeChatTitle(chat.title, body.content);

    await db
      .update(chats)
      .set({
        title,
        updatedAt: new Date(),
      })
      .where(eq(chats.id, chatId));

    const stream = streamLlmCompletion({
      modelId: body.modelId,
      messages: llmMessages,
      context: contextText,
    });

    return sseResponse(stream, async (fullText) => {
      const dbComplete = getDb();
      await dbComplete.insert(messages).values({
        chatId,
        role: "assistant",
        content: fullText,
      });
      await dbComplete
        .update(chats)
        .set({ updatedAt: new Date() })
        .where(eq(chats.id, chatId));
    });
  } catch (e) {
    return handleError(e);
  }
}

async function loadDocumentContext(userId: string, ids?: string[]) {
  if (!ids?.length) return undefined;
  const db = getDb();
  const rows = await db.query.documents.findMany({
    where: and(eq(documents.userId, userId), inArray(documents.id, ids)),
  });
  if (!rows.length) return undefined;
  return rows
    .map((r) => `--- ${r.filename} ---\n${r.textContent}`)
    .join("\n\n");
}

function handleError(e: unknown) {
  if (e instanceof z.ZodError) {
    return Response.json({ error: e.flatten() }, { status: 400 });
  }
  if (
    e instanceof Error &&
    "status" in e &&
    typeof (e as { status?: number }).status === "number"
  ) {
    return Response.json(
      { error: e.message },
      { status: (e as { status: number }).status },
    );
  }
  console.error(e);
  return Response.json({ error: "Internal error" }, { status: 500 });
}
