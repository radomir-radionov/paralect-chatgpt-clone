import { NextResponse } from "next/server";
import type { ModelMessage } from "ai";

import { streamAssistantText } from "@shared/lib/ai/providers";
import { getAiModelBySlug, isAiModelSlug } from "@shared/lib/ai/model-registry";
import { getCurrentUser } from "@shared/lib/supabase/getCurrentUser";
import { createSupabaseAdminClient } from "@shared/lib/supabase/server";

type PersistedHistoryRow = {
  id: string;
  role: "assistant" | "user";
  text: string;
};

type PersistedAttachmentRow = {
  id: string;
  message_id: string;
  storage_bucket: string;
  storage_path: string;
  mime_type: string;
};

type IncomingAttachment = {
  id: string;
  storagePath: string;
  mimeType: string;
  sizeBytes: number;
  width?: number;
  height?: number;
  kind?: "image";
};

async function toModelMessages(options: {
  readonly modelSlug: string;
  readonly messages: PersistedHistoryRow[];
  readonly attachments: PersistedAttachmentRow[];
  readonly supabase: ReturnType<typeof createSupabaseAdminClient>;
}): Promise<ModelMessage[]> {
  const model = getAiModelBySlug(options.modelSlug);
  const supportsVision = model?.provider === "openai" || model?.provider === "google";

  const byMessageId = new Map<string, PersistedAttachmentRow[]>();
  for (const a of options.attachments) {
    const existing = byMessageId.get(a.message_id);
    if (existing) existing.push(a);
    else byMessageId.set(a.message_id, [a]);
  }

  return Promise.all(
    options.messages.map(async (m) => {
      if (m.role !== "user") {
        return { role: m.role, content: m.text } satisfies ModelMessage;
      }

      const messageText = m.text.trim()
        ? m.text
        : (byMessageId.get(m.id)?.length ?? 0) > 0
          ? "User sent an image."
          : m.text;

      if (!supportsVision) {
        const count = byMessageId.get(m.id)?.length ?? 0;
        const suffix =
          count > 0
            ? `\n\n[${count} image(s) attached, but this model does not support vision.]`
            : "";
        return { role: "user", content: `${messageText}${suffix}` } satisfies ModelMessage;
      }

      const attachments = byMessageId.get(m.id) ?? [];
      const imageParts = await Promise.all(
        attachments.map(async (a) => {
          const { data } = await options.supabase.storage
            .from(a.storage_bucket)
            .createSignedUrl(a.storage_path, 60 * 5);
          const url = data?.signedUrl;
          if (!url) return null;
          return {
            type: "image" as const,
            image: new URL(url),
            mediaType: a.mime_type,
          };
        }),
      );

      const parts = [
        { type: "text" as const, text: messageText },
        ...imageParts.filter((p): p is NonNullable<typeof p> => p != null),
      ];

      return { role: "user", content: parts } satisfies ModelMessage;
    }),
  );
}

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

  if (typeof assistantMessageId !== "string") {
    return NextResponse.json(
      { error: true, message: "Missing assistant message id" },
      { status: 400 },
    );
  }

  const supabase = createSupabaseAdminClient();

  const { data: room, error: roomError } = await supabase
    .from("chat_room")
    .select("id, model_slug")
    .eq("id", roomId)
    .eq("owner_id", user.id)
    .single();

  if (roomError || room == null) {
    return NextResponse.json({ error: true, message: "Chat not found" }, { status: 404 });
  }

  const modelSlug = room.model_slug;
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

    const attachments =
      Array.isArray(incomingAttachments) ? (incomingAttachments as IncomingAttachment[]) : [];

    if (typeof text !== "string") {
      return NextResponse.json(
        { error: true, message: "Missing message text" },
        { status: 400 },
      );
    }

    if (!text.trim() && attachments.length === 0) {
      return NextResponse.json(
        { error: true, message: "Message cannot be empty" },
        { status: 400 },
      );
    }

    const { data: userMessageRow, error: userMessageError } = await supabase
      .from("message")
      .insert({
        id: userMessageId,
        text: text.trim(),
        chat_room_id: room.id,
        author_id: user.id,
        role: "user",
      })
      .select("created_at")
      .single();

    if (userMessageError || userMessageRow == null) {
      return NextResponse.json(
        { error: true, message: "Failed to send message" },
        { status: 500 },
      );
    }

    await supabase
      .from("chat_room")
      .update({ last_message_at: userMessageRow.created_at })
      .eq("id", room.id);

    if (attachments.length > 0) {
      const rows = attachments
        .filter(
          (a): a is IncomingAttachment =>
            typeof a?.id === "string" &&
            typeof a?.storagePath === "string" &&
            typeof a?.mimeType === "string" &&
            typeof a?.sizeBytes === "number",
        )
        .map((a) => ({
          id: a.id,
          message_id: userMessageId,
          chat_room_id: room.id,
          owner_id: user.id,
          kind: "image" as const,
          storage_bucket: "chat-attachments",
          storage_path: a.storagePath,
          mime_type: a.mimeType,
          size_bytes: a.sizeBytes,
          width: typeof a.width === "number" ? a.width : null,
          height: typeof a.height === "number" ? a.height : null,
        }));

      if (rows.length > 0) {
        await supabase.from("message_attachment").insert(rows);
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

    const { data: userMessageRow, error: userMessageError } = await supabase
      .from("message")
      .select("id, role, text")
      .eq("id", userMessageId)
      .eq("chat_room_id", room.id)
      .eq("author_id", user.id)
      .single();

    if (userMessageError || userMessageRow == null || userMessageRow.role !== "user") {
      return NextResponse.json(
        { error: true, message: "User message not found" },
        { status: 404 },
      );
    }
  }

  const { data: history, error: historyError } = await supabase
    .from("message")
    .select("id, role, text")
    .eq("chat_room_id", room.id)
    .order("created_at", { ascending: true });

  if (historyError || history == null) {
    return NextResponse.json(
      { error: true, message: "Failed to build the AI prompt history" },
      { status: 500 },
    );
  }

  const { data: attachments, error: attachmentsError } = await supabase
    .from("message_attachment")
    .select("id, message_id, storage_bucket, storage_path, mime_type")
    .eq("chat_room_id", room.id)
    .order("created_at", { ascending: true });

  if (attachmentsError) {
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
          const modelMessages = await toModelMessages({
            modelSlug,
            messages: history as PersistedHistoryRow[],
            attachments: (attachments ?? []) as PersistedAttachmentRow[],
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

          const { data: assistantMessageRow, error: assistantMessageError } =
            await supabase
              .from("message")
              .insert({
                id: assistantMessageId,
                text: assistantText,
                chat_room_id: room.id,
                role: "assistant",
              })
              .select("created_at")
              .single();

          if (assistantMessageError || assistantMessageRow == null) {
            throw new Error("The AI response could not be saved");
          }

          await supabase
            .from("chat_room")
            .update({ last_message_at: assistantMessageRow.created_at })
            .eq("id", room.id);

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

          // Persist an assistant message even on failures so the UI won't "lose" the optimistic
          // message when it refetches from the DB after streaming.
          try {
            const { data: assistantMessageRow } = await supabase
              .from("message")
              .upsert(
                {
                  id: assistantMessageId,
                  text: errorText,
                  chat_room_id: room.id,
                  role: "assistant",
                },
                { onConflict: "id" },
              )
              .select("created_at")
              .single();

            if (assistantMessageRow?.created_at) {
              await supabase
                .from("chat_room")
                .update({ last_message_at: assistantMessageRow.created_at })
                .eq("id", room.id);
            }
          } catch {
            // If persisting the error message fails, still return a chunk so the user sees something.
          }

          // Avoid controller.error(...): many clients surface it as a generic "Failed to fetch".
          controller.enqueue(encoder.encode(`\n\n${errorText}\n`));
          controller.close();
        }
      })();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Accel-Buffering": "no",
      "Content-Encoding": "none",
    },
  });
}

