import { NextResponse } from "next/server";

import { streamAssistantText } from "@shared/lib/ai/providers";
import { getAiModelBySlug, isAiModelSlug } from "@shared/lib/ai/model-registry";
import { getCurrentUser } from "@shared/lib/supabase/getCurrentUser";
import { createSupabaseAdminClient } from "@shared/lib/supabase/server";
import { STREAMING_TEXT_HEADERS } from "@shared/lib/http/streamingTextHeaders";
import {
  normalizeStreamIncomingAttachments,
  parseStreamIncomingDocuments,
  verifyStreamIncomingImageObjects,
} from "@domains/chat/lib/streamIncomingAttachments";
import { historyRowsToModelMessages } from "@domains/chat/lib/streamModelMessages";
import type {
  ParsedStreamIncomingDocument,
  StreamIncomingAttachment,
} from "@domains/chat/lib/streamTypes";
import {
  buildStreamAttachmentInsertRows,
  fetchStreamMessageAttachments,
  fetchStreamMessageHistoryDesc,
  insertStreamAssistantMessage,
  insertStreamMessageAttachments,
  insertStreamUserMessage,
  selectOwnedChatRoomForStream,
  selectStreamUserMessageForRegenerate,
  updateChatRoomLastMessageAt,
  upsertStreamAssistantErrorMessage,
} from "@domains/chat/queries/messageStreamRepository";

