"use server";

import { redirect } from "next/navigation";
import z from "zod";

import { getCurrentUser } from "@shared/lib/supabase/getCurrentUser";
import { createSupabaseAdminClient } from "@shared/lib/supabase/server";
import {
  CHAT_DOCUMENTS_MAX_ATTACHMENTS,
  CHAT_DOCUMENTS_MAX_BYTES,
  fileExtensionForDocument,
} from "@domains/chat/lib/chatDocuments";
import { CHAT_IMAGES_MAX_ATTACHMENTS, CHAT_IMAGES_MAX_BYTES } from "@domains/chat/lib/chatImages";
import { parseChatDocument } from "@domains/chat/lib/unstructuredDocuments";

import {
  createRoomSchema,
  deleteRoomSchema,
  startRoomWithFirstMessageSchema,
  updateRoomModelSchema,
} from "@domains/chat/schemas/rooms";

const DEFAULT_ROOM_NAME = "AI Chat";

type FirstMessageAttachment = z.infer<typeof startRoomWithFirstMessageSchema>["attachments"] extends
  | Array<infer Attachment>
  | undefined
  ? Attachment
  : never;

type ParsedDocument = {
  extractedText: string;
  extractedChars: number;
};

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
}

function deriveRoomNameFromText(text: string): string {
  const normalized = text.replaceAll(/\s+/g, " ").trim();
  if (normalized.length === 0) return DEFAULT_ROOM_NAME;

  const maxLen = 60;
  if (normalized.length <= maxLen) return normalized;

  return `${normalized.slice(0, maxLen).trimEnd()}…`;
}

function normalizeFirstMessageAttachments(options: {
  readonly attachments: FirstMessageAttachment[];
  readonly userId: string;
  readonly messageId: string;
}) {
  const pathPrefix = `${options.userId}/tmp/${options.messageId}/`;

  for (const attachment of options.attachments) {
    if (
      !isUuid(attachment.id) ||
      !Number.isInteger(attachment.sizeBytes) ||
      attachment.sizeBytes < 0 ||
      !attachment.storagePath.startsWith(pathPrefix)
    ) {
      throw new Error("Invalid attachment metadata");
    }

    if (attachment.kind === "image" && attachment.sizeBytes > CHAT_IMAGES_MAX_BYTES) {
      throw new Error("One of the images is too large");
    }

    if (attachment.kind === "document") {
      const originalName = attachment.originalName?.trim() || "document";

      if (attachment.sizeBytes > CHAT_DOCUMENTS_MAX_BYTES) {
        throw new Error("One of the documents is too large");
      }

      if (!fileExtensionForDocument({ name: originalName, type: attachment.mimeType })) {
        throw new Error(`Unsupported document type: ${originalName}`);
      }
    }
  }

  const imageCount = options.attachments.filter((a) => a.kind === "image").length;
  const documentCount = options.attachments.filter((a) => a.kind === "document").length;

  if (imageCount > CHAT_IMAGES_MAX_ATTACHMENTS) {
    throw new Error(`You can attach up to ${CHAT_IMAGES_MAX_ATTACHMENTS} images`);
  }

  if (documentCount > CHAT_DOCUMENTS_MAX_ATTACHMENTS) {
    throw new Error(`You can attach up to ${CHAT_DOCUMENTS_MAX_ATTACHMENTS} documents`);
  }

  return options.attachments;
}

async function parseFirstMessageDocuments(options: {
  readonly attachments: FirstMessageAttachment[];
  readonly supabase: ReturnType<typeof createSupabaseAdminClient>;
}) {
  const parsed = new Map<string, ParsedDocument>();

  for (const attachment of options.attachments) {
    if (attachment.kind !== "document") continue;

    const { data, error } = await options.supabase.storage
      .from("chat-attachments")
      .download(attachment.storagePath);

    if (error || data == null) {
      throw new Error(`Failed to load ${attachment.originalName ?? "document"} for parsing`);
    }

    if (data.size > CHAT_DOCUMENTS_MAX_BYTES) {
      throw new Error("One of the documents is too large");
    }

    const result = await parseChatDocument({
      fileName: attachment.originalName ?? attachment.storagePath.split("/").pop() ?? "document",
      mimeType: attachment.mimeType,
      content: await data.arrayBuffer(),
    });

    parsed.set(attachment.id, {
      extractedText: result.text,
      extractedChars: result.textChars,
    });
  }

  return parsed;
}

async function verifyFirstMessageImages(options: {
  readonly attachments: FirstMessageAttachment[];
  readonly supabase: ReturnType<typeof createSupabaseAdminClient>;
}) {
  for (const attachment of options.attachments) {
    if (attachment.kind !== "image") continue;

    const { data, error } = await options.supabase.storage
      .from("chat-attachments")
      .download(attachment.storagePath);

    if (error || data == null) {
      throw new Error("Failed to load image attachment");
    }

    if (data.size > CHAT_IMAGES_MAX_BYTES) {
      throw new Error("One of the images is too large");
    }
  }
}

export async function createRoom(unsafeData: z.infer<typeof createRoomSchema>) {
  const { success, data } = createRoomSchema.safeParse(unsafeData);

  if (!success) {
    return { error: true, message: "Invalid room data" };
  }

  const user = await getCurrentUser();
  if (user == null) {
    return { error: true, message: "User not authenticated" };
  }

  const supabase = createSupabaseAdminClient();

  const { data: room, error: roomError } = await supabase
    .from("chat_room")
    .insert({
      name: data.name,
      is_public: false,
      owner_id: user.id,
      model_slug: data.modelSlug,
    })
    .select("id")
    .single();

  if (roomError || room == null) {
    return { error: true, message: "Failed to create room" };
  }

  redirect(`/rooms/${room.id}`);
}

