import { NextResponse } from "next/server";

import { createRoomMutation } from "@domains/chat/services/roomMutations";

export const runtime = "nodejs";

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: true, message }, { status });
}

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

  return NextResponse.json({ error: false, roomId: result.roomId });
}