export const runtime = "nodejs";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ roomId: string }> },
) {
  const user = await getCurrentUser();
  if (user == null) {
    return NextResponse.json(
      { error: true, message: "User not authenticated" },
      { status: 401 },
    );
  }

  const { roomId } = await params;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: true, message: "Invalid JSON body" },
      { status: 400 },
    );
  }

  const raw = body as Record<string, unknown>;
  const mode =
    raw.mode === "assistant_only" ? ("assistant_only" as const) : ("user_and_assistant" as const);
  const assistantMessageId = raw.assistantId;
  const incomingAttachments = raw.attachments;
  const requestedModelSlug = raw.modelSlug;

  if (typeof assistantMessageId !== "string") {
    return NextResponse.json(
      { error: true, message: "Missing assistant message id" },
      { status: 400 },
    );
  }

  const supabase = createSupabaseAdminClient();

  const room = await selectOwnedChatRoomForStream(supabase, {
    roomId,
    ownerId: user.id,
  });

  if (room == null) {
    return NextResponse.json({ error: true, message: "Chat not found" }, { status: 404 });
  }

  const overrideModelSlug = typeof requestedModelSlug === "string" ? requestedModelSlug : null;
  const modelSlug = overrideModelSlug ?? room.model_slug;
  if (!isAiModelSlug(modelSlug)) {
    return NextResponse.json(
      { error: true, message: "This chat uses an unsupported AI model" },
      { status: 400 },
    );
  }

  if (mode === "user_and_assistant") {
    const userMessageId = raw.id;
    const text = raw.text;

    if (typeof userMessageId !== "string") {
      return NextResponse.json(
        { error: true, message: "Missing user message id" },
        { status: 400 },
      );
    }

    const rawAttachments =
      Array.isArray(incomingAttachments) ? (incomingAttachments as StreamIncomingAttachment[]) : [];

    if (typeof text !== "string") {
      return NextResponse.json(
        { error: true, message: "Missing message text" },
        { status: 400 },
      );
    }

    let attachments: StreamIncomingAttachment[];
    try {
      attachments = normalizeStreamIncomingAttachments({
        attachments: rawAttachments,
        userId: user.id,
        roomId: room.id,
        messageId: userMessageId,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Invalid attachment metadata";
      return NextResponse.json({ error: true, message }, { status: 400 });
    }

    if (!text.trim() && attachments.length === 0) {
      return NextResponse.json(
        { error: true, message: "Message cannot be empty" },
        { status: 400 },
      );
    }

    let parsedDocuments: Map<string, ParsedStreamIncomingDocument>;
    try {
      await verifyStreamIncomingImageObjects({ attachments, supabase });
      parsedDocuments = await parseStreamIncomingDocuments({ attachments, supabase });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to parse document";
      return NextResponse.json({ error: true, message }, { status: 400 });
    }

    const userMessageRow = await insertStreamUserMessage(supabase, {
      messageId: userMessageId,
      text: text.trim(),
      chatRoomId: room.id,
      authorId: user.id,
    });

    if (userMessageRow == null) {
      return NextResponse.json(
        { error: true, message: "Failed to send message" },
        { status: 500 },
      );
    }

    await updateChatRoomLastMessageAt(supabase, {
      chatRoomId: room.id,
      lastMessageAt: userMessageRow.created_at,
    });

    if (attachments.length > 0) {
      const rows = buildStreamAttachmentInsertRows({
        attachments,
        parsedDocuments,
        userMessageId,
        chatRoomId: room.id,
        ownerId: user.id,
      });

      const ok = await insertStreamMessageAttachments(supabase, { rows });
      if (!ok) {
        return NextResponse.json(
          { error: true, message: "Failed to save message attachments" },
          { status: 500 },
        );
      }
    }
  } else {
    const userMessageId = raw.userMessageId;
    if (typeof userMessageId !== "string") {
      return NextResponse.json(
        { error: true, message: "Missing user message id" },
        { status: 400 },
      );
    }

    const userMessageRow = await selectStreamUserMessageForRegenerate(supabase, {
      messageId: userMessageId,
      chatRoomId: room.id,
      authorId: user.id,
    });

    if (userMessageRow == null) {
      return NextResponse.json(
        { error: true, message: "User message not found" },
        { status: 404 },
      );
    }
  }

  const historyDesc = await fetchStreamMessageHistoryDesc(supabase, room.id);
  if (historyDesc == null) {
    return NextResponse.json(
      { error: true, message: "Failed to build the AI prompt history" },
      { status: 500 },
    );
  }

  const history = historyDesc;
  const messageIds = history.map((m) => m.id);

  const attachments = await fetchStreamMessageAttachments(supabase, messageIds);
  if (attachments == null) {
    return NextResponse.json(
      { error: true, message: "Failed to load message attachments" },
      { status: 500 },
    );
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      let fullText = "";

      (async () => {
        try {
          const modelMessages = await historyRowsToModelMessages({
            modelSlug,
            messages: history,
            attachments,
            supabase,
          });

          const { textStream } = streamAssistantText({
            modelSlug,
            system:
              "You are a helpful AI assistant inside Paralect Chat. Keep answers clear, concise, and practical unless the user asks for more depth.",
            messages: modelMessages,
          });

          for await (const delta of textStream) {
            fullText += delta;
            controller.enqueue(encoder.encode(delta));
          }

          const assistantText = fullText.trim();
          if (!assistantText) {
            throw new Error(
              `Empty response from ${modelSlug}. This can happen if the provider returns no tokens or blocks the output.`,
            );
          }

          const assistantMessageRow = await insertStreamAssistantMessage(supabase, {
            messageId: assistantMessageId,
            text: assistantText,
            chatRoomId: room.id,
          });

          if (assistantMessageRow == null) {
            throw new Error("The AI response could not be saved");
          }

          await updateChatRoomLastMessageAt(supabase, {
            chatRoomId: room.id,
            lastMessageAt: assistantMessageRow.created_at,
          });

          controller.close();
        } catch (error) {
          const model = getAiModelBySlug(modelSlug);
          const providerName =
            model?.provider === "google"
              ? "Gemini"
              : model?.provider === "groq"
                ? "Groq"
                : "OpenAI";
          const message = error instanceof Error ? error.message : "Unknown error";
          const errorText = `[${providerName} request failed: ${message}]`;

          try {
            await upsertStreamAssistantErrorMessage(supabase, {
              messageId: assistantMessageId,
              text: errorText,
              chatRoomId: room.id,
            });
          } catch {
            // If persisting the error message fails, still return a chunk so the user sees something.
          }

          controller.enqueue(encoder.encode(`\n\n${errorText}\n`));
          controller.close();
        }
      })();
    },
  });

  return new Response(stream, {
    headers: {
      ...STREAMING_TEXT_HEADERS,
    },
  });
}
