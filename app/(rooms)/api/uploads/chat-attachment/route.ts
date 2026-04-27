import { NextResponse } from "next/server";

import {
  CHAT_DOCUMENTS_MAX_BYTES,
  fileExtensionForDocument,
} from "@domains/chat/lib/chatDocuments";
import {
  CHAT_IMAGES_BUCKET,
  CHAT_IMAGES_MAX_BYTES,
  fileExtensionForMime,
} from "@domains/chat/lib/chatImages";
import { fetchRoom } from "@domains/chat/queries/room-fetchers";
import { getCurrentUser } from "@shared/lib/supabase/getCurrentUser";
import { createSupabaseAdminClient } from "@shared/lib/supabase/server";

export const runtime = "nodejs";

const BUCKET = CHAT_IMAGES_BUCKET;

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
}

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: true, message }, { status });
}

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (user == null) {
    return jsonError("User not authenticated", 401);
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return jsonError("Invalid form data", 400);
  }

  const kindRaw = form.get("kind");
  const attachmentIdRaw = form.get("attachmentId");
  const messageIdRaw = form.get("messageId");
  const roomIdRaw = form.get("roomId");
  const originalNameRaw = form.get("originalName");
  const file = form.get("file");

  const kind = kindRaw === "document" ? "document" : kindRaw === "image" ? "image" : null;
  if (kind == null) {
    return jsonError("kind must be image or document", 400);
  }

  if (typeof attachmentIdRaw !== "string" || !isUuid(attachmentIdRaw)) {
    return jsonError("Invalid attachmentId", 400);
  }
  if (typeof messageIdRaw !== "string" || !isUuid(messageIdRaw)) {
    return jsonError("Invalid messageId", 400);
  }

  const roomId =
    typeof roomIdRaw === "string" && roomIdRaw.trim() && isUuid(roomIdRaw.trim())
      ? roomIdRaw.trim()
      : null;

  if (!(file instanceof File) || file.size === 0) {
    return jsonError("file is required", 400);
  }

  if (kind === "image" && file.size > CHAT_IMAGES_MAX_BYTES) {
    return jsonError("Image is too large", 400);
  }
  if (kind === "document" && file.size > CHAT_DOCUMENTS_MAX_BYTES) {
    return jsonError("Document is too large", 400);
  }

  const supabase = createSupabaseAdminClient();

  if (roomId != null) {
    const room = await fetchRoom(supabase, roomId, user.id);
    if (room == null) {
      return jsonError("Chat not found", 404);
    }
  }

  let ext: string;
  if (kind === "image") {
    ext = fileExtensionForMime(file.type || "application/octet-stream") ?? "bin";
  } else {
    const originalName =
      typeof originalNameRaw === "string" && originalNameRaw.trim()
        ? originalNameRaw.trim()
        : file.name;
    ext =
      fileExtensionForDocument({ name: originalName, type: file.type || "application/octet-stream" }) ??
      "bin";
    if (ext === "bin") {
      return jsonError("Unsupported document type", 400);
    }
  }

  const storagePath =
    roomId != null
      ? `${user.id}/${roomId}/${messageIdRaw}/${attachmentIdRaw}.${ext}`
      : `${user.id}/tmp/${messageIdRaw}/${attachmentIdRaw}.${ext}`;

  const contentType = file.type || "application/octet-stream";

  const { error } = await supabase.storage.from(BUCKET).upload(storagePath, file, {
    contentType,
    upsert: false,
  });

  if (error) {
    return jsonError(error.message || "Upload failed", 500);
  }

  return NextResponse.json({ error: false, storagePath });
}
