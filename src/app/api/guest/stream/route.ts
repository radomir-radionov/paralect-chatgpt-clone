import { z } from "zod";
import { guestStreamSchema } from "@/lib/validation/chat";
import {
  assertAnonymousQuota,
  incrementAnonymousUsage,
} from "@/server/anon/quota";
import {
  attachPrincipalHeaders,
  resolveRequestPrincipal,
} from "@/server/auth/principal";
import { sseResponse } from "@/server/http/sse";
import { streamLlmCompletion } from "@/server/llm/stream";
import type { LlmMessage } from "@/server/llm/types";
import { isRagEmbeddingConfigured } from "@/server/rag/embed";
import { retrieveContextForPrincipal } from "@/server/rag/principal";
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
    const principal = await resolveRequestPrincipal(request);
    if (principal.role !== "guest") {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    assertAnonymousQuota(principal.count);

    const llmMessages: LlmMessage[] = body.messages.map((m) => ({
      role: m.role,
      content: m.content,
      images: m.role === "user" ? m.images : undefined,
    }));

    let ragContext: string | undefined;
    const docIds = body.documentIds;
    if (docIds?.length) {
      if (!isRagEmbeddingConfigured()) {
        return Response.json(
          {
            error:
              "GOOGLE_GENERATIVE_AI_API_KEY is required on the server to use document context (Gemini embeddings).",
          },
          { status: 400 },
        );
      }
      const lastUser = [...body.messages]
        .reverse()
        .find((m) => m.role === "user");
      const query = lastUser?.content?.trim() ?? "";
      ragContext = await retrieveContextForPrincipal(principal, {
        query: query || " ",
        documentIds: docIds,
      });
    }

    await incrementAnonymousUsage(principal.sessionId);

    const stream = streamLlmCompletion({
      modelId: body.modelId,
      messages: llmMessages,
      ragContext,
    });

    const res = sseResponse(stream);

    const headers = new Headers(res.headers);
    attachPrincipalHeaders(headers, principal);
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
