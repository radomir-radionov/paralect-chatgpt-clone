import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@shared/lib/supabase/types/database";
import {
  CHAT_DOCUMENTS_MAX_ATTACHMENTS,
  CHAT_DOCUMENTS_MAX_BYTES,
  fileExtensionForDocument,
} from "@domains/chat/attachments/lib/chatDocuments";
import { CHAT_IMAGES_MAX_ATTACHMENTS, CHAT_IMAGES_MAX_BYTES } from "@domains/chat/attachments/lib/chatImages";
import { parseChatDocument } from "@domains/chat/attachments/lib/unstructuredDocuments";

import type {
  ParsedStreamIncomingDocument,
  StreamIncomingAttachment,
} from "@domains/chat/streaming/lib/streamTypes";

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
}

export function normalizeStreamIncomingAttachments(options: {
  readonly attachments: StreamIncomingAttachment[];
  readonly userId: string;
  readonly roomId: string;
  readonly messageId: string;
}): StreamIncomingAttachment[] {
  const pathPrefix = `${options.userId}/${options.roomId}/${options.messageId}/`;
  const normalized: StreamIncomingAttachment[] = [];

  for (const attachment of options.attachments) {
    const kind = attachment.kind ?? "image";
    if (kind !== "image" && kind !== "document") {
      throw new Error("Unsupported attachment type");
    }

    if (
      typeof attachment.id !== "string" ||
      !isUuid(attachment.id) ||
      typeof attachment.storagePath !== "string" ||
      typeof attachment.mimeType !== "string" ||
      typeof attachment.sizeBytes !== "number" ||
      !Number.isInteger(attachment.sizeBytes) ||
      attachment.sizeBytes < 0 ||
      !attachment.storagePath.startsWith(pathPrefix)
    ) {
      throw new Error("Invalid attachment metadata");
    }

    if (kind === "image" && attachment.sizeBytes > CHAT_IMAGES_MAX_BYTES) {
      throw new Error("One of the images is too large");
    }

    if (kind === "document") {
      const originalName =
        typeof attachment.originalName === "string" && attachment.originalName.trim()
          ? attachment.originalName.trim()
          : attachment.storagePath.split("/").pop() || "document";

      if (attachment.sizeBytes > CHAT_DOCUMENTS_MAX_BYTES) {
        throw new Error("One of the documents is too large");
      }

      if (!fileExtensionForDocument({ name: originalName, type: attachment.mimeType })) {
        throw new Error(`Unsupported document type: ${originalName}`);
      }

      normalized.push({ ...attachment, kind, originalName });
      continue;
    }

    normalized.push({ ...attachment, kind });
  }

  const imageCount = normalized.filter((a) => a.kind === "image").length;
  const documentCount = normalized.filter((a) => a.kind === "document").length;

  if (imageCount > CHAT_IMAGES_MAX_ATTACHMENTS) {
    throw new Error(`You can attach up to ${CHAT_IMAGES_MAX_ATTACHMENTS} images`);
  }

  if (documentCount > CHAT_DOCUMENTS_MAX_ATTACHMENTS) {
    throw new Error(`You can attach up to ${CHAT_DOCUMENTS_MAX_ATTACHMENTS} documents`);
  }

  return normalized;
}

export async function parseStreamIncomingDocuments(options: {
  readonly attachments: StreamIncomingAttachment[];
  readonly supabase: SupabaseClient<Database>;
}): Promise<Map<string, ParsedStreamIncomingDocument>> {
  const parsed = new Map<string, ParsedStreamIncomingDocument>();

  for (const attachment of options.attachments) {
    if (attachment.kind !== "document") continue;

    const { data, error } = await options.supabase.storage
      .from("chat-attachments")
      .download(attachment.storagePath);

    if (error || data == null) {
      throw new Error(`Failed to load ${attachment.originalName ?? "document"} for parsing`);
    }

    if (data.size > CHAT_DOCUMENTS_MAX_BYTES) {
      throw new Error(`One of the documents is too large`);
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

export async function verifyStreamIncomingImageObjects(options: {
  readonly attachments: StreamIncomingAttachment[];
  readonly supabase: SupabaseClient<Database>;
}): Promise<void> {
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
