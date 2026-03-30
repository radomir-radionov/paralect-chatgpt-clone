import { requireLlmKeys } from "@/lib/env";
import { streamByModelId } from "./registry";
import type { LlmMessage } from "./types";

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

  yield* streamByModelId(modelId, system, messages);
}
