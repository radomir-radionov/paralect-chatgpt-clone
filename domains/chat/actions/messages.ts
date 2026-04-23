"use server";

import type { ModelMessage } from "ai";

import {
  generateAssistantText,
} from "@shared/lib/ai/providers";
import {
  getAiModelBySlug,
  isAiModelSlug,
} from "@shared/lib/ai/model-registry";
import { getCurrentUser } from "@shared/lib/supabase/getCurrentUser";
import { createSupabaseAdminClient } from "@shared/lib/supabase/server";

import type { Message } from "@domains/chat/types/chat.types";

type PersistedMessageRow = {
  id: string;
  text: string;
  created_at: string;
  author_id: string | null;
  role: "assistant" | "user";
  error_message: string | null;
  author: {
    name: string;
    image_url: string | null;
  } | null;
};

type SendMessageSuccess = {
  error: false;
  userMessage: Message;
  assistantMessage: Message;
};

type SendMessageFailure = {
  error: true;
  message: string;
  userMessage?: Message;
};

function toChatMessage(row: PersistedMessageRow): Message {
  return {
    id: row.id,
    text: row.text,
    created_at: row.created_at,
    author_id: row.author_id,
    role: row.role,
    author:
      row.role === "assistant"
        ? { name: "Assistant", image_url: null }
        : {
            name: row.author?.name ?? "You",
            image_url: row.author?.image_url ?? null,
          },
    error_message: row.error_message,
  };
}

function toModelMessages(
  messages: Array<Pick<PersistedMessageRow, "role" | "text">>,
): ModelMessage[] {
  return messages.map((message) => ({
    role: message.role,
    content: message.text,
  }));
}

export async function sendMessage(data: {
  id: string;
  text: string;
  roomId: string;
}): Promise<SendMessageSuccess | SendMessageFailure> {
  const user = await getCurrentUser();
  if (user == null) {
    return { error: true, message: "User not authenticated" };
  }

  if (!data.text.trim()) {
    return { error: true, message: "Message cannot be empty" };
  }

  const supabase = createSupabaseAdminClient();

  const { data: room, error: roomError } = await supabase
    .from("chat_room")
    .select("id, name, model_slug")
    .eq("id", data.roomId)
    .eq("owner_id", user.id)
    .single();

  if (roomError || room == null) {
    return { error: true, message: "Chat not found" };
  }

  if (!isAiModelSlug(room.model_slug)) {
    return { error: true, message: "This chat uses an unsupported AI model" };
  }

  const { data: userMessageRow, error: userMessageError } = await supabase
    .from("message")
    .insert({
      id: data.id,
      text: data.text.trim(),
      chat_room_id: data.roomId,
      author_id: user.id,
      role: "user",
    })
    .select(
      "id, text, created_at, author_id, role, error_message, author:user_profile (name, image_url)",
    )
    .single();

  if (userMessageError || userMessageRow == null) {
    return { error: true, message: "Failed to send message" };
  }

  const userMessage = toChatMessage(userMessageRow as PersistedMessageRow);

  await supabase
    .from("chat_room")
    .update({ last_message_at: userMessage.created_at })
    .eq("id", room.id);

  const { data: history, error: historyError } = await supabase
    .from("message")
    .select("role, text")
    .eq("chat_room_id", room.id)
    .order("created_at", { ascending: true });

  if (historyError || history == null) {
    return {
      error: true,
      message: "Failed to build the AI prompt history",
      userMessage,
    };
  }

  try {
    const { text: assistantText } = await generateAssistantText({
      modelSlug: room.model_slug,
      system: `You are a helpful AI assistant inside Paralect Chat. Keep answers clear, concise, and practical unless the user asks for more depth.`,
      messages: toModelMessages(history),
    });

    const { data: assistantMessageRow, error: assistantMessageError } =
      await supabase
        .from("message")
        .insert({
          text: assistantText,
          chat_room_id: room.id,
          role: "assistant",
        })
        .select("id, text, created_at, author_id, role, error_message")
        .single();

    if (assistantMessageError || assistantMessageRow == null) {
      return {
        error: true,
        message: "The AI response could not be saved",
        userMessage,
      };
    }

    const assistantMessage = toChatMessage(
      assistantMessageRow as PersistedMessageRow,
    );

    await supabase
      .from("chat_room")
      .update({ last_message_at: assistantMessage.created_at })
      .eq("id", room.id);

    return {
      error: false,
      userMessage,
      assistantMessage,
    };
  } catch (error) {
    const model = getAiModelBySlug(room.model_slug);
    const providerName = model?.provider === "google" ? "Gemini" : "OpenAI";

    return {
      error: true,
      message:
        error instanceof Error
          ? `${providerName} request failed: ${error.message}`
          : `${providerName} request failed`,
      userMessage,
    };
  }
}
