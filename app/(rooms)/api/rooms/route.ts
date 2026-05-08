import { createRoomMutation } from "@domains/chat/services/roomMutations";
import { jsonError, jsonOk } from "@shared/lib/http/nextJson";

export const runtime = "nodejs";

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return jsonError("Invalid JSON body", 400);
  }

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
