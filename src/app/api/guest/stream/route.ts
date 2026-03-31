import { z } from "zod";
import { guestStreamSchema } from "@/lib/validation/chat";
import {
  ANON_COOKIE_NAME,
  assertAnonymousQuota,
  getOrCreateAnonymousSession,
  incrementAnonymousUsage,
} from "@/server/anon/quota";
import { sseResponse } from "@/server/http/sse";
import { streamLlmCompletion } from "@/server/llm/stream";
import type { LlmMessage } from "@/server/llm/types";
import { getClientIp, rateLimitOrThrow } from "@/server/rate-limit";

const GUEST_STREAM_WINDOW_MS = 60_000;
const GUEST_STREAM_MAX = 30;

export async function POST(request: Request) {
  try {
    rateLimitOrThrow(
      `guest-stream:${getClientIp(request)}`,
      GUEST_STREAM_MAX,
      GUEST_STREAM_WINDOW_MS,
    );
    const body = guestStreamSchema.parse(await request.json());
    const cookieHeader = request.headers.get("cookie");
    const session = await getOrCreateAnonymousSession(cookieHeader);

    assertAnonymousQuota(session.count);

    const llmMessages: LlmMessage[] = body.messages.map((m) => ({
      role: m.role,
      content: m.content,
      images: m.role === "user" ? m.images : undefined,
    }));

    await incrementAnonymousUsage(session.sessionId);

    const stream = streamLlmCompletion({
      modelId: body.modelId,
      messages: llmMessages,
    });

    const res = sseResponse(stream);

    const headers = new Headers(res.headers);
    headers.set(
      "Set-Cookie",
      `${ANON_COOKIE_NAME}=${session.token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${60 * 60 * 24 * 400}`,
    );
    return new Response(res.body, { status: res.status, headers });
  } catch (e) {
    return handleError(e);
  }
}

function handleError(e: unknown) {
  if (e instanceof z.ZodError) {
    return Response.json({ error: e.flatten() }, { status: 400 });
  }
  if (
    e instanceof Error &&
    "status" in e &&
    typeof (e as { status?: number }).status === "number"
  ) {
    return Response.json(
      { error: e.message, code: (e as { code?: string }).code },
      { status: (e as { status: number }).status },
    );
  }
  console.error(e);
  return Response.json({ error: "Internal error" }, { status: 500 });
}
