import { and, asc, eq } from "drizzle-orm";
import { z } from "zod";
import { ensureProfile } from "@/server/auth/profile";
import {
  assertUserPrincipal,
  resolveRequestPrincipal,
} from "@/server/auth/principal";
import { getDb } from "@/server/db";
import { chats, messages } from "@/server/db/schema";
import { sseResponse } from "@/server/http/sse";
import { streamLlmCompletion } from "@/server/llm/stream";
import { dbMessagesToLlm } from "@/server/messages/to-llm";
import { rateLimitOrThrow } from "@/server/rate-limit";
import { isRagEmbeddingConfigured } from "@/server/rag/embed";
import { USER_IMAGE_PROMPT } from "@/lib/chat-prompts";
import { streamUserMessageSchema } from "@/lib/validation/chat";
import { retrieveContextForPrincipal } from "@/server/rag/principal";

const AUTH_STREAM_WINDOW_MS = 60_000;
const AUTH_STREAM_MAX = 60;

function computeChatTitle(currentTitle: string, firstMessageContent: string) {
  if (currentTitle !== "New chat") return currentTitle;
  if (firstMessageContent === USER_IMAGE_PROMPT) return "Image";
  const slice = firstMessageContent.slice(0, 60);
  return slice + (firstMessageContent.length > 60 ? "…" : "");
}

export async function POST(
  request: Request,
  context: { params: Promise<{ chatId: string }> },
) {
  try {
    const principal = assertUserPrincipal(
      await resolveRequestPrincipal(request),
    );
    const { user } = principal;
    rateLimitOrThrow(
      `chat-stream:${user.id}`,
      AUTH_STREAM_MAX,
      AUTH_STREAM_WINDOW_MS,
    );
    await ensureProfile(user.id, user.email);
    const { chatId } = await context.params;
    const raw = await request.text();
    if (!raw.trim()) {
      return Response.json({ error: "Empty body" }, { status: 400 });
    }
    const body = streamUserMessageSchema.parse(JSON.parse(raw));
    const db = getDb();

    const chat = await db.query.chats.findFirst({
      where: and(eq(chats.id, chatId), eq(chats.userId, user.id)),
    });
    if (!chat) {
      return Response.json({ error: "Not found" }, { status: 404 });
    }

    const attachmentPayload = body.images?.length
      ? body.images.map((img) => ({
          mimeType: img.mimeType,
          base64: img.base64,
        }))
      : null;

    await db.insert(messages).values({
      id: body.userMessageId,
      chatId,
      role: "user",
      content: body.content,
      attachments: attachmentPayload,
    });

    const msgRows = await db.query.messages.findMany({
      where: eq(messages.chatId, chatId),
      orderBy: [asc(messages.createdAt), asc(messages.id)],
      limit: 80,
    });

    const llmMessages = dbMessagesToLlm(msgRows);

    let ragContext: string | undefined;
    const docIds = body.documentIds;
    if (docIds?.length) {
      if (!isRagEmbeddingConfigured()) {
        return Response.json(
          {
            error:
              "GOOGLE_GENERATIVE_AI_API_KEY is required on the server to use document context (Gemini embeddings).",
          },
          { status: 400 },
        );
      }
      ragContext = await retrieveContextForPrincipal(principal, {
        query: body.content,
        documentIds: docIds,
      });
    }

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
      ragContext,
    });

    return sseResponse(stream, async (fullText) => {
      const dbComplete = getDb();
      await dbComplete.insert(messages).values({
        id: body.assistantMessageId,
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
