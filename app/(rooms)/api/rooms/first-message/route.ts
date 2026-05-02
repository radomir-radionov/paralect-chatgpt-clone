import { NextResponse } from "next/server";

import { startRoomWithFirstMessageMutation } from "@domains/chat/services/roomMutations";

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

  const result = await startRoomWithFirstMessageMutation(body as never);
  if (result.error) {
    const status = result.message === "User not authenticated" ? 401 : 400;
    return NextResponse.json(
      {
        error: true,
        message: result.message,
        ...(result.roomId != null ? { roomId: result.roomId } : {}),
      },
      { status },
    );
  }

  return NextResponse.json({ error: false, roomId: result.roomId });
}
