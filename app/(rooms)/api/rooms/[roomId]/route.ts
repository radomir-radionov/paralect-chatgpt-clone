import { NextResponse } from "next/server";

import { fetchRoom } from "@domains/chat/queries/room-fetchers";
import {
  deleteRoomMutation,
  updateRoomModelMutation,
} from "@domains/chat/services/roomMutations";
import { getCurrentUser } from "@shared/lib/supabase/getCurrentUser";
import { createSupabaseAdminClient } from "@shared/lib/supabase/server";

export const runtime = "nodejs";

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: true, message }, { status });
}

export async function GET(
  _req: Request,
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
  const supabase = createSupabaseAdminClient();
  const room = await fetchRoom(supabase, roomId, user.id);

  if (room == null) {
    return NextResponse.json({ error: true, message: "Chat not found" }, { status: 404 });
  }

  return NextResponse.json({ error: false, room });
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ roomId: string }> },
) {
  if ((await getCurrentUser()) == null) {
    return jsonError("User not authenticated", 401);
  }

  const { roomId } = await params;
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return jsonError("Invalid JSON body", 400);
  }

  const raw = body as Record<string, unknown>;
  const modelSlug = raw.modelSlug;
  if (typeof modelSlug !== "string") {
    return jsonError("modelSlug is required", 400);
  }

  const result = await updateRoomModelMutation({ roomId, modelSlug: modelSlug as never });
  if (result.error) {
    const status =
      result.message === "User not authenticated"
        ? 401
        : result.message === "Chat not found"
          ? 404
          : 400;
    return jsonError(result.message ?? "Update failed", status);
  }

  return NextResponse.json({ error: false });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ roomId: string }> },
) {
  if ((await getCurrentUser()) == null) {
    return jsonError("User not authenticated", 401);
  }

  const { roomId } = await params;
  const result = await deleteRoomMutation({ roomId });
  if (result.error) {
    const status =
      result.message === "User not authenticated"
        ? 401
        : result.message === "Chat not found"
          ? 404
          : 500;
    return jsonError(result.message ?? "Delete failed", status);
  }

  return NextResponse.json({ error: false });
}
