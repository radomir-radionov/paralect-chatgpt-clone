import { NextResponse } from "next/server";

import { getCurrentUser } from "@shared/lib/supabase/getCurrentUser";
import { createSupabaseAdminClient } from "@shared/lib/supabase/server";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ roomId: string; attachmentId: string }> },
) {
  const user = await getCurrentUser();
  if (user == null) {
    return NextResponse.json(
      { error: true, message: "User not authenticated" },
      { status: 401 },
    );
  }

  const { roomId, attachmentId } = await params;
  const supabase = createSupabaseAdminClient();

  const { data: room, error: roomError } = await supabase
    .from("chat_room")
    .select("id")
    .eq("id", roomId)
    .eq("owner_id", user.id)
    .single();

  if (roomError || room == null) {
    return NextResponse.json({ error: true, message: "Chat not found" }, { status: 404 });
  }

  const { data: attachment, error: attachmentError } = await supabase
    .from("message_attachment")
    .select("id, storage_bucket, storage_path, mime_type")
    .eq("id", attachmentId)
    .eq("chat_room_id", room.id)
    .single();

  if (attachmentError || attachment == null) {
    return NextResponse.json({ error: true, message: "Attachment not found" }, { status: 404 });
  }

  const { data } = await supabase.storage
    .from(attachment.storage_bucket)
    .createSignedUrl(attachment.storage_path, 60 * 5);

  const url = data?.signedUrl;
  if (!url) {
    return NextResponse.json(
      { error: true, message: "Failed to generate attachment URL" },
      { status: 500 },
    );
  }

  return NextResponse.redirect(url);
}

