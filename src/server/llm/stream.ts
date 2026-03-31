import { requireLlmKeys } from "@/lib/env";
import { withStreamIdleTimeout } from "./idle-timeout";
import { streamByModelId } from "./registry";
import type { LlmMessage } from "./types";

const STREAM_IDLE_TIMEOUT_MS = 30_000;
const STREAM_IDLE_TIMEOUT_MESSAGE =
  "The model stopped responding during streaming. Please try again.";

export async function* streamLlmCompletion(options: {
  modelId: string;
  messages: LlmMessage[];
}): AsyncGenerator<string> {
  requireLlmKeys();
  const { modelId, messages } = options;
  const system = "You are a helpful assistant. Answer clearly and concisely.";

  yield* withStreamIdleTimeout(streamByModelId(modelId, system, messages), {
    timeoutMs: STREAM_IDLE_TIMEOUT_MS,
    timeoutMessage: STREAM_IDLE_TIMEOUT_MESSAGE,
  });
}
