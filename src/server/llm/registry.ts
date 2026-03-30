import { getServerEnv } from "@/lib/env";
import type { LlmMessage } from "./types";
import { streamGemini } from "./providers/google";
import { streamOpenAI } from "./providers/openai";
import { streamOpenAICompatible } from "./providers/openai-compatible";

const COMPAT_PREFIX = "compat:";

/**
 * Routes `modelId` (e.g. `openai:gpt-4o-mini`, `google:gemini-2.5-flash`,
 * `compat:meta-llama/...`) to the correct streaming implementation.
 */
export async function* streamByModelId(
  modelId: string,
  system: string,
  messages: LlmMessage[],
): AsyncGenerator<string> {
  if (modelId.startsWith("openai:")) {
    const model = modelId.slice("openai:".length);
    yield* streamOpenAI(model, system, messages);
    return;
  }
  if (modelId.startsWith("google:")) {
    const model = modelId.slice("google:".length);
    yield* streamGemini(model, system, messages);
    return;
  }
  if (modelId.startsWith(COMPAT_PREFIX)) {
    const model = modelId.slice(COMPAT_PREFIX.length);
    yield* streamOpenAICompatible(model, system, messages);
    return;
  }

  const env = getServerEnv();
  const { OPENAI_API_KEY, GOOGLE_GENERATIVE_AI_API_KEY } = env;
  if (OPENAI_API_KEY) {
    yield* streamOpenAI("gpt-4o-mini", system, messages);
    return;
  }
  if (GOOGLE_GENERATIVE_AI_API_KEY) {
    yield* streamGemini("gemini-2.5-flash", system, messages);
    return;
  }
  const defaultCompat = env.OPENAI_COMPATIBLE_DEFAULT_MODEL?.trim();
  if (
    env.OPENAI_COMPATIBLE_BASE_URL?.trim() &&
    env.OPENAI_COMPATIBLE_API_KEY &&
    defaultCompat
  ) {
    yield* streamOpenAICompatible(defaultCompat, system, messages);
    return;
  }
  throw new Error(
    "Set at least one of OPENAI_API_KEY, GOOGLE_GENERATIVE_AI_API_KEY, or OpenAI-compatible env vars (base URL, API key, and OPENAI_COMPATIBLE_DEFAULT_MODEL for unprefixed requests)",
  );
}
