import { fetchRoom } from "@domains/chat/room/queries/room-fetchers";
import {
  deleteRoomMutation,
  updateRoomModelMutation,
} from "@domains/chat/room/services/roomMutations";
import { jsonError, jsonOk } from "@shared/lib/http/nextJson";
import { readJson } from "@shared/lib/http/readJson";
import { getCurrentUser } from "@shared/lib/supabase/getCurrentUser";
import { createSupabaseAdminClient } from "@shared/lib/supabase/server";

export const runtime = "nodejs";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ roomId: string }> },
) {
  const user = await getCurrentUser();
  if (user == null) {
    return jsonError("User not authenticated", 401);
  }

  const { roomId } = await params;
  const supabase = createSupabaseAdminClient();

  try {
    const room = await fetchRoom(supabase, roomId, user.id);

    if (room == null) {
      return jsonError("Chat not found", 404);
    }

    return jsonOk({ room });
  } catch (error) {
    console.error("[api/rooms/:roomId GET]", error);
    return jsonError("Internal server error", 500);
  }
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ roomId: string }> },
) {
  if ((await getCurrentUser()) == null) {
    return jsonError("User not authenticated", 401);
  }

  const { roomId } = await params;
  const parsed = await readJson(req);
  if (!parsed.ok) return parsed.response;
  const body = parsed.data;

  const raw = body as Record<string, unknown>;
  const modelSlug = raw.modelSlug;
  if (typeof modelSlug !== "string") {
    return jsonError("modelSlug is required", 400);
  }

  const result = await updateRoomModelMutation({
    roomId,
    modelSlug: modelSlug as never,
  });
  if (result.error) {
    const status =
      result.message === "User not authenticated"
        ? 401
        : result.message === "Chat not found"
          ? 404
          : 400;
    return jsonError(result.message ?? "Update failed", status);
  }

  return jsonOk();
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

  return jsonOk();
}
