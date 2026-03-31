import { requireLlmKeys } from "@/lib/env";
import { withStreamIdleTimeout } from "./idle-timeout";
import { streamByModelId } from "./registry";
import type { LlmMessage } from "./types";

const STREAM_IDLE_TIMEOUT_MS = 30_000;
const STREAM_IDLE_TIMEOUT_MESSAGE =
  "The model stopped responding during streaming. Please try again.";

function buildSystemPrompt(ragContext?: string): string {
  const base = "You are a helpful assistant. Answer clearly and concisely.";
  if (!ragContext?.trim()) return base;
  return `${base}

The user attached documents. Use the excerpts below when they are relevant. If the answer is not contained in the excerpts, say so and answer from general knowledge only as needed.

--- Document excerpts ---
${ragContext.trim()}
--- End excerpts ---`;
}

export async function* streamLlmCompletion(options: {
  modelId: string;
  messages: LlmMessage[];
  /** Optional retrieved text from user documents (RAG). */
  ragContext?: string;
}): AsyncGenerator<string> {
  requireLlmKeys();
  const { modelId, messages, ragContext } = options;
  const system = buildSystemPrompt(ragContext);

  yield* withStreamIdleTimeout(streamByModelId(modelId, system, messages), {
    timeoutMs: STREAM_IDLE_TIMEOUT_MS,
    timeoutMessage: STREAM_IDLE_TIMEOUT_MESSAGE,
  });
}
