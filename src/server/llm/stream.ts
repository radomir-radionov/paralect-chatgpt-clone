import { requireLlmKeys } from "@/lib/env";
import { withStreamIdleTimeout } from "./idle-timeout";
import { streamByModelId } from "./registry";
import type { LlmMessage } from "./types";

const STREAM_IDLE_TIMEOUT_MS = 30_000;
const STREAM_IDLE_TIMEOUT_MESSAGE =
  "The model stopped responding during streaming. Please try again.";

function buildContextBlock(context?: string) {
  if (!context?.trim()) return "";
  return `\n\n---\nRelevant document context (use when helpful):\n${context.trim()}\n---\n`;
}

export async function* streamLlmCompletion(options: {
  modelId: string;
  messages: LlmMessage[];
  context?: string;
}): AsyncGenerator<string> {
  requireLlmKeys();
  const { modelId, messages, context } = options;
  const ctx = buildContextBlock(context);
  const system =
    "You are a helpful assistant. Answer clearly and concisely." + ctx;

  yield* withStreamIdleTimeout(streamByModelId(modelId, system, messages), {
    timeoutMs: STREAM_IDLE_TIMEOUT_MS,
    timeoutMessage: STREAM_IDLE_TIMEOUT_MESSAGE,
  });
}
