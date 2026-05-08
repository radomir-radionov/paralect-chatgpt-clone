import { createRoomMutation } from "@domains/chat/room/services/roomMutations";
import { jsonError, jsonOk } from "@shared/lib/http/nextJson";
import { readJson } from "@shared/lib/http/readJson";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const parsed = await readJson(req);
  if (!parsed.ok) return parsed.response;
  const body = parsed.data;

  const result = await createRoomMutation(body as never);
  if (result.error) {
    const status =
      result.message === "User not authenticated"
        ? 401
        : result.message === "Invalid room data"
          ? 400
          : 500;
    return jsonError(result.message, status);
  }

  return jsonOk({ roomId: result.roomId });
}