type StartRoomWithFirstMessageResult =
  | { error: false; roomId: string }
  | { error: true; message: string; roomId?: string };

export async function startRoomWithFirstMessage(
  unsafeData: z.infer<typeof startRoomWithFirstMessageSchema>,
): Promise<StartRoomWithFirstMessageResult> {
  const { success, data } = startRoomWithFirstMessageSchema.safeParse(unsafeData);

  if (!success) {
    return { error: true, message: "Invalid message data" };
  }

  const user = await getCurrentUser();
  if (user == null) {
    return { error: true, message: "User not authenticated" };
  }

  const supabase = createSupabaseAdminClient();
  let attachments: FirstMessageAttachment[];
  try {
    attachments = normalizeFirstMessageAttachments({
      attachments: data.attachments ?? [],
      userId: user.id,
      messageId: data.messageId,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invalid attachment metadata";
    return { error: true, message };
  }

  let parsedDocuments: Map<string, ParsedDocument>;
  try {
    await verifyFirstMessageImages({ attachments, supabase });
    parsedDocuments = await parseFirstMessageDocuments({ attachments, supabase });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to parse document";
    return { error: true, message };
  }

  const hasDocuments = attachments.some((a) => a.kind === "document");
  const derivedRoomName = deriveRoomNameFromText(
    data.text.trim() || (hasDocuments ? "Document" : "Image"),
  );
  const { data: room, error: roomError } = await supabase
    .from("chat_room")
    .insert({
      name: derivedRoomName,
      is_public: false,
      owner_id: user.id,
      model_slug: data.modelSlug,
    })
    .select("id")
    .single();

  if (roomError || room == null) {
    return { error: true, message: "Failed to create room" };
  }

  const { data: userMessageRow, error: userMessageError } = await supabase
    .from("message")
    .insert({
      id: data.messageId,
      text: data.text.trim(),
      chat_room_id: room.id,
      author_id: user.id,
      role: "user",
    })
    .select("created_at")
    .single();

  if (userMessageError || userMessageRow == null) {
    // Room is created; allow the client to navigate into it anyway.
    return { error: true, message: "Failed to send message", roomId: room.id };
  }

  await supabase
    .from("chat_room")
    .update({
      name: derivedRoomName,
      last_message_at: userMessageRow.created_at,
    })
    .eq("id", room.id);

  if (attachments.length > 0) {
    const { error: attachmentInsertError } = await supabase.from("message_attachment").insert(
      attachments.map((a) => ({
        id: a.id,
        message_id: data.messageId,
        chat_room_id: room.id,
        owner_id: user.id,
        kind: a.kind,
        storage_bucket: "chat-attachments",
        storage_path: a.storagePath,
        mime_type: a.mimeType,
        size_bytes: a.sizeBytes,
        width: typeof a.width === "number" ? a.width : null,
        height: typeof a.height === "number" ? a.height : null,
        original_name: a.originalName ?? null,
        extracted_text: parsedDocuments.get(a.id)?.extractedText ?? null,
        extracted_chars: parsedDocuments.get(a.id)?.extractedChars ?? null,
      })),
    );

    if (attachmentInsertError) {
      return { error: true, message: "Failed to save message attachments", roomId: room.id };
    }
  }

  return { error: false, roomId: room.id };
}

export async function deleteRoom(
  unsafeData: z.infer<typeof deleteRoomSchema>,
): Promise<{ error: boolean; message?: string }> {
  const { success, data } = deleteRoomSchema.safeParse(unsafeData);
  if (!success) {
    return { error: true, message: "Invalid room id" };
  }

  const user = await getCurrentUser();
  if (user == null) {
    return { error: true, message: "User not authenticated" };
  }

  const supabase = createSupabaseAdminClient();

  // Ensure ownership (match sendMessage pattern)
  const { data: room, error: roomError } = await supabase
    .from("chat_room")
    .select("id")
    .eq("id", data.roomId)
    .eq("owner_id", user.id)
    .single();

  if (roomError || room == null) {
    return { error: true, message: "Chat not found" };
  }

  // Delete messages explicitly (safe even if DB cascades)
  await supabase.from("message").delete().eq("chat_room_id", room.id);

  const { error: deleteError } = await supabase
    .from("chat_room")
    .delete()
    .eq("id", room.id)
    .eq("owner_id", user.id);

  if (deleteError) {
    return { error: true, message: "Failed to delete chat" };
  }

  return { error: false };
}

export async function updateRoomModel(
  unsafeData: z.infer<typeof updateRoomModelSchema>,
): Promise<{ error: boolean; message?: string }> {
  const { success, data } = updateRoomModelSchema.safeParse(unsafeData);
  if (!success) {
    return { error: true, message: "Invalid model update data" };
  }

  const user = await getCurrentUser();
  if (user == null) {
    return { error: true, message: "User not authenticated" };
  }

  const supabase = createSupabaseAdminClient();

  const { data: room, error: roomError } = await supabase
    .from("chat_room")
    .select("id")
    .eq("id", data.roomId)
    .eq("owner_id", user.id)
    .single();

  if (roomError || room == null) {
    return { error: true, message: "Chat not found" };
  }

  const { error: updateError } = await supabase
    .from("chat_room")
    .update({ model_slug: data.modelSlug })
    .eq("id", room.id)
    .eq("owner_id", user.id);

  if (updateError) {
    return { error: true, message: "Failed to update model" };
  }

  return { error: false };
}
